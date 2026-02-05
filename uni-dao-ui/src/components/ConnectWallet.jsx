import { useEffect, useState } from "react";
import { SEPOLIA_CHAIN_ID } from "../utils/constants";

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

      const acc = accounts[0];
      setAccount(acc);
      onConnect(acc);
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

  useEffect(() => {
    if (!window.ethereum) return;

    function handleAccountsChanged(accounts) {
      const acc = accounts?.[0] || null;
      setAccount(acc);
      onConnect(acc);
    }

    function handleChainChanged(chainId) {
      setNetworkOk(chainId === SEPOLIA_CHAIN_ID);
    }

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [onConnect]);

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
