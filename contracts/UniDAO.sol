// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

contract UniDAO {
    struct Proposal {
        string description;
        uint256 deadline;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
    }

    IERC20 public immutable token;
    uint256 public proposalCount;
    uint256 public constant MIN_QUORUM = 1; // MVP: мінімум 1 голос

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // --- EVENTS ---
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed creator,
        string description,
        uint256 deadline
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support
    );

    event ProposalFinalized(
        uint256 indexed proposalId,
        bool passed
    );

    constructor(address _token) {
        token = IERC20(_token);
    }

    // --- CREATE PROPOSAL ---
    function createProposal(
        string calldata description,
        uint256 durationSeconds
    ) external returns (uint256) {
        require(token.balanceOf(msg.sender) > 0, "Must hold UDT");

        require(durationSeconds > 0, "Invalid duration");

        proposalCount++;

        proposals[proposalCount] = Proposal({
            description: description,
            deadline: block.timestamp + durationSeconds,
            yesVotes: 0,
            noVotes: 0,
            executed: false
        });

        emit ProposalCreated(
            proposalCount,
            msg.sender,
            description,
            block.timestamp + durationSeconds
        );

        return proposalCount;
    }

    // --- VOTE (1 address = 1 vote) ---
    function vote(uint256 proposalId, bool support) external {
        require(proposalId > 0 && proposalId <= proposalCount, "Invalid proposal");

        Proposal storage proposal = proposals[proposalId];

        require(block.timestamp < proposal.deadline, "Voting ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        require(token.balanceOf(msg.sender) > 0, "Must hold UDT");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            proposal.yesVotes += 1;
        } else {
            proposal.noVotes += 1;
        }

        emit VoteCast(proposalId, msg.sender, support);
    }

    // --- FINALIZE ---
    function finalize(uint256 proposalId) external {
        require(proposalId > 0 && proposalId <= proposalCount, "Invalid proposal");

        Proposal storage proposal = proposals[proposalId];

        require(block.timestamp >= proposal.deadline, "Voting not ended");
        require(!proposal.executed, "Already finalized");
        require(
            proposal.yesVotes + proposal.noVotes >= MIN_QUORUM,
            "Quorum not reached"
        );

        proposal.executed = true;

        bool passed = proposal.yesVotes > proposal.noVotes;

        emit ProposalFinalized(proposalId, passed);
    }

    // --- READ RESULT ---
    function proposalPassed(uint256 proposalId) external view returns (bool) {
        require(proposalId > 0 && proposalId <= proposalCount, "Invalid proposal");

        Proposal memory p = proposals[proposalId];
        return p.yesVotes > p.noVotes;
    }
}