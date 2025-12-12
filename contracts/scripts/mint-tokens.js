const hre = require("hardhat");
const fs = require("fs");

async function main() {
  // Load deployed addresses
  const addressesPath = "./deployed-addresses.json";
  if (!fs.existsSync(addressesPath)) {
    console.error("deployed-addresses.json not found. Please deploy contracts first.");
    process.exit(1);
  }

  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const mneeAddress = addresses.MockMNEE;

  const MockMNEE = await hre.ethers.getContractFactory("MockMNEE");
  const mockMNEE = MockMNEE.attach(mneeAddress);

  const [deployer] = await hre.ethers.getSigners();
  const recipient = process.argv[2] || deployer.address;
  const amount = process.argv[3] || "10000";

  console.log(`Minting ${amount} MNEE to ${recipient}...`);
  
  const tx = await mockMNEE.mint(recipient, hre.ethers.parseEther(amount));
  await tx.wait();

  console.log(`✅ Successfully minted ${amount} MNEE to ${recipient}`);
  console.log(`Transaction: ${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

