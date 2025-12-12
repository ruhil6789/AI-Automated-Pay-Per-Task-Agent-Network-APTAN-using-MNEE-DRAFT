const hre = require("hardhat");

// Official MNEE contract address on Ethereum
const OFFICIAL_MNEE_ADDRESS = "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying APTAN with official MNEE contract...");
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());
  console.log("\nUsing official MNEE address:", OFFICIAL_MNEE_ADDRESS);

  // Verify MNEE contract exists (optional - may not exist on testnets)
  try {
    // Use the OpenZeppelin IERC20 interface
    const mneeContract = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", OFFICIAL_MNEE_ADDRESS);
    // Try to read symbol (some contracts may not have this)
    try {
      const symbol = await mneeContract.symbol();
      const name = await mneeContract.name();
      console.log(`✅ Verified MNEE contract: ${name} (${symbol})`);
    } catch {
      // Contract exists but may not have name/symbol functions
      const code = await hre.ethers.provider.getCode(OFFICIAL_MNEE_ADDRESS);
      if (code && code !== "0x") {
        console.log(`✅ MNEE contract exists at address (verified by code)`);
      } else {
        console.log(`⚠️  MNEE contract not found at this address on ${hre.network.name}`);
        console.log(`   This is normal if MNEE only exists on mainnet`);
      }
    }
  } catch (error) {
    console.log(`⚠️  Could not verify MNEE contract (this is OK for testnets)`);
    console.log(`   MNEE may only exist on Ethereum mainnet`);
    console.log(`   Continuing with deployment...`);
  }

  // Deploy APTAN with official MNEE address
  const APTAN = await hre.ethers.getContractFactory("APTAN");
  console.log("\nDeploying APTAN contract...");
  const aptan = await APTAN.deploy(OFFICIAL_MNEE_ADDRESS);
  await aptan.waitForDeployment();
  const aptanAddress = await aptan.getAddress();
  console.log("✅ APTAN deployed to:", aptanAddress);

  // Save addresses
  const fs = require("fs");
  const addresses = {
    MNEE: OFFICIAL_MNEE_ADDRESS,
    APTAN: aptanAddress,
    network: hre.network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(
    "./deployed-addresses-production.json",
    JSON.stringify(addresses, null, 2)
  );

  console.log("\n=== Deployment Complete ===");
  console.log("MNEE (Official):", OFFICIAL_MNEE_ADDRESS);
  console.log("APTAN:", aptanAddress);
  console.log("Network:", hre.network.name);
  console.log("\nAddresses saved to deployed-addresses-production.json");
  console.log("\n📝 Next steps:");
  console.log("1. Update backend/.env with APTAN address");
  console.log("2. Update frontend/.env with APTAN address");
  console.log("3. Get MNEE tokens for testing (if on testnet)");
  console.log("4. Test the deployment");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

