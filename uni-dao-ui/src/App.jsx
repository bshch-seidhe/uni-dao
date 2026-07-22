import { useState } from "react";
import "./App.css";
import ConnectWallet from "./components/ConnectWallet";
import ProposalList from "./components/ProposalList";
import CreateProposal from "./components/CreateProposal";
import RegistrarPanel from "./components/RegistrarPanel";
import { useDao } from "./hooks/useDao";
import { ethers } from "ethers";

function shortAddr(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function sameAddr(a, b) {
  return a && b && a.toLowerCase() === b.toLowerCase();
}

function App() {
  const [account, setAccount] = useState(null);
  const {
    proposalCount,
    proposals,
    quorumBps,
    currentQuorum,
    memberCount,
    voteFee,
    treasury,
    registrar,
    balance,
    isMember,
    vote,
    finalize,
    cancel,
    createProposal,
    registrarAddStudent,
    registrarAddStudents,
    registrarRemoveStudent,
    registrarMint,
    loading,
    error,
  } = useDao(account);

  const isRegistrar = sameAddr(account, registrar);

  return (
    <div className="app">
      <header className="hero">
        <h1>UniDAO</h1>
        <p className="subtitle">Student voting, on-chain, one person = one vote.</p>
      </header>

      <ConnectWallet onConnect={setAccount} />

      {account && (
        <section className="account-panel">
          <div className="account-group">
            <h3>Your account</h3>
            <div className="stat-grid">
              <div className="stat">
                <span className="stat-label">Address</span>
                <span className="stat-value mono" title={account}>{shortAddr(account)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Balance</span>
                <span className="stat-value">
                  {balance != null ? ethers.formatUnits(balance, 18) : "—"} UDT
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Status</span>
                <span className={`badge ${isMember ? "badge-ok" : "badge-off"}`}>
                  {isMember ? "Member" : "Not a member"}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Role</span>
                <span className="stat-value">
                  {isRegistrar ? "Registrar" : "Member"}
                </span>
              </div>
            </div>
          </div>

          <div className="account-group">
            <h3>DAO</h3>
            <div className="stat-grid">
              <div className="stat">
                <span className="stat-label">Vote fee</span>
                <span className="stat-value">
                  {voteFee != null ? ethers.formatUnits(voteFee, 18) : "—"} UDT
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Quorum</span>
                <span className="stat-value">
                  {quorumBps != null ? `${quorumBps / 100}%` : "—"}
                  {currentQuorum != null ? ` (${currentQuorum} votes)` : ""}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Members</span>
                <span className="stat-value">{memberCount ?? "—"}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Proposals</span>
                <span className="stat-value">{proposalCount ?? "—"}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Treasury</span>
                <span className="stat-value mono" title={treasury}>
                  {treasury ? shortAddr(treasury) : "—"}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Registrar</span>
                <span className="stat-value mono" title={registrar}>
                  {registrar ? shortAddr(registrar) : "—"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {account && isRegistrar && (
        <RegistrarPanel
          onAddStudent={registrarAddStudent}
          onAddStudents={registrarAddStudents}
          onRemoveStudent={registrarRemoveStudent}
          onMint={registrarMint}
        />
      )}

      {account && (
        <div className="grid">
          <CreateProposal onCreate={createProposal} />
          <div>
            {loading && <p>Loading proposals...</p>}
            <ProposalList
              proposals={proposals}
              account={account}
              onVote={vote}
              onFinalize={finalize}
              onCancel={cancel}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
