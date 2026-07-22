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

  function handleAdd(e) {
    e.preventDefault();
    onAddStudent(studentAddr);
    setStudentAddr("");
  }

  function handleRemove() {
    onRemoveStudent(studentAddr);
    setStudentAddr("");
  }

  function handleBatchAdd(e) {
    e.preventDefault();
    const addresses = parseAddressList(batchAddrs);
    if (addresses.length === 0) return;
    onAddStudents(addresses);
    setBatchAddrs("");
  }

  function handleMint(e) {
    e.preventDefault();
    onMint(mintAddr, mintAmount);
    setMintAddr("");
    setMintAmount("");
  }

  return (
    <section className="account-panel">
      <div className="account-group">
        <h3>Registrar: students</h3>
        <form onSubmit={handleAdd}>
          <label>
            Student address
            <input
              value={studentAddr}
              onChange={(e) => setStudentAddr(e.target.value)}
              placeholder="0x…"
              required
            />
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit">Add student</button>
            <button type="button" onClick={handleRemove} disabled={!studentAddr}>
              Remove student
            </button>
          </div>
        </form>
      </div>

      <div className="account-group">
        <h3>Registrar: add multiple students</h3>
        <form onSubmit={handleBatchAdd}>
          <label>
            Student addresses (comma or newline separated)
            <textarea
              value={batchAddrs}
              onChange={(e) => setBatchAddrs(e.target.value)}
              placeholder={"0x...\n0x...\n0x..."}
              required
            />
          </label>
          <button type="submit">Add students</button>
        </form>
      </div>

      <div className="account-group">
        <h3>Registrar: mint UDT</h3>
        <form onSubmit={handleMint}>
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
          <button type="submit">Mint</button>
        </form>
      </div>
    </section>
  );
}

export default RegistrarPanel;
