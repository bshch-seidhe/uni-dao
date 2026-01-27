// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

interface IMintableBurnableERC20 {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

contract UniDAO {
    // ---- TYPES ----
    enum ProposalType {
        MINT,
        BURN,
        SET_QUORUM
    }

    struct Proposal {
        ProposalType proposalType;
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
    IERC20 public immutable token;
    IMintableBurnableERC20 public immutable governableToken;

    uint256 public proposalCount;
    uint256 public minQuorum;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // ---- EVENTS ----
    event ProposalCreated(uint256 indexed id, ProposalType proposalType);
    event VoteCast(uint256 indexed id, address voter, bool support);
    event ProposalFinalized(uint256 indexed id, bool passed);

    constructor(address _token, uint256 _initialQuorum) {
        token = IERC20(_token);
        governableToken = IMintableBurnableERC20(_token);
        minQuorum = _initialQuorum;
    }

    // ---- CREATE PROPOSALS ----

    function proposeMint(
        address to,
        uint256 amount,
        uint256 duration
    ) external returns (uint256) {
        return _createProposal(
            ProposalType.MINT,
            "Mint tokens",
            to,
            amount,
            0,
            duration
        );
    }

    function proposeBurn(
        address from,
        uint256 amount,
        uint256 duration
    ) external returns (uint256) {
        return _createProposal(
            ProposalType.BURN,
            "Burn tokens",
            from,
            amount,
            0,
            duration
        );
    }

    function proposeSetQuorum(
        uint256 newQuorum,
        uint256 duration
    ) external returns (uint256) {
        return _createProposal(
            ProposalType.SET_QUORUM,
            "Change quorum",
            address(0),
            0,
            newQuorum,
            duration
        );
    }

    function _createProposal(
        ProposalType pType,
        string memory desc,
        address target,
        uint256 amount,
        uint256 newQuorum,
        uint256 duration
    ) internal returns (uint256) {
        require(token.balanceOf(msg.sender) > 0, "Must hold UDT");
        require(duration > 0, "Invalid duration");

        proposalCount++;

        proposals[proposalCount] = Proposal({
            proposalType: pType,
            description: desc,
            target: target,
            amount: amount,
            newQuorum: newQuorum,
            deadline: block.timestamp + duration,
            yesVotes: 0,
            noVotes: 0,
            executed: false
        });

        emit ProposalCreated(proposalCount, pType);
        return proposalCount;
    }

    // ---- VOTING ----

    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];

        require(block.timestamp < p.deadline, "Voting ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        require(token.balanceOf(msg.sender) > 0, "Must hold UDT");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            p.yesVotes += 1;
        } else {
            p.noVotes += 1;
        }

        emit VoteCast(proposalId, msg.sender, support);
    }

    // ---- FINALIZE ----

    function finalize(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];

        require(block.timestamp >= p.deadline, "Voting not ended");
        require(!p.executed, "Already finalized");
        require(
            p.yesVotes + p.noVotes >= minQuorum,
            "Quorum not reached"
        );

        p.executed = true;
        bool passed = p.yesVotes > p.noVotes;

        if (passed) {
            _execute(p);
        }

        emit ProposalFinalized(proposalId, passed);
    }

    // ---- EXECUTION ----

    function _execute(Proposal storage p) internal {
        if (p.proposalType == ProposalType.MINT) {
            governableToken.mint(p.target, p.amount);
        } 
        else if (p.proposalType == ProposalType.BURN) {
            governableToken.burn(p.target, p.amount);
        } 
        else if (p.proposalType == ProposalType.SET_QUORUM) {
            minQuorum = p.newQuorum;
        }
    }
}