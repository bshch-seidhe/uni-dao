const hre = require("hardhat");
require("dotenv").config();

const TOKEN_CAP = process.env.TOKEN_CAP || "10000000"; // 10,000,000 UDT

async function main() {
    const UniToken = await hre.ethers.getContractFactory("UniToken");
    const cap = hre.ethers.parseUnits(TOKEN_CAP, 18);
    const token = await UniToken.deploy(cap);

    await token.waitForDeployment();

    console.log("UniToken deployed to:", await token.getAddress());
    console.log("Supply cap:", TOKEN_CAP, "UDT");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
