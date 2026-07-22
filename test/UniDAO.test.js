const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const TOKEN_CAP = ethers.parseUnits("10000000", 18);
const QUORUM_BPS = 3000n; // 30%
const MIN_DURATION = 120; // seconds, matches contract floor
const MAX_DURATION = 30 * 24 * 3600;
const MIN_MEMBERS = 1n;
const PROPOSAL_COOLDOWN = 0n;
const VOTE_FEE = ethers.parseUnits("1", 18);
const MEMBER_GRANT = 0n;
const DURATION = 200; // > MIN_DURATION, default proposal duration
const UDT = (n) => ethers.parseUnits(String(n), 18);

// --------------------------------------------------------------------------
// Setup helpers
// --------------------------------------------------------------------------

async function deployToken(cap = TOKEN_CAP) {
  const UniToken = await ethers.getContractFactory("UniToken");
  const token = await UniToken.deploy(cap);
  await token.waitForDeployment();
  return token;
}

async function deployDao(token, overrides = {}) {
  const [, , , , treasury, registrar] = await ethers.getSigners();
  const UniDAO = await ethers.getContractFactory("UniDAO");
  const dao = await UniDAO.deploy(
    await token.getAddress(),
    overrides.quorumBps ?? QUORUM_BPS,
    overrides.treasury ?? treasury.address,
    overrides.voteFee ?? VOTE_FEE,
    overrides.registrar ?? registrar.address,
    overrides.minDuration ?? MIN_DURATION,
    overrides.minMembers ?? MIN_MEMBERS,
    overrides.proposalCooldown ?? PROPOSAL_COOLDOWN,
    overrides.memberGrant ?? MEMBER_GRANT
  );
  await dao.waitForDeployment();
  return dao;
}

// Full deploy + wiring (token, whitelist treasury, deploy DAO, whitelist DAO,
// hand token ownership to the DAO). Returns every signer. Accepts DAO overrides
// plus an optional `cap` for the token.
async function wireUp(overrides = {}) {
  const [deployer, alice, bob, carol, treasury, registrar, outsider] = await ethers.getSigners();

  const token = await deployToken(overrides.cap);
  await (await token.setWhitelisted(treasury.address, true)).wait();

  const dao = await deployDao(token, overrides);
  await (await token.setWhitelisted(await dao.getAddress(), true)).wait();
  await (await token.transferOwnership(await dao.getAddress())).wait();
  await (await dao.connect(registrar).acceptTokenOwnership()).wait();

  return { token, dao, deployer, alice, bob, carol, treasury, registrar, outsider };
}

// Standard fixture: wired DAO with alice + bob as funded members.
async function deployFixture() {
  const ctx = await wireUp();
  const { dao, registrar, alice, bob } = ctx;
  await (await dao.connect(registrar).registrarAddStudent(alice.address)).wait();
  await (await dao.connect(registrar).registrarAddStudent(bob.address)).wait();
  await (await dao.connect(registrar).registrarMint(alice.address, UDT(5))).wait();
  await (await dao.connect(registrar).registrarMint(bob.address, UDT(5))).wait();
  return ctx;
}

// Asserts the DAO constructor reverts with `err`. Treasury is whitelisted first
// unless whitelistTreasury=false (used to trigger TreasuryNotWhitelisted).
async function expectDaoDeployRevert(overrides, err, { whitelistTreasury = true } = {}) {
  const token = await deployToken();
  const [, , , , treasury] = await ethers.getSigners();
  if (whitelistTreasury) await (await token.setWhitelisted(treasury.address, true)).wait();
  const UniDAO = await ethers.getContractFactory("UniDAO");
  await expect(deployDao(token, overrides)).to.be.revertedWithCustomError(UniDAO, err);
}

// --------------------------------------------------------------------------
// Action helpers
// --------------------------------------------------------------------------

async function pastDeadline(duration = DURATION) {
  await time.increase(duration + 1);
}

async function approveAndVote(dao, token, voter, proposalId, support) {
  const fee = await dao.voteFee();
  if (fee > 0n) {
    await (await token.connect(voter).approve(await dao.getAddress(), fee)).wait();
  }
  return dao.connect(voter).vote(proposalId, support);
}

// One voter votes, time advances past the deadline, proposal is finalized.
// Returns the finalize() tx promise so callers can chain .to.emit / .wait().
async function voteAndFinalize(dao, token, voter, id, support = true) {
  await approveAndVote(dao, token, voter, id, support);
  await pastDeadline();
  return dao.finalize(id);
}

