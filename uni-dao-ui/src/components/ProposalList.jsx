function proposalTypeLabel(t) {
  if (t === 0) return "MINT";
  if (t === 1) return "BURN";
  if (t === 2) return "SET_QUORUM";
  return "UNKNOWN";
}

function formatTime(ts) {
  return new Date(ts * 1000).toLocaleString();
}

function ProposalList({ proposals }) {
  if (!proposals.length) return <p>No proposals yet</p>;

  return (
    <div>
      <h2>Proposals</h2>

      {proposals.map((p) => (
        <div
          key={p.id}
          style={{
            border: "1px solid #444",
            padding: "12px",
            marginBottom: "10px",
          }}
        >
          <p><b>ID:</b> {p.id}</p>
          <p><b>Type:</b> {proposalTypeLabel(p.proposalType)}</p>
          <p><b>Description:</b> {p.description}</p>
          <p><b>Target:</b> {p.target}</p>
          <p><b>Amount:</b> {p.amount}</p>
          <p><b>Deadline:</b> {formatTime(p.deadline)}</p>
          <p>
            <b>Votes:</b> ✅ {p.yesVotes} / ❌ {p.noVotes}
          </p>
          <p>
            <b>Status:</b>{" "}
            {p.executed
              ? "Executed"
              : Date.now() / 1000 > p.deadline
              ? "Ended"
              : "Active"}
          </p>
        </div>
      ))}
    </div>
  );
}

export default ProposalList;