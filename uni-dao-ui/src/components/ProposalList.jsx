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
  { label: "active", className: "badge-ok" }, // 0
  { label: "awaiting finalize", className: "badge-warn" }, // 1
  { label: "passed", className: "badge-done" }, // 2
  { label: "failed", className: "badge-off" }, // 3
  { label: "cancelled", className: "badge-muted" }, // 4
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

// The bar's full width is the quorum, or the votes cast once they exceed it.
function VoteBar({ yes, no, quorum, hasVoted }) {
  const cast = yes + no;
  const scale = Math.max(quorum, cast, 1);
  const reached = cast >= quorum;

  return (
    <div className="votes">
      <div
        className="vote-bar"
        role="img"
        aria-label={`${yes} yes, ${no} no, ${cast} of ${quorum} votes needed for quorum`}
      >
        <span className="vote-yes" style={{ width: `${(yes / scale) * 100}%` }} />
        <span className="vote-no" style={{ width: `${(no / scale) * 100}%` }} />
      </div>
      <p className="vote-legend">
        <span className="yes">yes {yes}</span>
        <span className="no">no {no}</span>
        <span className={reached ? "yes" : "muted"}>
          {reached ? "quorum reached" : `quorum ${cast}/${quorum}`}
        </span>
        {hasVoted && <span className="muted">you voted</span>}
      </p>
    </div>
  );
}

function ProposalList({ proposals, account, onVote, onFinalize, onCancel }) {
  if (!proposals.length) {
    return <p className="empty">No proposals yet. Create the first one with the new proposal form.</p>;
  }

  return (
    <div className="proposal-list">
      {proposals.map((p) => {
        const status = statusOf(p);
        const canVote = p.state === 0 && !p.hasVoted;
        const canFinalize = p.state === 1;
        const canCancel = p.state === 0 && p.yesVotes + p.noVotes === 0 && sameAddr(account, p.proposer);

        return (
          <article key={p.id} className="proposal">
            <header className="proposal-head">
              <span className="proposal-id">#{p.id}</span>
              <span className="proposal-type">{proposalTypeLabel(p.proposalType)}</span>
              <span className={`badge ${status.className}`}>{status.label}</span>
            </header>

            <h3 className="proposal-title">{p.title}</h3>
            {p.description && <p className="proposal-desc">{p.description}</p>}

            <dl className="kv">
              <dt>proposer</dt>
              <dd>
                <span className="addr" title={p.proposer}>{shortAddr(p.proposer)}</span>
                {sameAddr(account, p.proposer) && <span className="you"> (you)</span>}
              </dd>
              {TARGET_TYPES.has(p.proposalType) && (
                <>
                  <dt>target</dt>
                  <dd><span className="addr" title={p.target}>{shortAddr(p.target)}</span></dd>
                </>
              )}
              {AMOUNT_TYPES.has(p.proposalType) && (
                <>
                  <dt>{amountLabel(p.proposalType).toLowerCase()}</dt>
                  <dd>{formatAmount(p.amount)} UDT</dd>
                </>
              )}
              {p.proposalType === 0 && (
                <>
                  <dt>new quorum</dt>
                  <dd>{Number(p.newQuorum) / 100}% ({p.newQuorum} bps)</dd>
                </>
              )}
              <dt>deadline</dt>
              <dd>{formatTime(p.deadline)}</dd>
            </dl>

            <VoteBar yes={p.yesVotes} no={p.noVotes} quorum={p.quorum} hasVoted={p.hasVoted} />

            {(canVote || canFinalize || canCancel) && (
              <div className="actions">
                {canVote && (
                  <>
                    <button className="btn-yes" onClick={() => onVote(p.id, true)}>Vote yes</button>
                    <button className="btn-no" onClick={() => onVote(p.id, false)}>Vote no</button>
                  </>
                )}
                {canFinalize && (
                  <button className="btn-primary" onClick={() => onFinalize(p.id)}>Finalize</button>
                )}
                {canCancel && (
                  <button onClick={() => onCancel(p.id)}>Cancel proposal</button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export default ProposalList;
