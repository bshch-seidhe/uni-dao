import { useState } from "react";

const TYPES = [
  { value: "GENERAL", label: "General" },
  { value: "SET_QUORUM", label: "Set quorum" },
  { value: "SET_TREASURY", label: "Set treasury" },
  { value: "SET_VOTE_FEE", label: "Set vote fee" },
  { value: "SET_REGISTRAR", label: "Set registrar" },
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

  function handleSubmit(e) {
    e.preventDefault();
    onCreate({
      type,
      title,
      description,
      target,
      amount,
      newQuorum,
      duration: Number(duration),
    });
    reset();
  }

  const needsTarget = ["SET_TREASURY", "SET_REGISTRAR"].includes(type);
  const needsAmount = ["SET_VOTE_FEE"].includes(type);
  const needsQuorum = type === "SET_QUORUM";

  return (
    <form onSubmit={handleSubmit} style={{ border: "1px solid #333", padding: "16px" }}>
      <h2>Create Proposal</h2>

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
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>

      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
      </label>

      {needsTarget && (
        <label>
          Target address
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
          New quorum
          <input value={newQuorum} onChange={(e) => setNewQuorum(e.target.value)} required />
        </label>
      )}

      <label>
        Duration (seconds)
        <input value={duration} onChange={(e) => setDuration(e.target.value)} required />
      </label>

      <button type="submit">Submit Proposal</button>
    </form>
  );
}

export default CreateProposal;