async function signPermit(token, owner, spenderAddress, value, deadline) {
  const network = await ethers.provider.getNetwork();
  const nonce = await token.nonces(owner.address);
  const domain = {
    name: "Uni DAO Token",
    version: "1",
    chainId: network.chainId,
    verifyingContract: await token.getAddress(),
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
  const message = { owner: owner.address, spender: spenderAddress, value, nonce, deadline };
  const signature = await owner.signTypedData(domain, types, message);
  return ethers.Signature.from(signature);
}

// ==========================================================================
// UniToken
// ==========================================================================

describe("UniToken (standalone)", function () {
  it("starts with zero supply and whitelists the deployer", async function () {
    const [deployer] = await ethers.getSigners();
    const token = await deployToken();
    expect(await token.totalSupply()).to.equal(0);
    expect(await token.balanceOf(deployer.address)).to.equal(0);
    expect(await token.isWhitelisted(deployer.address)).to.equal(true);
    expect(await token.cap()).to.equal(TOKEN_CAP);
  });

  it("rejects a zero cap", async function () {
    const UniToken = await ethers.getContractFactory("UniToken");
    await expect(UniToken.deploy(0)).to.be.revertedWithCustomError(UniToken, "InvalidCap");
  });

  it("mint respects whitelist and cap", async function () {
    const [, alice] = await ethers.getSigners();
    const cap = UDT(10);
    const token = await deployToken(cap);

    await expect(token.mint(alice.address, 1)).to.be.revertedWithCustomError(token, "NotWhitelisted");

    await (await token.setWhitelisted(alice.address, true)).wait();
    await (await token.mint(alice.address, cap)).wait(); // mint up to the cap
    expect(await token.balanceOf(alice.address)).to.equal(cap);

    await expect(token.mint(alice.address, 1)).to.be.revertedWithCustomError(token, "CapExceeded");
  });

  it("setWhitelistedBatch updates multiple accounts", async function () {
    const [, alice, bob] = await ethers.getSigners();
    const token = await deployToken();
    await (await token.setWhitelistedBatch([alice.address, bob.address], true)).wait();
    expect(await token.isWhitelisted(alice.address)).to.equal(true);
    expect(await token.isWhitelisted(bob.address)).to.equal(true);
  });

  it("adminBurn burns and emits AdminBurn", async function () {
    const [deployer] = await ethers.getSigners();
    const token = await deployToken();
    await (await token.mint(deployer.address, UDT(1))).wait(); // deployer is whitelisted at deploy
    await expect(token.adminBurn(deployer.address, UDT(1)))
      .to.emit(token, "AdminBurn")
      .withArgs(deployer.address, UDT(1));
  });

  it("blocks transfers between non-whitelisted parties", async function () {
    const [, alice] = await ethers.getSigners();
    const token = await deployToken();
    await expect(token.transfer(alice.address, 1)).to.be.revertedWithCustomError(token, "TransferRestricted");
  });

  it("two-step ownership: transferOwnership alone does not change owner()", async function () {
    const [deployer, , , , , , outsider] = await ethers.getSigners();
    const token = await deployToken();

    await (await token.transferOwnership(outsider.address)).wait();
    expect(await token.owner()).to.equal(deployer.address);

    await (await token.connect(outsider).acceptOwnership()).wait();
    expect(await token.owner()).to.equal(outsider.address);
  });

  it("renounceOwnership always reverts", async function () {
    const token = await deployToken();
    await expect(token.renounceOwnership()).to.be.revertedWithCustomError(token, "OwnershipRenounceDisabled");
  });
});

// ==========================================================================
// UniDAO
// ==========================================================================

describe("UniDAO", function () {
  // ---- DEPLOYMENT ----
  describe("deployment", function () {
    it("reverts on a zero token/treasury/registrar address", async function () {
      const [, , , , treasury] = await ethers.getSigners();
      const token = await deployToken();
      await (await token.setWhitelisted(treasury.address, true)).wait();
      const UniDAO = await ethers.getContractFactory("UniDAO");
      await expect(
        UniDAO.deploy(
          ethers.ZeroAddress,
          QUORUM_BPS,
          treasury.address,
          VOTE_FEE,
          treasury.address,
          MIN_DURATION,
          MIN_MEMBERS,
          PROPOSAL_COOLDOWN,
          MEMBER_GRANT
        )
      ).to.be.revertedWithCustomError(UniDAO, "ZeroAddress");
    });

    it("reverts when treasury is not whitelisted", async function () {
      await expectDaoDeployRevert({}, "TreasuryNotWhitelisted", { whitelistTreasury: false });
    });

    it("reverts when the vote fee exceeds MAX_VOTE_FEE", async function () {
      await expectDaoDeployRevert({ voteFee: UDT(101) }, "FeeTooHigh");
    });

    it("reverts on invalid quorumBps", async function () {
      await expectDaoDeployRevert({ quorumBps: 0 }, "InvalidQuorum");
      await expectDaoDeployRevert({ quorumBps: 10001 }, "InvalidQuorum");
    });

    it("reverts when minDuration is below 120 seconds", async function () {
      await expectDaoDeployRevert({ minDuration: 119 }, "InvalidMinDuration");
    });
  });

  // ---- MEMBERSHIP (T1.1 / T1.2 / T4.1) ----
  describe("membership", function () {
    it("tracks isMember/memberCount directly, independent of the whitelist", async function () {
      const { dao, token, carol, registrar } = await loadFixture(deployFixture);
      expect(await dao.memberCount()).to.equal(2);
      expect(await dao.isMember(carol.address)).to.equal(false);

      await expect(dao.connect(registrar).registrarAddStudent(carol.address))
        .to.emit(dao, "MemberAdded")
        .withArgs(carol.address);
      expect(await dao.isMember(carol.address)).to.equal(true);
      expect(await dao.memberCount()).to.equal(3);
      expect(await token.isWhitelisted(carol.address)).to.equal(true);
    });

    it("rejects adding the zero address or an existing member", async function () {
      const { dao, alice, registrar } = await loadFixture(deployFixture);
      await expect(dao.connect(registrar).registrarAddStudent(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        dao,
        "ZeroAddress"
      );
      await expect(dao.connect(registrar).registrarAddStudent(alice.address)).to.be.revertedWithCustomError(
        dao,
        "AlreadyMember"
      );
    });

    it("registrarAddStudents adds a batch in one transaction", async function () {
      const { dao, carol, outsider, registrar } = await loadFixture(deployFixture);
      await (await dao.connect(registrar).registrarAddStudents([carol.address, outsider.address])).wait();
      expect(await dao.isMember(carol.address)).to.equal(true);
      expect(await dao.isMember(outsider.address)).to.equal(true);
      expect(await dao.memberCount()).to.equal(4);
    });

    it("mints memberGrant to new members with zero balance, letting them vote immediately", async function () {
      const { token, dao, registrar, outsider: newMember } = await wireUp({ memberGrant: UDT(2) });
      await (await dao.connect(registrar).registrarAddStudent(newMember.address)).wait();
      expect(await token.balanceOf(newMember.address)).to.equal(UDT(2));

      await (await dao.connect(newMember).proposeGeneral("g", "d", DURATION)).wait();
      await expect(approveAndVote(dao, token, newMember, 1, true)).to.not.be.reverted;
    });

    it("removes a member and un-whitelists them", async function () {
      const { dao, token, bob, registrar } = await loadFixture(deployFixture);
      await expect(dao.connect(registrar).registrarRemoveStudent(bob.address))
        .to.emit(dao, "MemberRemoved")
        .withArgs(bob.address);
      expect(await dao.isMember(bob.address)).to.equal(false);
      expect(await token.isWhitelisted(bob.address)).to.equal(false);
      expect(await dao.memberCount()).to.equal(1);
    });

    it("rejects removing a non-member (fixes the deployer-desync bug)", async function () {
      const { dao, deployer, registrar } = await loadFixture(deployFixture);
      await expect(dao.connect(registrar).registrarRemoveStudent(deployer.address)).to.be.revertedWithCustomError(
        dao,
        "NotMember"
      );
    });

    it("blocks removing the treasury or the DAO itself", async function () {
      const { dao, treasury, registrar } = await loadFixture(deployFixture);
      await expect(dao.connect(registrar).registrarRemoveStudent(treasury.address)).to.be.revertedWithCustomError(
        dao,
        "CannotRemoveTreasury"
      );
      await expect(
        dao.connect(registrar).registrarRemoveStudent(await dao.getAddress())
      ).to.be.revertedWithCustomError(dao, "CannotRemoveDAO");
    });

    it("enforces the member floor (T4.1): registrar cannot empty the roster", async function () {
      const { dao, bob, alice, registrar } = await loadFixture(deployFixture);
      await (await dao.connect(registrar).registrarRemoveStudent(bob.address)).wait();
      expect(await dao.memberCount()).to.equal(1);
      await expect(dao.connect(registrar).registrarRemoveStudent(alice.address)).to.be.revertedWithCustomError(
        dao,
        "BelowMemberFloor"
      );
    });

    it("blocks non-registrar callers on every registrar function", async function () {
      const { dao, outsider, carol } = await loadFixture(deployFixture);
      for (const call of [
        dao.connect(outsider).registrarAddStudent(carol.address),
        dao.connect(outsider).registrarRemoveStudent(carol.address),
        dao.connect(outsider).registrarMint(carol.address, 1),
        dao.connect(outsider).registrarClawback(carol.address, 1),
        dao.connect(outsider).acceptTokenOwnership(),
      ]) {
        await expect(call).to.be.revertedWithCustomError(dao, "NotRegistrar");
      }
    });

    it("registrarClawback burns via token.adminBurn (T4.2 honest labeling)", async function () {
      const { dao, token, alice, registrar } = await loadFixture(deployFixture);
      await expect(dao.connect(registrar).registrarClawback(alice.address, UDT(1)))
        .to.emit(token, "AdminBurn")
        .withArgs(alice.address, UDT(1));
    });
  });

  // ---- QUORUM (T2.1) ----
  describe("quorum", function () {
    it("currentQuorum is a basis-points ceiling with a floor of 1", async function () {
      const { dao } = await loadFixture(deployFixture);
      // 2 members * 3000bps = 0.6 -> ceil -> 1
      expect(await dao.currentQuorum()).to.equal(1);
    });

    it("proposeSetQuorum validates bounds and no longer caps at memberCount", async function () {
      const { dao, alice } = await loadFixture(deployFixture);
      await expect(dao.connect(alice).proposeSetQuorum("t", "d", 0, DURATION)).to.be.revertedWithCustomError(
        dao,
        "InvalidQuorum"
      );
      await expect(dao.connect(alice).proposeSetQuorum("t", "d", 10001, DURATION)).to.be.revertedWithCustomError(
        dao,
        "InvalidQuorum"
      );
      // 10000bps (100%) is valid even though the raw value dwarfs memberCount (2 vs 10000)
      await expect(dao.connect(alice).proposeSetQuorum("t", "d", 10000, DURATION)).to.not.be.reverted;
    });

    it("snapshots quorum at creation; later quorumBps changes don't retroactively affect it", async function () {
      const { dao, token, alice, bob } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("A", "d", DURATION)).wait(); // id 1, snapshot = 1
      const before = (await dao.proposals(1)).quorum;

      await (await dao.connect(bob).proposeSetQuorum("Q", "d", 10000, DURATION)).wait(); // id 2
      await (await voteAndFinalize(dao, token, alice, 2)).wait();
      expect(await dao.quorumBps()).to.equal(10000);

      expect((await dao.proposals(1)).quorum).to.equal(before);
    });

    it("regression: shrinking the roster still leaves proposals passable (bps-relative)", async function () {
      const { dao, token, alice, carol, registrar } = await loadFixture(deployFixture);
      // Grow then shrink; quorum recomputes from live memberCount at each creation.
      await (await dao.connect(registrar).registrarAddStudent(carol.address)).wait();
      await (await dao.connect(registrar).registrarMint(carol.address, UDT(5))).wait();
      expect(await dao.memberCount()).to.equal(3);

      await (await dao.connect(registrar).registrarRemoveStudent(carol.address)).wait();
      expect(await dao.memberCount()).to.equal(2);

      await (await dao.connect(alice).proposeGeneral("A", "d", DURATION)).wait();
      const quorum = (await dao.proposals(1)).quorum;
      await (await voteAndFinalize(dao, token, alice, 1)).wait();
      expect((await dao.proposals(1)).passed).to.equal(true);
      expect(quorum).to.be.at.most(2);
    });
  });

  // ---- PROPOSAL CREATION ----
  describe("proposal creation", function () {
    it("requires membership to propose", async function () {
      const { dao, outsider } = await loadFixture(deployFixture);
      await expect(dao.connect(outsider).proposeGeneral("t", "d", DURATION)).to.be.revertedWithCustomError(
        dao,
        "NotMember"
      );
    });

    it("enforces minDuration and MAX_DURATION", async function () {
      const { dao, alice } = await loadFixture(deployFixture);
      await expect(dao.connect(alice).proposeGeneral("t", "d", MIN_DURATION - 1)).to.be.revertedWithCustomError(
        dao,
        "DurationTooShort"
      );
      await expect(dao.connect(alice).proposeGeneral("t", "d", MAX_DURATION + 1)).to.be.revertedWithCustomError(
        dao,
        "DurationTooLong"
      );
    });

    it("caps title and description length (T7.4)", async function () {
      const { dao, alice } = await loadFixture(deployFixture);
      await expect(dao.connect(alice).proposeGeneral("x".repeat(129), "d", DURATION)).to.be.revertedWithCustomError(
        dao,
        "TitleTooLong"
      );
      await expect(dao.connect(alice).proposeGeneral("t", "y".repeat(1025), DURATION)).to.be.revertedWithCustomError(
        dao,
        "DescriptionTooLong"
      );
    });

    it("enforces the proposer cooldown (T7.2)", async function () {
      const { dao, registrar, alice } = await wireUp({ proposalCooldown: 1000 });
      await (await dao.connect(registrar).registrarAddStudent(alice.address)).wait();

      await (await dao.connect(alice).proposeGeneral("a", "d", DURATION)).wait();
      await expect(dao.connect(alice).proposeGeneral("b", "d", DURATION)).to.be.revertedWithCustomError(
        dao,
        "ProposalCooldownActive"
      );

      await time.increase(1001);
      await expect(dao.connect(alice).proposeGeneral("c", "d", DURATION)).to.not.be.reverted;
    });

    it("rejects governance proposals targeting the zero address", async function () {
      const { dao, alice } = await loadFixture(deployFixture);
      for (const call of [
        dao.connect(alice).proposeSetTreasury("t", "d", ethers.ZeroAddress, DURATION),
        dao.connect(alice).proposeSetRegistrar("t", "d", ethers.ZeroAddress, DURATION),
        dao.connect(alice).proposeSetTokenOwner("t", "d", ethers.ZeroAddress, DURATION),
      ]) {
        await expect(call).to.be.revertedWithCustomError(dao, "ZeroAddress");
      }
    });

    it("rejects a treasury proposal for a non-whitelisted address", async function () {
      const { dao, alice, outsider } = await loadFixture(deployFixture);
      await expect(
        dao.connect(alice).proposeSetTreasury("t", "d", outsider.address, DURATION)
      ).to.be.revertedWithCustomError(dao, "TreasuryNotWhitelisted");
    });

    it("rejects a vote-fee proposal above MAX_VOTE_FEE", async function () {
      const { dao, alice } = await loadFixture(deployFixture);
      await expect(dao.connect(alice).proposeSetVoteFee("t", "d", UDT(101), DURATION)).to.be.revertedWithCustomError(
        dao,
        "FeeTooHigh"
      );
    });

    it("rejects a TRANSFER proposal with zero recipient or amount", async function () {
      const { dao, alice, treasury } = await loadFixture(deployFixture);
      await expect(
        dao.connect(alice).proposeTransfer("t", "d", ethers.ZeroAddress, 1, DURATION)
      ).to.be.revertedWithCustomError(dao, "ZeroAddress");
      await expect(
        dao.connect(alice).proposeTransfer("t", "d", treasury.address, 0, DURATION)
      ).to.be.revertedWithCustomError(dao, "ZeroAmount");
    });
  });

  // ---- VOTING ----
  describe("voting", function () {
    it("charges the vote fee and sends it to treasury", async function () {
      const { dao, token, alice, treasury } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("t", "d", DURATION)).wait();
      const before = await token.balanceOf(treasury.address);
      await approveAndVote(dao, token, alice, 1, true);
      expect(await token.balanceOf(treasury.address)).to.equal(before + VOTE_FEE);
    });

    it("prevents double voting", async function () {
      const { dao, token, alice } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("t", "d", DURATION)).wait();
      await approveAndVote(dao, token, alice, 1, true);
      await expect(approveAndVote(dao, token, alice, 1, true)).to.be.revertedWithCustomError(dao, "AlreadyVoted");
    });

    it("rejects votes after the deadline", async function () {
      const { dao, token, alice } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("t", "d", DURATION)).wait();
      await pastDeadline();
      await expect(approveAndVote(dao, token, alice, 1, true)).to.be.revertedWithCustomError(dao, "VotingEnded");
    });

    it("rejects votes from non-members", async function () {
      const { dao, alice, outsider } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("t", "d", DURATION)).wait();
      await expect(dao.connect(outsider).vote(1, true)).to.be.revertedWithCustomError(dao, "NotMember");
    });

    it("rejects votes on a cancelled proposal", async function () {
      const { dao, alice } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("t", "d", DURATION)).wait();
      await (await dao.connect(alice).cancel(1)).wait();
      await expect(dao.connect(alice).vote(1, true)).to.be.revertedWithCustomError(dao, "ProposalIsCancelled");
    });

    it("voteWithPermit casts a vote and pays the fee in a single transaction (T7.3)", async function () {
      const { dao, token, alice } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("t", "d", DURATION)).wait();

      const deadline = (await time.latest()) + 3600;
      const sig = await signPermit(token, alice, await dao.getAddress(), VOTE_FEE, deadline);

      await expect(dao.connect(alice).voteWithPermit(1, true, deadline, sig.v, sig.r, sig.s))
        .to.emit(dao, "VoteCast")
        .withArgs(1, alice.address, true);
    });
  });

  // ---- CANCELLATION ----
  describe("cancellation", function () {
    it("lets the proposer cancel before any votes", async function () {
      const { dao, alice } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("t", "d", DURATION)).wait();
      await expect(dao.connect(alice).cancel(1)).to.emit(dao, "ProposalCancelled").withArgs(1);
    });

    it("blocks cancel by non-proposer, after votes, or twice", async function () {
      const { dao, token, alice, bob } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("t", "d", DURATION)).wait();
      await expect(dao.connect(bob).cancel(1)).to.be.revertedWithCustomError(dao, "NotProposer");

      await approveAndVote(dao, token, alice, 1, true);
      await expect(dao.connect(alice).cancel(1)).to.be.revertedWithCustomError(dao, "VotesAlreadyCast");
    });

    it("blocks cancel after finalize", async function () {
      const { dao, alice } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("t", "d", DURATION)).wait();
      await pastDeadline();
      await (await dao.finalize(1)).wait();
      await expect(dao.connect(alice).cancel(1)).to.be.revertedWithCustomError(dao, "AlreadyFinalized");
    });
  });

  // ---- FINALIZATION & STATE (T5.1 / T5.2) ----
  describe("finalization and state", function () {
    it("rejects finalize before the deadline", async function () {
      const { dao, alice } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("t", "d", DURATION)).wait();
      await expect(dao.finalize(1)).to.be.revertedWithCustomError(dao, "VotingNotEnded");
    });

    it("rejects finalizing twice", async function () {
      const { dao, alice } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("t", "d", DURATION)).wait();
      await pastDeadline();
      await (await dao.finalize(1)).wait();
      await expect(dao.finalize(1)).to.be.revertedWithCustomError(dao, "AlreadyFinalized");
    });

    it("finalizes with passed=false when quorum is not reached", async function () {
      const { dao, alice } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("t", "d", DURATION)).wait();
      await pastDeadline();
      await expect(dao.finalize(1)).to.emit(dao, "ProposalFinalized").withArgs(1, false);
    });

    it("state() walks Active -> PendingFinalize -> Succeeded/Defeated, and Cancelled", async function () {
      const { dao, token, alice, bob } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("t", "d", DURATION)).wait();
      expect(await dao.state(1)).to.equal(0); // Active

      await approveAndVote(dao, token, alice, 1, true);
      await pastDeadline();
      expect(await dao.state(1)).to.equal(1); // PendingFinalize

      await (await dao.finalize(1)).wait();
      expect(await dao.state(1)).to.equal(2); // Succeeded

      await (await dao.connect(bob).proposeGeneral("t2", "d", DURATION)).wait();
      await pastDeadline();
      await (await dao.finalize(2)).wait();
      expect(await dao.state(2)).to.equal(3); // Defeated (no votes -> quorum not reached)

      await (await dao.connect(bob).proposeGeneral("t3", "d", DURATION)).wait();
      await (await dao.connect(bob).cancel(3)).wait();
      expect(await dao.state(3)).to.equal(4); // Cancelled
    });

    it("reverts state()/getProposals bounds on an invalid id", async function () {
      const { dao } = await loadFixture(deployFixture);
      await expect(dao.state(1)).to.be.revertedWithCustomError(dao, "InvalidProposal");
    });
  });

  // ---- EXECUTION (all proposal types) ----
  describe("execution", function () {
    it("executes a passing SET_VOTE_FEE proposal", async function () {
      const { dao, token, alice } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeSetVoteFee("t", "d", UDT(2), DURATION)).wait();
      await expect(voteAndFinalize(dao, token, alice, 1)).to.emit(dao, "VoteFeeUpdated").withArgs(UDT(2));
      expect(await dao.voteFee()).to.equal(UDT(2));
    });

    it("executes a passing SET_REGISTRAR proposal", async function () {
      const { dao, token, alice, carol } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeSetRegistrar("t", "d", carol.address, DURATION)).wait();
      await (await voteAndFinalize(dao, token, alice, 1)).wait();
      expect(await dao.registrar()).to.equal(carol.address);
    });

    it("executes a passing SET_TREASURY proposal", async function () {
      const { dao, token, alice, carol, registrar } = await loadFixture(deployFixture);
      await (await dao.connect(registrar).registrarAddStudent(carol.address)).wait();
      await (await dao.connect(alice).proposeSetTreasury("t", "d", carol.address, DURATION)).wait();
      await (await voteAndFinalize(dao, token, alice, 1)).wait();
      expect(await dao.treasury()).to.equal(carol.address);
    });

    it("fails a treasury proposal cleanly if the target lost the whitelist mid-vote", async function () {
      const { dao, token, alice, carol, registrar } = await loadFixture(deployFixture);
      await (await dao.connect(registrar).registrarAddStudent(carol.address)).wait();
      await (await dao.connect(alice).proposeSetTreasury("t", "d", carol.address, DURATION)).wait();
      await approveAndVote(dao, token, alice, 1, true);
      await (await dao.connect(registrar).registrarRemoveStudent(carol.address)).wait();
      await pastDeadline();
      await expect(dao.finalize(1)).to.emit(dao, "ProposalFinalized").withArgs(1, false);
    });

    it("executes a passing SET_QUORUM proposal at the basis-point bound", async function () {
      const { dao, token, alice } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeSetQuorum("t", "d", 10000, DURATION)).wait();
      await expect(voteAndFinalize(dao, token, alice, 1)).to.emit(dao, "ProposalFinalized").withArgs(1, true);
      expect(await dao.quorumBps()).to.equal(10000);
    });

    it("executes a passing SET_MEMBER_GRANT proposal", async function () {
      const { dao, token, alice } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeSetMemberGrant("t", "d", UDT(3), DURATION)).wait();
      await expect(voteAndFinalize(dao, token, alice, 1)).to.emit(dao, "MemberGrantUpdated").withArgs(UDT(3));
      expect(await dao.memberGrant()).to.equal(UDT(3));
    });

    it("executes SET_TOKEN_OWNER: DAO transfers, target must accept, re-execution fails gracefully", async function () {
      const { dao, token, alice, outsider } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeSetTokenOwner("t", "d", outsider.address, DURATION)).wait();
      await expect(voteAndFinalize(dao, token, alice, 1)).to.emit(dao, "TokenOwnerProposed").withArgs(outsider.address);

      // Ownership is pending, not yet transferred (two-step).
      expect(await token.owner()).to.equal(await dao.getAddress());
      await (await token.connect(outsider).acceptOwnership()).wait();
      expect(await token.owner()).to.equal(outsider.address);

      // A second proposal now fails cleanly (DAO no longer owns) instead of reverting finalize().
      await (await dao.connect(alice).proposeSetTokenOwner("t2", "d", alice.address, DURATION)).wait();
      await expect(voteAndFinalize(dao, token, alice, 2)).to.emit(dao, "ProposalFinalized").withArgs(2, false);
    });

    it("executes a passing TRANSFER proposal after treasury approves the DAO", async function () {
      const { dao, token, alice, bob, carol, treasury, registrar } = await loadFixture(deployFixture);
      await (await dao.connect(registrar).registrarAddStudent(carol.address)).wait();

      // Fund the treasury via a normal fee-paying vote.
      await (await dao.connect(alice).proposeGeneral("fund", "d", DURATION)).wait(); // id 1
      await approveAndVote(dao, token, alice, 1, true);
      expect(await token.balanceOf(treasury.address)).to.equal(VOTE_FEE);

      await (await token.connect(treasury).approve(await dao.getAddress(), VOTE_FEE)).wait();

      await (await dao.connect(bob).proposeTransfer("t", "d", carol.address, VOTE_FEE, DURATION)).wait(); // id 2
      const before = await token.balanceOf(carol.address);
      await expect(voteAndFinalize(dao, token, bob, 2)).to.emit(dao, "TreasuryTransfer");
      expect(await token.balanceOf(carol.address)).to.equal(before + VOTE_FEE);
    });

    it("TRANSFER fails cleanly (no revert) when the recipient isn't whitelisted", async function () {
      const { dao, token, alice, outsider } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeTransfer("t", "d", outsider.address, UDT(1), DURATION)).wait();
      await expect(voteAndFinalize(dao, token, alice, 1)).to.emit(dao, "ProposalFinalized").withArgs(1, false);
    });

    it("TRANSFER fails cleanly (no revert) on insufficient treasury balance or allowance", async function () {
      const { dao, token, alice, carol, registrar } = await loadFixture(deployFixture);
      await (await dao.connect(registrar).registrarAddStudent(carol.address)).wait();
      await (await dao.connect(alice).proposeTransfer("t", "d", carol.address, UDT(1), DURATION)).wait();
      await expect(voteAndFinalize(dao, token, alice, 1)).to.emit(dao, "ProposalFinalized").withArgs(1, false);
    });

    it("GENERAL proposals take no on-chain action but still finalize as passed", async function () {
      const { dao, token, alice } = await loadFixture(deployFixture);
      await (await dao.connect(alice).proposeGeneral("t", "d", DURATION)).wait();
      await expect(voteAndFinalize(dao, token, alice, 1)).to.emit(dao, "ProposalFinalized").withArgs(1, true);
    });
  });

  // ---- PAGINATION (T5.3) ----
  describe("getProposals pagination", function () {
    it("returns a bounded slice and rejects out-of-range limits", async function () {
      const { dao, alice } = await loadFixture(deployFixture);
      for (let i = 0; i < 3; i++) {
        await (await dao.connect(alice).proposeGeneral(`t${i}`, "d", DURATION)).wait();
      }
      const page = await dao.getProposals(1, 2);
      expect(page.length).to.equal(2);
      expect(page[0].title).to.equal("t1");
      expect(page[1].title).to.equal("t2");

      expect((await dao.getProposals(10, 5)).length).to.equal(0);

      await expect(dao.getProposals(0, 0)).to.be.revertedWithCustomError(dao, "InvalidLimit");
      await expect(dao.getProposals(0, 51)).to.be.revertedWithCustomError(dao, "InvalidLimit");
    });
  });

  // ---- INVARIANTS ----
  describe("invariants", function () {
    it("memberCount tracks the true count of isMember == true", async function () {
      const { dao, carol, outsider, registrar, alice, bob } = await loadFixture(deployFixture);
      await (await dao.connect(registrar).registrarAddStudent(carol.address)).wait();
      await (await dao.connect(registrar).registrarAddStudent(outsider.address)).wait();
      await (await dao.connect(registrar).registrarRemoveStudent(carol.address)).wait();

      let count = 0;
      for (const a of [alice, bob, carol, outsider]) {
        if (await dao.isMember(a.address)) count++;
      }
      expect(await dao.memberCount()).to.equal(count);
    });

    it("isMember implies token.isWhitelisted for every tracked address", async function () {
      const { dao, token, alice, bob, carol, registrar } = await loadFixture(deployFixture);
      await (await dao.connect(registrar).registrarAddStudent(carol.address)).wait();
      for (const a of [alice, bob, carol]) {
        expect(await dao.isMember(a.address)).to.equal(true);
        expect(await token.isWhitelisted(a.address)).to.equal(true);
      }
    });

    it("totalSupply never exceeds cap, even via registrarMint", async function () {
      const cap = UDT(10);
      const { token, dao, alice, registrar } = await wireUp({ cap });
      await (await dao.connect(registrar).registrarAddStudent(alice.address)).wait();

      await (await dao.connect(registrar).registrarMint(alice.address, cap)).wait();
      expect(await token.totalSupply()).to.equal(cap);
      await expect(dao.connect(registrar).registrarMint(alice.address, 1)).to.be.revertedWithCustomError(
        token,
        "CapExceeded"
      );
    });
  });
});
