import { useState } from "react";
import ConnectWallet from "./components/ConnectWallet";
import ProposalList from "./components/ProposalList";
import { useDao } from "./hooks/useDao";

function App() {
  const [account, setAccount] = useState(null);
  const { proposalCount, proposals, error } = useDao(account);

  return (
    <div style={{ padding: "20px" }}>
      <h1>UniDAO</h1>

      <ConnectWallet onConnect={setAccount} />

      {proposalCount !== null && (
        <p>Total proposals: <b>{proposalCount}</b></p>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {account && <ProposalList proposals={proposals} />}
    </div>
  );
}

export default App;