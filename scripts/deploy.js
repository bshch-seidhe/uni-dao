const hre = require("hardhat");

async function main() {
    const UniToken = await hre.ethers.getContractFactory("UniToken");
    const token = await UniToken.deploy();

    await token.waitForDeployment();

    console.log("UniToken deplpoyed to:", await token.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});