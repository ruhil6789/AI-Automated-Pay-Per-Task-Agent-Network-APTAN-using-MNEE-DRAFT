const hre = require("hardhat");
const fs = require("fs");

async function main() {
  // Load deployed addresses
  const addressesPath = "./deployed-addresses-production.json";
  if (!fs.existsSync(addressesPath)) {
    console.error("❌ deployed-addresses-production.json not found. Please deploy first.");
    process.exit(1);
  }

  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const aptanAddress = addresses.APTAN;
  const network = addresses.network;

  console.log("Verifying APTAN contract on Etherscan...");
  console.log("Contract:", aptanAddress);
  console.log("Network:", network);

  try {
    await hre.run("verify:verify", {
      address: aptanAddress,
      constructorArguments: ["0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF"], // MNEE address
      contract: "contracts/APTAN.sol:APTAN"
    });
    console.log("✅ Contract verified successfully!");
    console.log(`View on Etherscan: https://${network === 'sepolia' ? 'sepolia.' : ''}etherscan.io/address/${aptanAddress}`);
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract is already verified!");
    } else {
      console.error("❌ Verification failed:", error.message);
      console.log("\nYou can also verify manually:");
      console.log(`1. Go to https://${network === 'sepolia' ? 'sepolia.' : ''}etherscan.io/address/${aptanAddress}`);
      console.log("2. Click 'Contract' tab");
      console.log("3. Click 'Verify and Publish'");
      console.log("4. Enter constructor arguments: [\"0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF\"]");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

