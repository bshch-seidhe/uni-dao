import { useState } from "react";
const byteLen = (s) => new TextEncoder().encode(s).length;

const TYPES = [
  { value: "GENERAL", label: "General" },
  { value: "SET_QUORUM", label: "Set quorum" },
  { value: "SET_TREASURY", label: "Set treasury" },
  { value: "SET_VOTE_FEE", label: "Set vote fee" },
  { value: "SET_REGISTRAR", label: "Set registrar" },
  { value: "SET_TOKEN_OWNER", label: "Set token owner" },
  { value: "SET_MEMBER_GRANT", label: "Set member grant" },
  { value: "TRANSFER", label: "Transfer treasury funds" },
];

function CreateProposal({ onCreate }) {
  const [type, setType] = useState("GENERAL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const [newQuorum, setNewQuorum] = useState("");
  const [duration, setDuration] = useState("3600");

  function reset() {
    setTitle("");
    setDescription("");
    setTarget("");
    setAmount("");
    setNewQuorum("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (byteLen(title) > 128) return alert("Title too long (128 bytes max)");
    if (byteLen(description) > 1024) return alert("Description too long (1024 bytes max)");
    const ok = await onCreate({
      type,
      title,
      description,
      target,
      amount,
      newQuorum,
      duration: Number(duration),
    });
    if (ok) reset();
  }

  const needsTarget = ["SET_TREASURY", "SET_REGISTRAR", "SET_TOKEN_OWNER", "TRANSFER"].includes(type);
  const needsAmount = ["SET_VOTE_FEE", "SET_MEMBER_GRANT", "TRANSFER"].includes(type);
  const needsQuorum = type === "SET_QUORUM";

  return (
    <form className="tile" onSubmit={handleSubmit}>
      <h2 className="tile-title">new proposal</h2>

      <label>
        Type
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={128} required />
      </label>

      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1024}
          required
        />
      </label>

      {needsTarget && (
        <label>
          {type === "TRANSFER" ? "Recipient address" : "Target address"}
          <input value={target} onChange={(e) => setTarget(e.target.value)} required />
        </label>
      )}

      {needsAmount && (
        <label>
          Amount (UDT)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
      )}

      {needsQuorum && (
        <label>
          New quorum (basis points)
          <span className="field-hint">3000 = 30% of members</span>
          <input value={newQuorum} onChange={(e) => setNewQuorum(e.target.value)} required />
        </label>
      )}

      <label>
        Duration (seconds)
        <span className="field-hint">120 s minimum, 2592000 s (30 days) maximum</span>
        <input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          min="120"
          max="2592000"
          type="number"
          required
        />
      </label>

      <button type="submit" className="btn-primary">Create proposal</button>
    </form>
  );
}

export default CreateProposal;
