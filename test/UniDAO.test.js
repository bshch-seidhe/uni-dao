const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UniDAO (whitelisted student voting)", function () {
  async function deploy() {
    const [deployer, alice, bob, treasury, registrar, outsider] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("UniToken");
    const token = await Token.deploy();
    await token.waitForDeployment();

    await token.setWhitelisted(alice.address, true);
    await token.setWhitelisted(bob.address, true);
    await token.setWhitelisted(treasury.address, true);

    await token.mint(alice.address, ethers.parseUnits("5", 18));

    const DAO = await ethers.getContractFactory("UniDAO");
    const fee = ethers.parseUnits("1", 18);
    const dao = await DAO.deploy(
      await token.getAddress(),
      1,
      treasury.address,
      fee,
      registrar.address
    );
    await dao.waitForDeployment();

    await token.setWhitelisted(await dao.getAddress(), true);
    await token.transferOwnership(await dao.getAddress());

    return { token, dao, deployer, alice, bob, treasury, registrar, outsider };
  }

  it("requires whitelist to propose", async function () {
    const { dao, outsider } = await deploy();
    await expect(
      dao.connect(outsider).proposeGeneral("Title", "Desc", 60)
    ).to.be.revertedWith("Not whitelisted");
  });

  it("charges vote fee and sends to treasury", async function () {
    const { dao, token, alice, treasury } = await deploy();

    const createTx = await dao
      .connect(alice)
      .proposeGeneral("Cafeteria", "Extend cafeteria hours", 60);
    await createTx.wait();

    const fee = await dao.voteFee();
    const before = await token.balanceOf(treasury.address);
    await token.connect(alice).approve(await dao.getAddress(), fee);

    const tx = await dao.connect(alice).vote(1, true);
    await tx.wait();

    const after = await token.balanceOf(treasury.address);
    expect(after - before).to.equal(fee);
  });

  it("allows registrar to add student without vote", async function () {
    const { dao, token, registrar, bob } = await deploy();

    await dao.connect(registrar).registrarAddStudent(bob.address);
    expect(await token.isWhitelisted(bob.address)).to.equal(true);
  });

  it("blocks non-registrar admin actions", async function () {
    const { dao, alice, bob } = await deploy();

    await expect(
      dao.connect(alice).registrarAddStudent(bob.address)
    ).to.be.revertedWith("Not registrar");
  });
});
