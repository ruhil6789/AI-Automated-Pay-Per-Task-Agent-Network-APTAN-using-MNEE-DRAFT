const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deploy MockMNEE if needed (for testing)
  const MockMNEE = await hre.ethers.getContractFactory("MockMNEE");
  const mockMNEE = await MockMNEE.deploy();
  await mockMNEE.waitForDeployment();
  const mneeAddress = await mockMNEE.getAddress();
  console.log("MockMNEE deployed to:", mneeAddress);

  // Deploy APTAN
  const APTAN = await hre.ethers.getContractFactory("APTAN");
  const aptan = await APTAN.deploy(mneeAddress);
  await aptan.waitForDeployment();
  const aptanAddress = await aptan.getAddress();
  console.log("APTAN deployed to:", aptanAddress);

  // Save addresses
  const fs = require("fs");
  const addresses = {
    MockMNEE: mneeAddress,
    APTAN: aptanAddress,
    network: hre.network.name
  };
  
  fs.writeFileSync(
    "./deployed-addresses.json",
    JSON.stringify(addresses, null, 2)
  );

  // Mint tokens to deployer and first few accounts for testing
  const signers = await hre.ethers.getSigners();
  const mintAmount = hre.ethers.parseEther("10000");
  
  console.log("\nMinting test tokens...");
  for (let i = 0; i < Math.min(5, signers.length); i++) {
    await mockMNEE.mint(signers[i].address, mintAmount);
    console.log(`Minted ${hre.ethers.formatEther(mintAmount)} MNEE to ${signers[i].address}`);
  }

  console.log("\n=== Deployment Complete ===");
  console.log("MockMNEE:", mneeAddress);
  console.log("APTAN:", aptanAddress);
  console.log("\nAddresses saved to deployed-addresses.json");
  console.log("\n💡 Tip: Import these accounts to MetaMask to test the app!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

