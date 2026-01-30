import { useEffect, useState } from "react";
import { ethers } from "ethers";
import UniDAOAbi from "../contracts/UniDAO.json";
import { DAO_ADDRESS } from "../utils/constants";

export function useDao(account) {
  const [proposalCount, setProposalCount] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [error, setError] = useState("");

  async function vote(proposalId, support) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const dao = new ethers.Contract(
        DAO_ADDRESS,
        UniDAOAbi,
        signer
      );

      const tx = await dao.vote(proposalId, support);
      await tx.wait();
    } catch (e) {
      console.error(e);
      setError("Vote failed");
    }
  }

  useEffect(() => {
    if (!account) return;

    async function load() {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const dao = new ethers.Contract(
          DAO_ADDRESS,
          UniDAOAbi,
          provider
        );

        const count = Number(await dao.proposalCount());
        setProposalCount(count);

        const items = [];
        for (let i = 1; i <= count; i++) {
          const p = await dao.proposals(i);
          items.push({
            id: i,
            proposalType: Number(p.proposalType),
            description: p.description,
            target: p.target,
            amount: p.amount.toString(),
            deadline: Number(p.deadline),
            yesVotes: Number(p.yesVotes),
            noVotes: Number(p.noVotes),
            executed: p.executed,
          });
        }

        setProposals(items);
      } catch (e) {
        setError("Failed to load proposals");
      }
    }

    load();
  }, [account]);

  return { proposalCount, proposals, vote, error };
}