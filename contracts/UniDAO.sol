// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev UniToken surface used by the DAO: standard ERC-20 plus the owner-gated
///      admin functions and EIP-2612 permit. The DAO is expected to be the token owner.
interface IUniToken is IERC20 {
    function mint(address to, uint256 amount) external;
    function adminBurn(address from, uint256 amount) external;
    function setWhitelisted(address account, bool allowed) external;
    function setWhitelistedBatch(address[] calldata accounts, bool allowed) external;
    function isWhitelisted(address account) external view returns (bool);
    function transferOwnership(address newOwner) external;
    function acceptOwnership() external;
    function owner() external view returns (address);
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/// @title UniDAO — governance and membership for a university DAO
/// @notice Holds the member registry, proposal lifecycle and voting. Owns UniToken and
///         drives its admin functions through the registrar role.
/// @dev Membership is tracked here (isMember), NOT inferred from the token whitelist —
///      the whitelist also contains non-members (treasury, the DAO itself), so inferring
///      membership from it would desync the quorum math.
contract UniDAO is ReentrancyGuard {
    // ---- TYPES ----
    enum ProposalType {
        SET_QUORUM,
        GENERAL,
        SET_TREASURY,
        SET_VOTE_FEE,
        SET_REGISTRAR,
        SET_TOKEN_OWNER,
        SET_MEMBER_GRANT,
        TRANSFER
    }

    enum ProposalState {
        Active,
        PendingFinalize,
        Succeeded,
        Defeated,
        Cancelled
    }

    /// @dev Field order is chosen for storage packing: the enum + 3 bools + proposer
    ///      address share one slot, and deadline(64) + yesVotes(96) + noVotes(96) fill
    ///      the next slot exactly. Do not reorder without re-checking the layout.
    struct Proposal {
        ProposalType proposalType;
        bool finalized;
        bool passed;
        bool cancelled;
        address proposer;
        uint64 deadline;
        uint96 yesVotes;
        uint96 noVotes;
        string title;
        string description;
        address target;
        uint256 amount;    // SET_VOTE_FEE / SET_MEMBER_GRANT / TRANSFER
        uint256 newQuorum; // basis points, SET_QUORUM only
        uint256 quorum;    // absolute vote count required, snapshotted at creation
    }

    // ---- CONSTANTS ----
    uint256 public constant MAX_DURATION = 30 days;
    uint256 public constant MAX_VOTE_FEE = 100e18;
    uint256 public constant MAX_BPS = 10_000; // 100% in basis points
    uint256 public constant TITLE_MAX_LENGTH = 128;
    uint256 public constant DESCRIPTION_MAX_LENGTH = 1024;

    // ---- STATE ----
    IUniToken public immutable token;
    uint256 public immutable minDuration;
    /// @notice Floor the registrar cannot remove members below, so a hostile registrar
    ///         can neither empty the roster nor shrink it to a capturable size.
    uint256 public immutable minMembers;

    uint256 public proposalCount;
    uint256 public quorumBps;
    uint256 public voteFee;
    address public treasury;
    address public registrar;
    uint256 public memberCount;
    /// @notice UDT auto-minted to a new member with zero balance, so they can pay the
    ///         vote fee and vote immediately. Must be >= voteFee to be useful.
    uint256 public memberGrant;
    uint256 public proposalCooldown;

    mapping(address => bool) public isMember;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(address => uint256) public lastProposalAt;

    // ---- EVENTS ----
    event ProposalCreated(
        uint256 indexed id,
        ProposalType proposalType,
        address indexed proposer,
        string title,
        uint256 deadline
    );
    event ProposalCancelled(uint256 indexed id);
    event VoteCast(uint256 indexed id, address indexed voter, bool support);
    event ProposalFinalized(uint256 indexed id, bool passed);
    event QuorumUpdated(uint256 newQuorumBps);
    event TreasuryUpdated(address indexed treasury);
    event VoteFeeUpdated(uint256 newFee);
    event RegistrarUpdated(address indexed registrar);
    event MemberAdded(address indexed student);
    event MemberRemoved(address indexed student);
    event MemberGrantUpdated(uint256 newGrant);
    event TokenOwnerProposed(address indexed newOwner);
    event TreasuryTransfer(address indexed to, uint256 amount);

    // ---- ERRORS ----
    error NotRegistrar();
    error NotMember(address account);
    error AlreadyMember(address account);
    error ZeroAddress();
    error ZeroAmount();
    error CannotRemoveTreasury();
    error CannotRemoveDAO();
    error BelowMemberFloor();
    error InvalidQuorum();
    error FeeTooHigh();
    error TreasuryNotWhitelisted();
    error InvalidMinDuration();
    error DurationTooShort();
    error DurationTooLong();
    error TitleTooLong();
    error DescriptionTooLong();
    error ProposalCooldownActive();
    error InvalidProposal();
    error NotProposer();
    error AlreadyFinalized();
    error ProposalIsCancelled();
    error VotesAlreadyCast();
    error AlreadyVoted();
    error VotingEnded();
    error VotingNotEnded();
    error FeeTransferFailed();
    error InvalidLimit();

    constructor(
        address _token,
        uint256 _quorumBps,
        address _treasury,
        uint256 _voteFee,
        address _registrar,
        uint256 _minDuration,
        uint256 _minMembers,
        uint256 _proposalCooldown,
        uint256 _memberGrant
    ) {
        if (_token == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        if (_registrar == address(0)) revert ZeroAddress();
        if (_quorumBps == 0 || _quorumBps > MAX_BPS) revert InvalidQuorum();
        if (_voteFee > MAX_VOTE_FEE) revert FeeTooHigh();
        if (_minDuration < 120 seconds) revert InvalidMinDuration();
        // Treasury must be whitelisted up front, otherwise every fee-paying vote reverts.
        if (!IUniToken(_token).isWhitelisted(_treasury)) revert TreasuryNotWhitelisted();

        token = IUniToken(_token);
        quorumBps = _quorumBps;
        treasury = _treasury;
        voteFee = _voteFee;
        registrar = _registrar;
        minDuration = _minDuration;
        minMembers = _minMembers;
        proposalCooldown = _proposalCooldown;
        memberGrant = _memberGrant;
    }

    // ---- VIEWS ----

    /// @notice Absolute vote count required to reach quorum, derived from the live member
    ///         count. Ceiling division with a floor of 1 so quorum is never zero.
    function currentQuorum() public view returns (uint256) {
        uint256 q = (memberCount * quorumBps + MAX_BPS - 1) / MAX_BPS;
        return q == 0 ? 1 : q;
    }

    function state(uint256 id) public view returns (ProposalState) {
        if (id == 0 || id > proposalCount) revert InvalidProposal();
        Proposal storage p = proposals[id];
        if (p.cancelled) return ProposalState.Cancelled;
        if (!p.finalized) {
            return block.timestamp < p.deadline ? ProposalState.Active : ProposalState.PendingFinalize;
        }
        return p.passed ? ProposalState.Succeeded : ProposalState.Defeated;
    }

    /// @notice Paginated read for the frontend.
    /// @param offset zero-based index into the proposal list; storage ids are 1-based,
    ///        so this returns proposals[offset+1 .. offset+n].
    function getProposals(uint256 offset, uint256 limit) external view returns (Proposal[] memory) {
        if (limit == 0 || limit > 50) revert InvalidLimit();
        uint256 total = proposalCount;
        if (offset >= total) return new Proposal[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 n = end - offset;
        Proposal[] memory result = new Proposal[](n);
        for (uint256 i = 0; i < n; i++) {
            result[i] = proposals[offset + i + 1];
        }
        return result;
    }

    // ---- REGISTRAR OPERATIONS ----

    modifier onlyRegistrar() {
        if (msg.sender != registrar) revert NotRegistrar();
        _;
    }

    function _addStudent(address student) internal {
        if (student == address(0)) revert ZeroAddress();
        if (isMember[student]) revert AlreadyMember(student);
        isMember[student] = true;
        memberCount++;
        token.setWhitelisted(student, true);
        // Seed a zero-balance member so they can pay the vote fee right away.
        if (memberGrant > 0 && token.balanceOf(student) == 0) {
            token.mint(student, memberGrant);
        }
        emit MemberAdded(student);
    }

    function registrarAddStudent(address student) external onlyRegistrar {
        _addStudent(student);
    }

    function registrarAddStudents(address[] calldata students) external onlyRegistrar {
        uint256 len = students.length;
        for (uint256 i = 0; i < len; i++) {
            _addStudent(students[i]);
        }
    }

    function registrarRemoveStudent(address student) external onlyRegistrar {
        // Un-whitelisting the treasury or the DAO itself would freeze fee-paying votes.
        if (student == treasury) revert CannotRemoveTreasury();
        if (student == address(this)) revert CannotRemoveDAO();
        if (!isMember[student]) revert NotMember(student);
        if (memberCount <= minMembers) revert BelowMemberFloor();

        isMember[student] = false;
        memberCount--;
        token.setWhitelisted(student, false);
        emit MemberRemoved(student);
    }

    function registrarMint(address to, uint256 amount) external onlyRegistrar {
        token.mint(to, amount);
    }

    /// @notice Reclaim UDT from any holder via the token's owner-only burn.
    function registrarClawback(address from, uint256 amount) external onlyRegistrar {
        token.adminBurn(from, amount);
    }

    /// @notice Second step of taking token ownership (Ownable2Step). Run after the current
    ///         token owner has called transferOwnership(thisDAO).
    function acceptTokenOwnership() external onlyRegistrar {
        token.acceptOwnership();
    }

    // ---- CREATE PROPOSALS ----

    function proposeSetQuorum(
        string memory title,
        string memory description,
        uint256 newQuorumBps,
        uint256 duration
    ) external returns (uint256) {
        if (newQuorumBps == 0 || newQuorumBps > MAX_BPS) revert InvalidQuorum();
        return _createProposal(ProposalType.SET_QUORUM, title, description, address(0), 0, newQuorumBps, duration);
    }

    function proposeGeneral(
        string memory title,
        string memory description,
        uint256 duration
    ) external returns (uint256) {
        return _createProposal(ProposalType.GENERAL, title, description, address(0), 0, 0, duration);
    }

    function proposeSetTreasury(
        string memory title,
        string memory description,
        address newTreasury,
        uint256 duration
    ) external returns (uint256) {
        if (newTreasury == address(0)) revert ZeroAddress();
        // Fast-fail; the same condition is re-checked at execution time.
        if (!token.isWhitelisted(newTreasury)) revert TreasuryNotWhitelisted();
        return _createProposal(ProposalType.SET_TREASURY, title, description, newTreasury, 0, 0, duration);
    }

    function proposeSetVoteFee(
        string memory title,
        string memory description,
        uint256 newFee,
        uint256 duration
    ) external returns (uint256) {
        if (newFee > MAX_VOTE_FEE) revert FeeTooHigh();
        return _createProposal(ProposalType.SET_VOTE_FEE, title, description, address(0), newFee, 0, duration);
    }

    function proposeSetRegistrar(
        string memory title,
        string memory description,
        address newRegistrar,
        uint256 duration
    ) external returns (uint256) {
        if (newRegistrar == address(0)) revert ZeroAddress();
        return _createProposal(ProposalType.SET_REGISTRAR, title, description, newRegistrar, 0, 0, duration);
    }

    function proposeSetTokenOwner(
        string memory title,
        string memory description,
        address newOwner,
        uint256 duration
    ) external returns (uint256) {
        if (newOwner == address(0)) revert ZeroAddress();
        return _createProposal(ProposalType.SET_TOKEN_OWNER, title, description, newOwner, 0, 0, duration);
    }

    function proposeSetMemberGrant(
        string memory title,
        string memory description,
        uint256 newGrant,
        uint256 duration
    ) external returns (uint256) {
        return _createProposal(ProposalType.SET_MEMBER_GRANT, title, description, address(0), newGrant, 0, duration);
    }

    function proposeTransfer(
        string memory title,
        string memory description,
        address recipient,
        uint256 amount,
        uint256 duration
    ) external returns (uint256) {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        return _createProposal(ProposalType.TRANSFER, title, description, recipient, amount, 0, duration);
    }

    function _createProposal(
        ProposalType pType,
        string memory title,
        string memory desc,
        address target,
        uint256 amount,
        uint256 newQuorum,
        uint256 duration
    ) internal returns (uint256) {
        if (!isMember[msg.sender]) revert NotMember(msg.sender);
        if (duration < minDuration) revert DurationTooShort();
        if (duration > MAX_DURATION) revert DurationTooLong();
        if (bytes(title).length > TITLE_MAX_LENGTH) revert TitleTooLong();
        if (bytes(desc).length > DESCRIPTION_MAX_LENGTH) revert DescriptionTooLong();
        if (block.timestamp < lastProposalAt[msg.sender] + proposalCooldown) revert ProposalCooldownActive();

        lastProposalAt[msg.sender] = block.timestamp;
        proposalCount++;
        uint256 deadlineTs = block.timestamp + duration;

        proposals[proposalCount] = Proposal({
            proposalType: pType,
            finalized: false,
            passed: false,
            cancelled: false,
            proposer: msg.sender,
            deadline: uint64(deadlineTs),
            yesVotes: 0,
            noVotes: 0,
            title: title,
            description: desc,
            target: target,
            amount: amount,
            newQuorum: newQuorum,
            // Snapshot quorum now so a later quorumBps change can't move the bar mid-vote.
            quorum: currentQuorum()
        });

        emit ProposalCreated(proposalCount, pType, msg.sender, title, deadlineTs);
        return proposalCount;
    }

    // ---- CANCEL ----

    /// @notice Proposer may cancel their own proposal, but only before any vote is cast.
    function cancel(uint256 proposalId) external {
        if (proposalId == 0 || proposalId > proposalCount) revert InvalidProposal();
        Proposal storage p = proposals[proposalId];

        if (msg.sender != p.proposer) revert NotProposer();
        if (p.finalized) revert AlreadyFinalized();
        if (p.cancelled) revert ProposalIsCancelled();
        if (uint256(p.yesVotes) + uint256(p.noVotes) != 0) revert VotesAlreadyCast();

        p.cancelled = true;
        emit ProposalCancelled(proposalId);
    }

    // ---- VOTING ----

    function vote(uint256 proposalId, bool support) external nonReentrant {
        _vote(proposalId, support);
    }

    /// @notice Vote and approve the fee in one transaction via an off-chain EIP-2612 signature.
    function voteWithPermit(
        uint256 proposalId,
        bool support,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        if (voteFee > 0) {
            token.permit(msg.sender, address(this), voteFee, deadline, v, r, s);
        }
        _vote(proposalId, support);
    }

    /// @dev Checks-Effects-Interactions: hasVoted is set before the external fee transfer.
    function _vote(uint256 proposalId, bool support) internal {
        if (proposalId == 0 || proposalId > proposalCount) revert InvalidProposal();
        Proposal storage p = proposals[proposalId];

        if (p.cancelled) revert ProposalIsCancelled();
        if (block.timestamp >= p.deadline) revert VotingEnded();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();
        if (!isMember[msg.sender]) revert NotMember(msg.sender);

        hasVoted[proposalId][msg.sender] = true;

        if (voteFee > 0) {
            if (!token.transferFrom(msg.sender, treasury, voteFee)) revert FeeTransferFailed();
        }

        if (support) {
            p.yesVotes += 1;
        } else {
            p.noVotes += 1;
        }

        emit VoteCast(proposalId, msg.sender, support);
    }

    // ---- FINALIZE ----

    function finalize(uint256 proposalId) external {
        if (proposalId == 0 || proposalId > proposalCount) revert InvalidProposal();
        Proposal storage p = proposals[proposalId];

        if (p.cancelled) revert ProposalIsCancelled();
        if (block.timestamp < p.deadline) revert VotingNotEnded();
        if (p.finalized) revert AlreadyFinalized();

        p.finalized = true;
        // Uses the quorum snapshotted at creation, so a mid-vote change cannot move the bar.
        bool passed = (uint256(p.yesVotes) + uint256(p.noVotes) >= p.quorum) && (p.yesVotes > p.noVotes);

        if (passed) {
            passed = _execute(p);
        }
        p.passed = passed;

        emit ProposalFinalized(proposalId, passed);
    }

    // ---- EXECUTION ----

    /// @dev Re-validates conditions that may have gone stale since creation and returns
    ///      false (proposal fails) instead of reverting, so a stale proposal can never
    ///      permanently block finalize().
    function _execute(Proposal storage p) internal returns (bool) {
        if (p.proposalType == ProposalType.SET_QUORUM) {
            if (p.newQuorum == 0 || p.newQuorum > MAX_BPS) return false;
            quorumBps = p.newQuorum;
            emit QuorumUpdated(p.newQuorum);
        } else if (p.proposalType == ProposalType.SET_TREASURY) {
            if (p.target == address(0) || !token.isWhitelisted(p.target)) return false;
            treasury = p.target;
            emit TreasuryUpdated(p.target);
        } else if (p.proposalType == ProposalType.SET_VOTE_FEE) {
            if (p.amount > MAX_VOTE_FEE) return false;
            voteFee = p.amount;
            emit VoteFeeUpdated(p.amount);
        } else if (p.proposalType == ProposalType.SET_REGISTRAR) {
            if (p.target == address(0)) return false;
            registrar = p.target;
            emit RegistrarUpdated(p.target);
        } else if (p.proposalType == ProposalType.SET_TOKEN_OWNER) {
            if (p.target == address(0)) return false;
            // Only meaningful while the DAO actually owns the token.
            if (token.owner() != address(this)) return false;
            // Transfer is step one; the new owner must still call acceptOwnership().
            token.transferOwnership(p.target);
            emit TokenOwnerProposed(p.target);
        } else if (p.proposalType == ProposalType.SET_MEMBER_GRANT) {
            memberGrant = p.amount;
            emit MemberGrantUpdated(p.amount);
        } else if (p.proposalType == ProposalType.TRANSFER) {
            // Treasury must have separately approved this DAO to move its funds.
            if (p.target == address(0) || p.amount == 0) return false;
            if (!token.isWhitelisted(p.target)) return false;
            if (token.balanceOf(treasury) < p.amount) return false;
            if (token.allowance(treasury, address(this)) < p.amount) return false;
            token.transferFrom(treasury, p.target, p.amount);
            emit TreasuryTransfer(p.target, p.amount);
        }
        // GENERAL: no on-chain action, always succeeds.
        return true;
    }
}
