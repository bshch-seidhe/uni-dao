function proposalTypeLabel(t) {
  if (t === 0) return "SET_QUORUM";
  if (t === 1) return "GENERAL";
  if (t === 2) return "SET_TREASURY";
  if (t === 3) return "SET_VOTE_FEE";
  if (t === 4) return "SET_REGISTRAR";
  return "UNKNOWN";
}

function formatTime(ts) {
  return new Date(ts * 1000).toLocaleString();
}

function formatAmount(value) {
  try {
    return (Number(value) / 1e18).toString();
  } catch {
    return value;
  }
}

function ProposalList({ proposals, onVote, onFinalize }) {
  if (!proposals.length) return <p>No proposals yet</p>;

  return (
    <div>
      <h2>Proposals</h2>

      {proposals.map((p) => (
        <div key={p.id} className="card">
          <p><b>ID:</b> {p.id}</p>
          <p><b>Type:</b> {proposalTypeLabel(p.proposalType)}</p>
          <p><b>Title:</b> {p.title}</p>
          <p><b>Description:</b> {p.description}</p>
          <p><b>Target:</b> {p.target}</p>
          <p><b>Amount:</b> {formatAmount(p.amount)}</p>
          <p><b>New quorum:</b> {p.newQuorum}</p>
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

          {!p.executed && Date.now() / 1000 <= p.deadline && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => onVote(p.id, true)}>Vote Yes</button>
              <button onClick={() => onVote(p.id, false)}>Vote No</button>
            </div>
          )}

          {!p.executed && Date.now() / 1000 > p.deadline && (
            <button onClick={() => onFinalize(p.id)}>Finalize</button>
          )}
        </div>
      ))}
    </div>
  );
}

export default ProposalList;
