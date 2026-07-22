import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import UniDAOAbi from "../contracts/UniDAO.json";
import UniTokenAbi from "../contracts/UniToken.json";
import { DAO_ADDRESS, TOKEN_ADDRESS } from "../utils/constants";

const PAGE_SIZE = 50;

function errMsg(e, fallback) {
  return e?.reason || e?.shortMessage || fallback;
}

export function useDao(account) {
  const [proposalCount, setProposalCount] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [quorumBps, setQuorumBps] = useState(null);
  const [currentQuorum, setCurrentQuorum] = useState(null);
  const [memberCount, setMemberCount] = useState(null);
  const [voteFee, setVoteFee] = useState(null);
  const [treasury, setTreasury] = useState(null);
  const [registrar, setRegistrar] = useState(null);
  const [balance, setBalance] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function daoWith(signerOrProvider) {
    return new ethers.Contract(DAO_ADDRESS, UniDAOAbi.abi, signerOrProvider);
  }

  function tokenWith(signerOrProvider) {
    return new ethers.Contract(TOKEN_ADDRESS, UniTokenAbi.abi, signerOrProvider);
  }

  async function withSigner(run, fallbackError) {
    try {
      setError("");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      await run(signer);
      await refresh();
    } catch (e) {
      console.error(e);
      setError(errMsg(e, fallbackError));
    }
  }

  async function vote(proposalId, support) {
    await withSigner(async (signer) => {
      const dao = daoWith(signer);
      const token = tokenWith(signer);
      const fee = await dao.voteFee();

      if (fee > 0n) {
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const [nonce, network] = await Promise.all([
          token.nonces(account),
          signer.provider.getNetwork(),
        ]);
        const domain = {
          name: "Uni DAO Token",
          version: "1",
          chainId: network.chainId,
          verifyingContract: TOKEN_ADDRESS,
        };
        const types = {
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        };
        const message = { owner: account, spender: DAO_ADDRESS, value: fee, nonce, deadline };
        const signature = await signer.signTypedData(domain, types, message);
        const sig = ethers.Signature.from(signature);
        const tx = await dao.voteWithPermit(proposalId, support, deadline, sig.v, sig.r, sig.s);
        await tx.wait();
      } else {
        const tx = await dao.vote(proposalId, support);
        await tx.wait();
      }
    }, "Vote failed");
  }

  async function finalize(proposalId) {
    await withSigner(async (signer) => {
      const tx = await daoWith(signer).finalize(proposalId);
      await tx.wait();
    }, "Finalize failed");
  }

  async function cancel(proposalId) {
    await withSigner(async (signer) => {
      const tx = await daoWith(signer).cancel(proposalId);
      await tx.wait();
    }, "Cancel failed");
  }

  async function registrarAddStudent(address) {
    await withSigner(async (signer) => {
      const tx = await daoWith(signer).registrarAddStudent(address);
      await tx.wait();
    }, "Add student failed");
  }

  async function registrarAddStudents(addresses) {
    await withSigner(async (signer) => {
      const tx = await daoWith(signer).registrarAddStudents(addresses);
      await tx.wait();
    }, "Add students failed");
  }

  async function registrarRemoveStudent(address) {
    await withSigner(async (signer) => {
      const tx = await daoWith(signer).registrarRemoveStudent(address);
      await tx.wait();
    }, "Remove student failed");
  }

  async function registrarMint(address, amountUdt) {
    await withSigner(async (signer) => {
      const tx = await daoWith(signer).registrarMint(
        address,
        ethers.parseUnits(amountUdt, 18)
      );
      await tx.wait();
    }, "Mint failed");
  }

  async function createProposal(payload) {
    await withSigner(async (signer) => {
      const dao = daoWith(signer);

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
      } else if (payload.type === "SET_TOKEN_OWNER") {
        tx = await dao.proposeSetTokenOwner(
          payload.title,
          payload.description,
          payload.target,
          payload.duration
        );
      } else if (payload.type === "SET_MEMBER_GRANT") {
        tx = await dao.proposeSetMemberGrant(
          payload.title,
          payload.description,
          ethers.parseUnits(payload.amount, 18),
          payload.duration
        );
      } else if (payload.type === "TRANSFER") {
        tx = await dao.proposeTransfer(
          payload.title,
          payload.description,
          payload.target,
          ethers.parseUnits(payload.amount, 18),
          payload.duration
        );
      } else {
        throw new Error("Unknown proposal type");
      }

      await tx.wait();
    }, "Create proposal failed");
  }

  const refresh = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const dao = daoWith(provider);
      const token = tokenWith(provider);

      const [count, qBps, curQuorum, members, fee, treas, reg, bal, member] = await Promise.all([
        dao.proposalCount(),
        dao.quorumBps(),
        dao.currentQuorum(),
        dao.memberCount(),
        dao.voteFee(),
        dao.treasury(),
        dao.registrar(),
        token.balanceOf(account),
        dao.isMember(account),
      ]);

      setProposalCount(Number(count));
      setQuorumBps(Number(qBps));
      setCurrentQuorum(Number(curQuorum));
      setMemberCount(Number(members));
      setVoteFee(fee);
      setTreasury(treas);
      setRegistrar(reg);
      setBalance(bal);
      setIsMember(member);

      const total = Number(count);
      const pages = [];
      for (let offset = 0; offset < total; offset += PAGE_SIZE) {
        pages.push(dao.getProposals(offset, Math.min(PAGE_SIZE, total - offset)));
      }
      const pageResults = await Promise.all(pages);
      const flat = pageResults.flat();

      const items = await Promise.all(
        flat.map(async (p, i) => {
          const id = i + 1;
          const [voted, state] = await Promise.all([
            dao.hasVoted(id, account),
            dao.state(id),
          ]);
          return {
            id,
            proposalType: Number(p.proposalType),
            proposer: p.proposer,
            title: p.title,
            description: p.description,
            target: p.target,
            amount: p.amount.toString(),
            newQuorum: p.newQuorum.toString(),
            quorum: Number(p.quorum),
            deadline: Number(p.deadline),
            yesVotes: Number(p.yesVotes),
            noVotes: Number(p.noVotes),
            finalized: p.finalized,
            passed: p.passed,
            cancelled: p.cancelled,
            state: Number(state),
            hasVoted: voted,
          };
        })
      );

      setProposals(items);
    } catch (e) {
      console.error("DAO load error:", e);
      setError(errMsg(e, "Failed to load proposals"));
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    if (!account) return;
    refresh();
  }, [account, refresh]);

  return {
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
    refresh,
    loading,
    error,
  };
}
