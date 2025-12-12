const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const addressesPath = "./deployed-addresses-production.json";
  if (!fs.existsSync(addressesPath)) {
    console.error("❌ deployed-addresses-production.json not found.");
    process.exit(1);
  }

  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const aptanAddress = addresses.APTAN;

  console.log("🧪 Testing APTAN Contract Read Functions");
  console.log("=" .repeat(50));
  console.log("Contract:", aptanAddress);
  console.log("Network:", addresses.network);
  console.log("");

  const APTAN = await hre.ethers.getContractFactory("APTAN");
  const aptan = APTAN.attach(aptanAddress);

  try {
    // Test 1: Get task counter
    const taskCounter = await aptan.taskCounter();
    console.log("✅ taskCounter():", taskCounter.toString());

    // Test 2: Get MNEE address
    const mneeAddress = await aptan.mnee();
    console.log("✅ mnee():", mneeAddress);

    // Test 3: Get pending tasks
    const pendingTasks = await aptan.getPendingTasks();
    console.log("✅ getPendingTasks():", pendingTasks.length, "tasks");
    if (pendingTasks.length > 0) {
      console.log("   Task IDs:", pendingTasks.map(t => t.toString()).join(", "));
    }

    // Test 4: Get contract balance (if MNEE exists)
    try {
      const contractBalance = await aptan.getContractBalance();
      console.log("✅ getContractBalance():", contractBalance.toString());
    } catch (e) {
      console.log("⚠️  getContractBalance(): MNEE may not exist on this network");
    }

    console.log("");
    console.log("✅ All read functions working!");
    console.log(`View contract: https://${addresses.network === 'sepolia' ? 'sepolia.' : ''}etherscan.io/address/${aptanAddress}`);

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

