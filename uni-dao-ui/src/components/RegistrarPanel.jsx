import { useState } from "react";

function parseAddressList(text) {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function RegistrarPanel({ onAddStudent, onAddStudents, onRemoveStudent, onMint }) {
  const [studentAddr, setStudentAddr] = useState("");
  const [batchAddrs, setBatchAddrs] = useState("");
  const [mintAddr, setMintAddr] = useState("");
  const [mintAmount, setMintAmount] = useState("");

  async function handleAdd(e) {
    e.preventDefault();
    const ok = await onAddStudent(studentAddr);
    if (ok) setStudentAddr("");
  }

  async function handleRemove() {
    const ok = await onRemoveStudent(studentAddr);
    if (ok) setStudentAddr("");
  }

  async function handleBatchAdd(e) {
    e.preventDefault();
    const addresses = parseAddressList(batchAddrs);
    if (addresses.length === 0) return;
    const ok = await onAddStudents(addresses);
    if (ok) setBatchAddrs("");
  }

  async function handleMint(e) {
    e.preventDefault();
    const ok = await onMint(mintAddr, mintAmount);
    if (ok) {
      setMintAddr("");
      setMintAmount("");
    }
  }

  return (
    <div className="tile-row">
      <form className="tile" onSubmit={handleAdd}>
        <h2 className="tile-title">registrar: student</h2>
        <label>
          Student address
          <input
            value={studentAddr}
            onChange={(e) => setStudentAddr(e.target.value)}
            placeholder="0x…"
            required
          />
        </label>
        <div className="actions">
          <button type="submit" className="btn-primary">Add student</button>
          <button type="button" className="btn-danger" onClick={handleRemove} disabled={!studentAddr}>
            Remove student
          </button>
        </div>
      </form>

      <form className="tile" onSubmit={handleBatchAdd}>
        <h2 className="tile-title">registrar: add many</h2>
        <label>
          Student addresses
          <span className="field-hint">Separate with commas or new lines</span>
          <textarea
            value={batchAddrs}
            onChange={(e) => setBatchAddrs(e.target.value)}
            placeholder={"0x…\n0x…\n0x…"}
            required
          />
        </label>
        <div className="actions">
          <button type="submit" className="btn-primary">Add students</button>
        </div>
      </form>

      <form className="tile" onSubmit={handleMint}>
        <h2 className="tile-title">registrar: mint UDT</h2>
        <label>
          Recipient address
          <input
            value={mintAddr}
            onChange={(e) => setMintAddr(e.target.value)}
            placeholder="0x…"
            required
          />
        </label>
        <label>
          Amount (UDT)
          <input
            value={mintAmount}
            onChange={(e) => setMintAmount(e.target.value)}
            placeholder="1"
            required
          />
        </label>
        <div className="actions">
          <button type="submit" className="btn-primary">Mint</button>
        </div>
      </form>
    </div>
  );
}

export default RegistrarPanel;
