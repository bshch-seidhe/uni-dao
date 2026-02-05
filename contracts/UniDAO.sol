// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IUniToken is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function setWhitelisted(address account, bool allowed) external;
    function isWhitelisted(address account) external view returns (bool);
}

contract UniDAO {
    // ---- TYPES ----
    enum ProposalType {
        SET_QUORUM,
        GENERAL,
        SET_TREASURY,
        SET_VOTE_FEE,
        SET_REGISTRAR
    }

    struct Proposal {
        ProposalType proposalType;
        string title;
        string description;
        address target;
        uint256 amount;
        uint256 newQuorum;
        uint256 deadline;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
    }

    // ---- STATE ----
    IUniToken public immutable token;

    uint256 public proposalCount;
    uint256 public minQuorum;
    uint256 public voteFee;
    address public treasury;
    address public registrar;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // ---- EVENTS ----
    event ProposalCreated(uint256 indexed id, ProposalType proposalType, string title);
    event VoteCast(uint256 indexed id, address voter, bool support);
    event ProposalFinalized(uint256 indexed id, bool passed);
    event TreasuryUpdated(address indexed treasury);
    event VoteFeeUpdated(uint256 newFee);
    event RegistrarUpdated(address indexed registrar);

    constructor(
        address _token,
        uint256 _initialQuorum,
        address _treasury,
        uint256 _voteFee,
        address _registrar
    ) {
        require(_token != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        require(_registrar != address(0), "Invalid registrar");
        require(_initialQuorum > 0, "Invalid quorum");
        token = IUniToken(_token);
        minQuorum = _initialQuorum;
        treasury = _treasury;
        voteFee = _voteFee;
        registrar = _registrar;
    }

    // ---- REGISTRAR OPERATIONS ----

    modifier onlyRegistrar() {
        require(msg.sender == registrar, "Not registrar");
        _;
    }

    function registrarAddStudent(address student) external onlyRegistrar {
        token.setWhitelisted(student, true);
    }

    function registrarRemoveStudent(address student) external onlyRegistrar {
        token.setWhitelisted(student, false);
    }

    function registrarMint(address to, uint256 amount) external onlyRegistrar {
        token.mint(to, amount);
    }

    function registrarBurn(address from, uint256 amount) external onlyRegistrar {
        token.burn(from, amount);
    }

    // ---- CREATE PROPOSALS ----

    function proposeSetQuorum(
        string memory title,
        string memory description,
        uint256 newQuorum,
        uint256 duration
    ) external returns (uint256) {
        return _createProposal(
            ProposalType.SET_QUORUM,
            title,
            description,
            address(0),
            0,
            newQuorum,
            duration
        );
    }

    function proposeGeneral(
        string memory title,
        string memory description,
        uint256 duration
    ) external returns (uint256) {
        return _createProposal(
            ProposalType.GENERAL,
            title,
            description,
            address(0),
            0,
            0,
            duration
        );
    }

    function proposeSetTreasury(
        string memory title,
        string memory description,
        address newTreasury,
        uint256 duration
    ) external returns (uint256) {
        return _createProposal(
            ProposalType.SET_TREASURY,
            title,
            description,
            newTreasury,
            0,
            0,
            duration
        );
    }

    function proposeSetVoteFee(
        string memory title,
        string memory description,
        uint256 newFee,
        uint256 duration
    ) external returns (uint256) {
        return _createProposal(
            ProposalType.SET_VOTE_FEE,
            title,
            description,
            address(0),
            newFee,
            0,
            duration
        );
    }

    function proposeSetRegistrar(
        string memory title,
        string memory description,
        address newRegistrar,
        uint256 duration
    ) external returns (uint256) {
        return _createProposal(
            ProposalType.SET_REGISTRAR,
            title,
            description,
            newRegistrar,
            0,
            0,
            duration
        );
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
        require(token.isWhitelisted(msg.sender), "Not whitelisted");
        require(token.balanceOf(msg.sender) > 0, "Must hold UDT");
        require(duration >= 60, "Duration too short");

        proposalCount++;

        proposals[proposalCount] = Proposal({
            proposalType: pType,
            title: title,
            description: desc,
            target: target,
            amount: amount,
            newQuorum: newQuorum,
            deadline: block.timestamp + duration,
            yesVotes: 0,
            noVotes: 0,
            executed: false
        });

        emit ProposalCreated(proposalCount, pType, title);
        return proposalCount;
    }

    // ---- VOTING ----

    function vote(uint256 proposalId, bool support) external {
        require(proposalId > 0 && proposalId <= proposalCount, "Invalid proposal");
        Proposal storage p = proposals[proposalId];

        require(block.timestamp < p.deadline, "Voting ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        require(token.isWhitelisted(msg.sender), "Not whitelisted");
        require(token.balanceOf(msg.sender) > 0, "Must hold UDT");

        hasVoted[proposalId][msg.sender] = true;

        if (voteFee > 0) {
            require(token.transferFrom(msg.sender, treasury, voteFee), "Fee transfer failed");
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
        require(proposalId > 0 && proposalId <= proposalCount, "Invalid proposal");
        Proposal storage p = proposals[proposalId];

        require(block.timestamp >= p.deadline, "Voting not ended");
        require(!p.executed, "Already finalized");
        require(p.yesVotes + p.noVotes >= minQuorum, "Quorum not reached");

        p.executed = true;
        bool passed = p.yesVotes > p.noVotes;

        if (passed) {
            _execute(p);
        }

        emit ProposalFinalized(proposalId, passed);
    }

    // ---- EXECUTION ----

    function _execute(Proposal storage p) internal {
        if (p.proposalType == ProposalType.SET_QUORUM) {
            require(p.newQuorum > 0, "Invalid quorum");
            minQuorum = p.newQuorum;
        } else if (p.proposalType == ProposalType.SET_TREASURY) {
            require(p.target != address(0), "Invalid treasury");
            treasury = p.target;
            emit TreasuryUpdated(p.target);
        } else if (p.proposalType == ProposalType.SET_VOTE_FEE) {
            voteFee = p.amount;
            emit VoteFeeUpdated(p.amount);
        } else if (p.proposalType == ProposalType.SET_REGISTRAR) {
            require(p.target != address(0), "Invalid registrar");
            registrar = p.target;
            emit RegistrarUpdated(p.target);
        } else {
            // GENERAL: no on-chain action
        }
    }
}
