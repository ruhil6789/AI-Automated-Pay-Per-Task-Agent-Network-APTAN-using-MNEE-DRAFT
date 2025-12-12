const hre = require("hardhat");
const fs = require("fs");

async function main() {
  // Load addresses
  const addressesPath = "./deployed-addresses-production.json";
  if (!fs.existsSync(addressesPath)) {
    console.error("❌ deployed-addresses-production.json not found.");
    process.exit(1);
  }

  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const mockMNEEAddress = addresses.MockMNEE_Sepolia;

  if (!mockMNEEAddress) {
    console.error("❌ MockMNEE not deployed. Run deploy-mock-mnee-sepolia.js first");
    process.exit(1);
  }

  console.log("🧪 Testing APTAN createTask Transaction");
  console.log("=" .repeat(50));
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("ETH Balance:", hre.ethers.formatEther(balance));
  console.log("MockMNEE:", mockMNEEAddress);
  console.log("");

  // Deploy APTAN with MockMNEE for testing
  console.log("📦 Deploying test APTAN with MockMNEE...");
  const APTAN = await hre.ethers.getContractFactory("APTAN");
  const aptan = await APTAN.deploy(mockMNEEAddress);
  await aptan.waitForDeployment();
  const aptanAddress = await aptan.getAddress();
  console.log("✅ APTAN deployed:", aptanAddress);
  console.log("");

  // Get MockMNEE contract
  const MockMNEE = await hre.ethers.getContractFactory("MockMNEE");
  const mockMNEE = MockMNEE.attach(mockMNEEAddress);

  // Check balance
  const mneeBalance = await mockMNEE.balanceOf(deployer.address);
  console.log("💰 MockMNEE Balance:", hre.ethers.formatEther(mneeBalance));
  console.log("");

  // Approve spending
  console.log("🔐 Approving MockMNEE spending...");
  const approveTx = await mockMNEE.approve(aptanAddress, hre.ethers.MaxUint256);
  await approveTx.wait();
  console.log("✅ Approved");
  console.log("");

  // Create a task
  console.log("📝 Creating test task...");
  const rewardAmount = hre.ethers.parseEther("10"); // 10 MockMNEE
  const deadline = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
  const description = "Test task: Verify APTAN contract is working correctly on Sepolia";

  const createTaskTx = await aptan.createTask(description, rewardAmount, deadline);
  console.log("⏳ Transaction submitted:", createTaskTx.hash);
  console.log("   Waiting for confirmation...");

  const receipt = await createTaskTx.wait();
  console.log("✅ Task created successfully!");
  console.log("");

  // Get task details
  const taskCounter = await aptan.taskCounter();
  const taskId = Number(taskCounter);
  const task = await aptan.getTask(taskId);

  console.log("📋 Task Details:");
  console.log("   Task ID:", taskId);
  console.log("   Creator:", task.creator);
  console.log("   Description:", task.description);
  console.log("   Reward:", hre.ethers.formatEther(task.reward), "MockMNEE");
  console.log("   Deadline:", new Date(Number(task.deadline) * 1000).toLocaleString());
  console.log("   Completed:", task.completed);
  console.log("");

  console.log("📊 Transaction Info:");
  console.log("   Gas Used:", receipt.gasUsed.toString());
  console.log("   Block Number:", receipt.blockNumber);
  console.log("");

  console.log("🔗 View on Etherscan:");
  console.log(`   Transaction: https://sepolia.etherscan.io/tx/${createTaskTx.hash}`);
  console.log(`   Contract: https://sepolia.etherscan.io/address/${aptanAddress}`);
  console.log("");

  // Save test APTAN address
  addresses.TestAPTAN_Sepolia = aptanAddress;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("✅ Test APTAN address saved to deployed-addresses-production.json");

  console.log("");
  console.log("🎉 Transaction test completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });

