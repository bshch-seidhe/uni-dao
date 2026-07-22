import { ethers } from "ethers";

const TYPE_LABELS = [
  "SET_QUORUM",
  "GENERAL",
  "SET_TREASURY",
  "SET_VOTE_FEE",
  "SET_REGISTRAR",
  "SET_TOKEN_OWNER",
  "SET_MEMBER_GRANT",
  "TRANSFER",
];

const TARGET_TYPES = new Set([2, 4, 5, 7]); // SET_TREASURY, SET_REGISTRAR, SET_TOKEN_OWNER, TRANSFER
const AMOUNT_TYPES = new Set([3, 6, 7]); // SET_VOTE_FEE, SET_MEMBER_GRANT, TRANSFER

const STATE_LABELS = [
  { label: "Active", className: "badge-ok" }, // 0
  { label: "Awaiting finalize", className: "badge-warn" }, // 1
  { label: "Passed", className: "badge-ok" }, // 2
  { label: "Failed", className: "badge-off" }, // 3
  { label: "Cancelled", className: "badge-off" }, // 4
];

function proposalTypeLabel(t) {
  return TYPE_LABELS[t] ?? "UNKNOWN";
}

function amountLabel(t) {
  if (t === 3) return "New fee";
  if (t === 6) return "New member grant";
  return "Amount";
}

function formatTime(ts) {
  return new Date(ts * 1000).toLocaleString();
}

function formatAmount(value) {
  try {
    return ethers.formatUnits(value, 18);
  } catch {
    return value;
  }
}

function shortAddr(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function sameAddr(a, b) {
  return a && b && a.toLowerCase() === b.toLowerCase();
}

function statusOf(p) {
  return STATE_LABELS[p.state] ?? { label: "Unknown", className: "badge-off" };
}

function ProposalList({ proposals, account, onVote, onFinalize, onCancel }) {
  if (!proposals.length) return <p>No proposals yet</p>;

  return (
    <div>
      <h2>Proposals</h2>

      {proposals.map((p) => {
        const status = statusOf(p);
        const canVote = p.state === 0 && !p.hasVoted;
        const canFinalize = p.state === 1;
        const canCancel = p.state === 0 && p.yesVotes + p.noVotes === 0 && sameAddr(account, p.proposer);

        return (
          <div key={p.id} className="card">
            <p><b>ID:</b> {p.id}</p>
            <p><b>Type:</b> {proposalTypeLabel(p.proposalType)}</p>
            <p><b>Title:</b> {p.title}</p>
            <p><b>Description:</b> {p.description}</p>
            <p>
              <b>Proposer:</b>{" "}
              <span className="mono" title={p.proposer}>{shortAddr(p.proposer)}</span>
              {sameAddr(account, p.proposer) ? " (you)" : ""}
            </p>
            {TARGET_TYPES.has(p.proposalType) ? (
              <p><b>Target:</b> <span className="mono" title={p.target}>{shortAddr(p.target)}</span></p>
            ) : null}
            {AMOUNT_TYPES.has(p.proposalType) ? (
              <p><b>{amountLabel(p.proposalType)}:</b> {formatAmount(p.amount)} UDT</p>
            ) : null}
            {p.proposalType === 0 ? (
              <p><b>New quorum (bps):</b> {p.newQuorum}</p>
            ) : null}
            <p><b>Quorum to pass:</b> {p.quorum}</p>
            <p><b>Deadline:</b> {formatTime(p.deadline)}</p>
            <p>
              <b>Votes:</b> ✅ {p.yesVotes} / ❌ {p.noVotes}
              {p.hasVoted ? " — you voted" : ""}
            </p>
            <p>
              <b>Status:</b>{" "}
              <span className={`badge ${status.className}`}>{status.label}</span>
            </p>

            <div style={{ display: "flex", gap: "8px" }}>
              {canVote && (
                <>
                  <button onClick={() => onVote(p.id, true)}>Vote Yes</button>
                  <button onClick={() => onVote(p.id, false)}>Vote No</button>
                </>
              )}
              {canFinalize && (
                <button onClick={() => onFinalize(p.id)}>Finalize</button>
              )}
              {canCancel && (
                <button onClick={() => onCancel(p.id)}>Cancel</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ProposalList;
