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
  const mneeAddress = addresses.MNEE;

  console.log("Testing APTAN contract transaction...");
  console.log("APTAN:", aptanAddress);
  console.log("MNEE:", mneeAddress);
  console.log("Network:", addresses.network);
  console.log("");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("");

  // Get contract instance
  const APTAN = await hre.ethers.getContractFactory("APTAN");
  const aptan = APTAN.attach(aptanAddress);

  // Test 1: Get contract info
  console.log("📋 Contract Info:");
  const taskCounter = await aptan.taskCounter();
  console.log("  Current task count:", taskCounter.toString());
  const contractMNEE = await aptan.mnee();
  console.log("  MNEE address:", contractMNEE);
  console.log("");

  // Test 2: Check if we can create a task (need MNEE tokens)
  console.log("🧪 Testing createTask function...");
  
  // For testnet, we'll try to create a task
  // Note: This will fail if you don't have MNEE tokens, but we can see the error
  try {
    // Check MNEE balance
    const MNEE_ABI = [
      "function balanceOf(address account) external view returns (uint256)",
      "function allowance(address owner, address spender) external view returns (uint256)",
      "function approve(address spender, uint256 amount) external returns (bool)",
      "function decimals() external view returns (uint8)"
    ];
    
    const mneeContract = await hre.ethers.getContractAt(MNEE_ABI, mneeAddress);
    
    try {
      const mneeBalance = await mneeContract.balanceOf(deployer.address);
      const decimals = await mneeContract.decimals();
      console.log("  MNEE Balance:", hre.ethers.formatUnits(mneeBalance, decimals));
      
      if (mneeBalance === 0n) {
        console.log("  ⚠️  No MNEE tokens. Cannot create task.");
        console.log("  💡 Get MNEE tokens or use MockMNEE for testing");
        console.log("");
        
        // Test getting pending tasks instead
        console.log("📋 Testing getPendingTasks function...");
        const pendingTasks = await aptan.getPendingTasks();
        console.log("  Pending tasks:", pendingTasks.length);
        if (pendingTasks.length > 0) {
          console.log("  Task IDs:", pendingTasks.map(t => t.toString()).join(", "));
        }
        return;
      }

      // Try to create a task
      const rewardAmount = hre.ethers.parseUnits("1", decimals); // 1 MNEE
      const deadline = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
      
      // Check allowance
      const allowance = await mneeContract.allowance(deployer.address, aptanAddress);
      if (allowance < rewardAmount) {
        console.log("  Approving MNEE spending...");
        const approveTx = await mneeContract.approve(aptanAddress, hre.ethers.MaxUint256);
        await approveTx.wait();
        console.log("  ✅ Approved");
      }

      console.log("  Creating test task...");
      const tx = await aptan.createTask(
        "Test task from script - Verify APTAN is working",
        rewardAmount,
        deadline
      );
      console.log("  Transaction hash:", tx.hash);
      console.log("  Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log("  ✅ Task created successfully!");
      console.log("  Gas used:", receipt.gasUsed.toString());
      
      // Get the new task
      const newTaskCounter = await aptan.taskCounter();
      const taskId = Number(newTaskCounter);
      console.log("  New task ID:", taskId);
      
      const task = await aptan.getTask(taskId);
      console.log("  Task creator:", task.creator);
      console.log("  Task reward:", hre.ethers.formatUnits(task.reward, decimals), "MNEE");
      console.log("  Task description:", task.description);
      console.log("");
      console.log("✅ Transaction successful!");
      console.log(`View on Etherscan: https://${addresses.network === 'sepolia' ? 'sepolia.' : ''}etherscan.io/tx/${tx.hash}`);
      
    } catch (error) {
      if (error.message.includes("symbol") || error.message.includes("decimals")) {
        console.log("  ⚠️  MNEE contract may not exist on this network");
        console.log("  This is normal if MNEE is only on mainnet");
        console.log("");
        console.log("📋 Testing other functions instead...");
        
        // Test getting pending tasks
        const pendingTasks = await aptan.getPendingTasks();
        console.log("  Pending tasks:", pendingTasks.length);
        
        // Test getting contract balance
        try {
          const contractBalance = await aptan.getContractBalance();
          console.log("  Contract MNEE balance:", contractBalance.toString());
        } catch (e) {
          console.log("  Could not get contract balance");
        }
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.log("");
    console.log("📋 Testing read-only functions instead...");
    
    // Test read-only functions
    try {
      const pendingTasks = await aptan.getPendingTasks();
      console.log("  ✅ getPendingTasks() works:", pendingTasks.length, "tasks");
    } catch (e) {
      console.log("  ⚠️  getPendingTasks() error:", e.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

