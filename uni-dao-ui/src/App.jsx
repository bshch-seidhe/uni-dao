import { useState } from "react";
import "./App.css";
import ConnectWallet from "./components/ConnectWallet";
import ProposalList from "./components/ProposalList";
import CreateProposal from "./components/CreateProposal";
import { useDao } from "./hooks/useDao";
import { ethers } from "ethers";

function App() {
  const [account, setAccount] = useState(null);
  const {
    proposalCount,
    proposals,
    minQuorum,
    voteFee,
    treasury,
    registrar,
    balance,
    whitelisted,
    approveAndVote,
    finalize,
    createProposal,
    loading,
    error,
  } = useDao(account);

  return (
    <div className="app">
      <header className="hero">
        <h1>UniDAO</h1>
        <p className="subtitle">Student voting, on-chain, one person = one vote.</p>
      </header>

      <ConnectWallet onConnect={setAccount} />

      {account && (
        <div className="wallet-info">
          <div><b>Account:</b> {account}</div>
          <div><b>Whitelisted:</b> {whitelisted ? "Yes" : "No"}</div>
          <div><b>Balance:</b> {balance ? ethers.formatUnits(balance, 18) : "0"} UDT</div>
          <div><b>Vote fee:</b> {voteFee ? ethers.formatUnits(voteFee, 18) : "0"} UDT</div>
          <div><b>Min quorum:</b> {minQuorum ?? "-"}</div>
          <div><b>Treasury:</b> {treasury ?? "-"}</div>
          <div><b>Registrar:</b> {registrar ?? "-"}</div>
        </div>
      )}

      {proposalCount !== null && (
        <p>Total proposals: <b>{proposalCount}</b></p>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {account && (
        <div className="grid">
          <CreateProposal onCreate={createProposal} />
          <div>
            {loading && <p>Loading proposals...</p>}
            <ProposalList
              proposals={proposals}
              onVote={approveAndVote}
              onFinalize={finalize}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
