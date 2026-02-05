import { useEffect, useState } from "react";
import { ethers } from "ethers";
import UniDAOAbi from "../contracts/UniDAO.json";
import UniTokenAbi from "../contracts/UniToken.json";
import { DAO_ADDRESS, TOKEN_ADDRESS } from "../utils/constants";

export function useDao(account) {
  const [proposalCount, setProposalCount] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [minQuorum, setMinQuorum] = useState(null);
  const [voteFee, setVoteFee] = useState(null);
  const [treasury, setTreasury] = useState(null);
  const [registrar, setRegistrar] = useState(null);
  const [balance, setBalance] = useState(null);
  const [whitelisted, setWhitelisted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function approveAndVote(proposalId, support) {
    try {
      setError("");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const dao = new ethers.Contract(
        DAO_ADDRESS,
        UniDAOAbi.abi,
        signer
      );

      const token = new ethers.Contract(
        TOKEN_ADDRESS,
        UniTokenAbi.abi,
        signer
      );

      const fee = await dao.voteFee();
      if (fee > 0n) {
        const approveTx = await token.approve(DAO_ADDRESS, fee);
        await approveTx.wait();
      }

      const tx = await dao.vote(proposalId, support);
      await tx.wait();
      await refresh();
    } catch (e) {
      console.error(e);
      setError("Vote failed");
    }
  }

  async function finalize(proposalId) {
    try {
      setError("");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const dao = new ethers.Contract(DAO_ADDRESS, UniDAOAbi.abi, signer);
      const tx = await dao.finalize(proposalId);
      await tx.wait();
      await refresh();
    } catch (e) {
      console.error(e);
      setError("Finalize failed");
    }
  }

  async function createProposal(payload) {
    try {
      setError("");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const dao = new ethers.Contract(DAO_ADDRESS, UniDAOAbi.abi, signer);

      let tx;
      if (payload.type === "GENERAL") {
        tx = await dao.proposeGeneral(payload.title, payload.description, payload.duration);
      } else if (payload.type === "SET_QUORUM") {
        tx = await dao.proposeSetQuorum(
          payload.title,
          payload.description,
          payload.newQuorum,
          payload.duration
        );
      } else if (payload.type === "SET_TREASURY") {
        tx = await dao.proposeSetTreasury(
          payload.title,
          payload.description,
          payload.target,
          payload.duration
        );
      } else if (payload.type === "SET_VOTE_FEE") {
        tx = await dao.proposeSetVoteFee(
          payload.title,
          payload.description,
          ethers.parseUnits(payload.amount, 18),
          payload.duration
        );
      } else if (payload.type === "SET_REGISTRAR") {
        tx = await dao.proposeSetRegistrar(
          payload.title,
          payload.description,
          payload.target,
          payload.duration
        );
      } else {
        throw new Error("Unknown proposal type");
      }

      await tx.wait();
      await refresh();
    } catch (e) {
      console.error(e);
      setError("Create proposal failed");
    }
  }

  async function refresh() {
    if (!account) return;
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const dao = new ethers.Contract(DAO_ADDRESS, UniDAOAbi.abi, provider);
      const token = new ethers.Contract(TOKEN_ADDRESS, UniTokenAbi.abi, provider);

      const count = Number(await dao.proposalCount());
      setProposalCount(count);
      setMinQuorum(Number(await dao.minQuorum()));
      setVoteFee(await dao.voteFee());
      setTreasury(await dao.treasury());
      setRegistrar(await dao.registrar());

      const bal = await token.balanceOf(account);
      setBalance(bal);
      const wl = await token.isWhitelisted(account);
      setWhitelisted(wl);

      const items = [];
      for (let i = 1; i <= count; i++) {
        const p = await dao.proposals(i);
        items.push({
          id: i,
          proposalType: Number(p.proposalType),
          title: p.title,
          description: p.description,
          target: p.target,
          amount: p.amount.toString(),
          newQuorum: p.newQuorum.toString(),
          deadline: Number(p.deadline),
          yesVotes: Number(p.yesVotes),
          noVotes: Number(p.noVotes),
          executed: p.executed,
        });
      }

      setProposals(items);
    } catch (e) {
      console.error("DAO load error:", e);
      setError("Failed to load proposals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!account) return;
    refresh();
  }, [account]);

  return {
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
    refresh,
    loading,
    error,
  };
}
