import { useState } from "react";

const SEPOLIA_CHAIN_ID = "0xaa36a7";

function ConnectWallet({ onConnect }) {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");
  const [networkOk, setNetworkOk] = useState(false);

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setError("MetaMask not detected");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const chainId = await window.ethereum.request({
        method: "eth_chainId",
      });

      setAccount(accounts[0]);
      onConnect(accounts[0]);
      setNetworkOk(chainId === SEPOLIA_CHAIN_ID);
      setError("");
    } catch (err) {
      setError("Connection rejected");
    }
  }

  async function switchToSepolia() {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
      setNetworkOk(true);
    } catch (err) {
      setError("Failed to switch network");
    }
  }

  return (
    <div>
      {!account && (
        <button onClick={connectWallet}>
          Connect Wallet
        </button>
      )}

      {account && (
        <p>
          Connected: <b>{account}</b>
        </p>
      )}

      {account && !networkOk && (
        <button onClick={switchToSepolia}>
          Switch to Sepolia
        </button>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default ConnectWallet;