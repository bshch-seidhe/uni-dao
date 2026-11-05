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
    <>
      <header className="topbar">
        <span className="topbar-brand">
          <span className="logo" aria-hidden="true">&gt;_</span>
          uni-dao
        </span>
        <ConnectWallet onConnect={setAccount} />
      </header>

      <main className="app">
        <section className="hero">
          <p className="prompt">
            <span className="prompt-path">~/uni-dao</span> $
            <span className="caret" aria-hidden="true" />
          </p>
          <h1>Student voting, on-chain.</h1>
          <p className="subtitle">
            One member, one vote. Every proposal, vote and result is recorded on Ethereum Sepolia.
          </p>
          {!account && (
            <p className="hint">Connect a MetaMask wallet on Sepolia to see proposals and vote.</p>
          )}
        </section>

        {!account && (
          <section className="tile how-it-works">
            <h2 className="tile-title">how it works</h2>
            <ol className="steps">
              <li>
                Install MetaMask and switch it to the Sepolia test network. Get a little Sepolia
                ETH from a faucet to pay for gas.
              </li>
              <li>
                Ask the registrar to add your address. New members receive a UDT grant to pay
                vote fees.
              </li>
              <li>Vote yes or no on active proposals. Each vote costs the vote fee in UDT.</li>
              <li>When voting ends, anyone can finalize a proposal to record the result on-chain.</li>
            </ol>
          </section>
        )}

        {error && <p className="error" role="alert">error: {error}</p>}

        {account && (
          <div className="tile-row tile-row-account">
            <section className="tile">
              <h2 className="tile-title">account</h2>
              <dl className="stat-grid">
                <div className="stat">
                  <dt className="stat-label">address</dt>
                  <dd className="stat-value" title={account}>{shortAddr(account)}</dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">balance</dt>
                  <dd className="stat-value">
                    {balance != null ? ethers.formatUnits(balance, 18) : "—"} UDT
                  </dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">status</dt>
                  <dd className="stat-value">
                    <span className={`badge ${isMember ? "badge-ok" : "badge-off"}`}>
                      {isMember ? "member" : "not a member"}
                    </span>
                  </dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">role</dt>
                  <dd className="stat-value">{isRegistrar ? "Registrar" : (isMember ? "Member" : "—")}</dd>
                </div>
              </dl>
            </section>

            <section className="tile">
              <h2 className="tile-title">dao</h2>
              <dl className="stat-grid">
                <div className="stat">
                  <dt className="stat-label">vote fee</dt>
                  <dd className="stat-value">
                    {voteFee != null ? ethers.formatUnits(voteFee, 18) : "—"} UDT
                  </dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">quorum</dt>
                  <dd className="stat-value">
                    {quorumBps != null ? `${quorumBps / 100}%` : "—"}
                    {currentQuorum != null ? ` (${currentQuorum} votes)` : ""}
                  </dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">members</dt>
                  <dd className="stat-value">{memberCount ?? "—"}</dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">proposals</dt>
                  <dd className="stat-value">{proposalCount ?? "—"}</dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">treasury</dt>
                  <dd className="stat-value addr" title={treasury}>
                    {treasury ? shortAddr(treasury) : "—"}
                  </dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">registrar</dt>
                  <dd className="stat-value addr" title={registrar}>
                    {registrar ? shortAddr(registrar) : "—"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        )}

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
            <section className="tile">
              <h2 className="tile-title">
                proposals{proposalCount != null ? ` (${proposalCount})` : ""}
              </h2>
              {loading && !proposals.length ? (
                <p className="empty">Loading proposals…</p>
              ) : (
                <ProposalList
                  proposals={proposals}
                  account={account}
                  onVote={vote}
                  onFinalize={finalize}
                  onCancel={cancel}
                />
              )}
            </section>
          </div>
        )}
      </main>
    </>
  );
}

export default App;
