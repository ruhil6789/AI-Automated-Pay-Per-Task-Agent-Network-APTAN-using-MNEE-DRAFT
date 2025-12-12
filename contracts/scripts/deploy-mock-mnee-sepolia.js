const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying MockMNEE to Sepolia for testing...");
  console.log("Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("");

  // Deploy MockMNEE
  const MockMNEE = await hre.ethers.getContractFactory("MockMNEE");
  console.log("Deploying MockMNEE...");
  const mockMNEE = await MockMNEE.deploy();
  await mockMNEE.waitForDeployment();
  const mneeAddress = await mockMNEE.getAddress();
  console.log("✅ MockMNEE deployed to:", mneeAddress);

  // Mint tokens to deployer
  const mintAmount = hre.ethers.parseEther("10000");
  console.log("Minting 10,000 MockMNEE to deployer...");
  await mockMNEE.mint(deployer.address, mintAmount);
  console.log("✅ Tokens minted");

  // Save address
  const fs = require("fs");
  const addressesPath = "./deployed-addresses-production.json";
  let addresses = {};
  if (fs.existsSync(addressesPath)) {
    addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  }
  addresses.MockMNEE_Sepolia = mneeAddress;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));

  console.log("\n=== MockMNEE Deployment Complete ===");
  console.log("MockMNEE Address:", mneeAddress);
  console.log("View on Etherscan: https://sepolia.etherscan.io/address/" + mneeAddress);
  console.log("\n💡 You can now use this address to test APTAN transactions!");
  console.log("   Update APTAN to use MockMNEE for testing on Sepolia");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

