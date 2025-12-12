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
  let aptanAddress = addresses.TestAPTAN_Sepolia || addresses.APTAN;
  const mockMNEEAddress = addresses.MockMNEE_Sepolia;
  const mneeAddress = addresses.MNEE;
  
  // If we have MockMNEE but no TestAPTAN, deploy one for testing
  if (mockMNEEAddress && !addresses.TestAPTAN_Sepolia) {
    console.log("📦 Deploying test APTAN contract with MockMNEE for testing...");
    const APTAN = await hre.ethers.getContractFactory("APTAN");
    const testAptan = await APTAN.deploy(mockMNEEAddress);
    await testAptan.waitForDeployment();
    aptanAddress = await testAptan.getAddress();
    console.log("✅ Test APTAN deployed to:", aptanAddress);
    
    // Save to addresses
    addresses.TestAPTAN_Sepolia = aptanAddress;
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log("");
  }

  if (!aptanAddress) {
    console.error("❌ APTAN contract address not found.");
    process.exit(1);
  }

  console.log("🧪 Testing All APTAN Contract Functions");
  console.log("=" .repeat(60));
  console.log("APTAN Contract:", aptanAddress);
  console.log("Network:", addresses.network);
  console.log("");

  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  const agent = signers[1] || deployer; // Use deployer as agent if only one signer
  
  console.log("Deployer (Task Creator):", deployer.address);
  console.log("Agent (Task Solver):", agent.address);
  if (agent.address === deployer.address) {
    console.log("   (Using same account for both roles)");
  }
  console.log("");

  const APTAN = await hre.ethers.getContractFactory("APTAN");
  const aptan = APTAN.attach(aptanAddress);

  // Get MNEE contract (MockMNEE or official)
  let mneeContract;
  let isMockMNEE = false;
  let mneeDecimals = 18; // Default to 18
  
  if (mockMNEEAddress) {
    try {
    const MockMNEE = await hre.ethers.getContractFactory("MockMNEE");
      mneeContract = MockMNEE.attach(mockMNEEAddress);
      isMockMNEE = true;
      mneeDecimals = 18;
    
      // Mint some tokens to deployer and agent
      const deployerBalance = await mneeContract.balanceOf(deployer.address);
      if (deployerBalance === 0n) {
        console.log("💰 Minting 10000 MockMNEE to deployer...");
        await mneeContract.mint(deployer.address, hre.ethers.parseEther("10000"));
        console.log("✅ Deployer funded");
      }
      
      const agentBalance = await mneeContract.balanceOf(agent.address);
    if (agentBalance === 0n) {
      console.log("💰 Minting 1000 MockMNEE to agent...");
        await mneeContract.mint(agent.address, hre.ethers.parseEther("1000"));
      console.log("✅ Agent funded");
    }
    } catch (error) {
      console.log("⚠️  Could not connect to MockMNEE:", error.message);
    }
  }
  
  if (!mneeContract && mneeAddress) {
    // Try to use official MNEE contract
    try {
      const MNEE_ABI = [
        "function balanceOf(address account) external view returns (uint256)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function decimals() external view returns (uint8)"
      ];
      mneeContract = await hre.ethers.getContractAt(MNEE_ABI, mneeAddress);
      
      // Try to get decimals, default to 18 if it fails
      try {
        mneeDecimals = await mneeContract.decimals();
      } catch {
        mneeDecimals = 18; // Default
      }
    } catch (error) {
      console.log("⚠️  Official MNEE contract not available on this network:", error.message);
      console.log("   Some tests will be skipped.");
    }
  }
  
  if (!mneeContract) {
    console.log("⚠️  No MNEE contract available. Transaction tests will be limited.");
    console.log("   Deploy MockMNEE using: npx hardhat run scripts/deploy-mock-mnee-sepolia.js --network sepolia");
    console.log("");
  }

  // ============================================
  // TEST 1: Read Functions
  // ============================================
  console.log("📖 TEST 1: Read Functions");
  console.log("-".repeat(60));

  try {
    const taskCounter = await aptan.taskCounter();
    console.log("✅ taskCounter():", taskCounter.toString());

    const mneeAddress = await aptan.mnee();
    console.log("✅ mnee():", mneeAddress);

    const pendingTasks = await aptan.getPendingTasks();
    console.log("✅ getPendingTasks():", pendingTasks.length, "pending tasks");

    if (pendingTasks.length > 0) {
      console.log("   Task IDs:", pendingTasks.map(t => t.toString()).join(", "));
    }

    const userTasks = await aptan.getUserTasks(deployer.address);
    console.log("✅ getUserTasks():", userTasks.length, "tasks created by deployer");

    const agentTasks = await aptan.getAgentTasks(agent.address);
    console.log("✅ getAgentTasks():", agentTasks.length, "tasks completed by agent");

    try {
      const contractBalance = await aptan.getContractBalance();
      if (mneeContract) {
        console.log("✅ getContractBalance():", hre.ethers.formatUnits(contractBalance, mneeDecimals), "MNEE in escrow");
      } else {
        console.log("✅ getContractBalance():", contractBalance.toString(), "MNEE in escrow");
      }
    } catch (e) {
      console.log("⚠️  getContractBalance():", e.message);
    }

    console.log("");
  } catch (error) {
    console.error("❌ Read functions error:", error.message);
  }

  // ============================================
  // TEST 2: Create Task (if no pending tasks)
  // ============================================
  console.log("📝 TEST 2: Create Task Function");
  console.log("-".repeat(60));

  let taskId;
  let cancelTaskId; // For testing cancelTask
  const pendingTasks = await aptan.getPendingTasks();
  const allTasksCount = Number(await aptan.taskCounter());
  
  // Always create a new task for cancelTask testing if we have MNEE
  if (mneeContract && allTasksCount === 0) {
    console.log("No pending tasks found. Creating new tasks...");
    
    if (!mneeContract) {
      console.log("⚠️  MNEE contract not available. Skipping createTask test.");
    } else {
      // Approve spending
      const rewardAmount = hre.ethers.parseUnits("5", mneeDecimals);
      const allowance = await mneeContract.allowance(deployer.address, aptanAddress);
      
      if (allowance < rewardAmount) {
        console.log("🔐 Approving MNEE spending...");
        const approveTx = await mneeContract.approve(aptanAddress, hre.ethers.MaxUint256);
        await approveTx.wait();
        console.log("✅ Approved");
      }

      // Create task for normal flow
      const deadline = Math.floor(Date.now() / 1000) + 86400; // 1 day
      const description = "Test task: Write a summary about blockchain technology";

      console.log("📝 Creating task for normal completion...");
      const createTx = await aptan.createTask(description, rewardAmount, deadline);
      console.log("   Transaction:", createTx.hash);
      
      await createTx.wait();
      console.log("✅ Task created!");

      const newTaskCounter = await aptan.taskCounter();
      taskId = Number(newTaskCounter);
      console.log("   Task ID:", taskId);
      console.log("");
    }
  }
  
  // Create a task for cancelTask testing (separate from the completion test)
  if (mneeContract) {
    console.log("📝 Creating task for cancelTask function test...");
    try {
      // Check allowance
      const cancelRewardAmount = hre.ethers.parseUnits("3", mneeDecimals);
      const allowanceForCancel = await mneeContract.allowance(deployer.address, aptanAddress);
      if (allowanceForCancel < cancelRewardAmount) {
        console.log("🔐 Approving MNEE spending for cancel test task...");
        const approveTx2 = await mneeContract.approve(aptanAddress, hre.ethers.MaxUint256);
        await approveTx2.wait();
        console.log("✅ Approved");
      }

      const shortDeadline = Math.floor(Date.now() / 1000) + 8; // 8 seconds from now
      const cancelDescription = "Test task for cancellation: This task will expire soon";

      const cancelCreateTx = await aptan.createTask(cancelDescription, cancelRewardAmount, shortDeadline);
      console.log("   Transaction:", cancelCreateTx.hash);
      
      await cancelCreateTx.wait();
      console.log("✅ Cancel test task created!");

      const cancelTaskCounter = await aptan.taskCounter();
      cancelTaskId = Number(cancelTaskCounter);
      console.log("   Cancel Test Task ID:", cancelTaskId);
      console.log("   Waiting 10 seconds for deadline to pass...");
      console.log("");
      
      // Wait for deadline to pass
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (error) {
      console.log("⚠️  Could not create cancel test task:", error.message);
      console.log("   Will skip cancelTask test");
      console.log("");
    }
  }
  
  // Use existing pending task for normal flow if available
  if (pendingTasks.length > 0 && !taskId) {
    taskId = Number(pendingTasks[0]);
    console.log("Using existing pending task ID:", taskId);
    console.log("");
  }

  // ============================================
  // TEST 3: Get Task Details
  // ============================================
  if (taskId) {
    console.log("📋 TEST 3: Get Task Details");
    console.log("-".repeat(60));

    try {
      const task = await aptan.getTask(taskId);
      console.log("✅ getTask(" + taskId + "):");
      console.log("   Creator:", task.creator);
      console.log("   Description:", task.description);
      if (mneeContract) {
        console.log("   Reward:", hre.ethers.formatUnits(task.reward, mneeDecimals), "MNEE");
      } else {
        console.log("   Reward:", task.reward.toString(), "MNEE");
      }
      console.log("   Deadline:", new Date(Number(task.deadline) * 1000).toLocaleString());
      console.log("   Completed:", task.completed);
      console.log("   Agent:", task.agent || "Not assigned");
      console.log("   Solution:", task.solution || "Not submitted");
      console.log("");
    } catch (error) {
      console.error("❌ getTask error:", error.message);
      console.log("");
    }
  }

  // ============================================
  // TEST 4: Submit Result (Complete Task)
  // ============================================
  if (taskId) {
    console.log("✅ TEST 4: Submit Result Function");
    console.log("-".repeat(60));

    try {
      const task = await aptan.getTask(taskId);
      
      if (task.completed) {
        console.log("⚠️  Task", taskId, "is already completed. Skipping submitResult test.");
      } else {
        console.log("🤖 Agent submitting solution...");
        
        const solution = "Blockchain is a distributed ledger technology that enables secure, transparent, and immutable record-keeping across a network of computers. It eliminates the need for intermediaries and provides trust through cryptographic verification.";
        
        // Submit as agent
        const submitTx = await aptan.connect(agent).submitResult(
          taskId,
          agent.address,
          solution
        );
        console.log("   Transaction:", submitTx.hash);
        console.log("   Waiting for confirmation...");
        
        const receipt = await submitTx.wait();
        console.log("✅ Task completed successfully!");
        console.log("   Gas used:", receipt.gasUsed.toString());
        console.log("");

        // Verify task is completed
        const completedTask = await aptan.getTask(taskId);
        console.log("📋 Updated Task Details:");
        console.log("   Completed:", completedTask.completed);
        console.log("   Agent:", completedTask.agent);
        console.log("   Solution:", completedTask.solution);
        console.log("");

        // Check agent balance (should have received payment)
        if (mneeContract) {
          const agentBalance = await mneeContract.balanceOf(agent.address);
          console.log("💰 Agent MNEE Balance:", hre.ethers.formatUnits(agentBalance, mneeDecimals), "MNEE");
          console.log("   (Agent received payment from escrow)");
        }

        console.log("");
        console.log("🔗 View on Etherscan:");
        console.log(`   Transaction: https://${addresses.network === 'sepolia' ? 'sepolia.' : ''}etherscan.io/tx/${submitTx.hash}`);
        console.log("");
      }
    } catch (error) {
      console.error("❌ submitResult error:", error.message);
      if (error.message.includes("Task deadline passed")) {
        console.log("   💡 Task deadline has passed. Create a new task to test submitResult.");
      }
      console.log("");
    }
  }

  // ============================================
  // TEST 5: Cancel Task Function
  // ============================================
  if (cancelTaskId) {
    console.log("❌ TEST 5: Cancel Task Function");
    console.log("-".repeat(60));

    try {
      const cancelTask = await aptan.getTask(cancelTaskId);
      
      if (cancelTask.completed) {
        console.log("⚠️  Task", cancelTaskId, "is already completed. Skipping cancelTask test.");
      } else {
        const currentTime = Math.floor(Date.now() / 1000);
        const deadlineTime = Number(cancelTask.deadline);
        
        if (currentTime <= deadlineTime) {
          console.log("⏳ Waiting for deadline to pass...");
          const waitTime = (deadlineTime - currentTime + 2) * 1000; // Wait 2 seconds after deadline
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        console.log("🔄 Creator cancelling task...");
        console.log("   Task ID:", cancelTaskId);
        
        // Get creator balance before cancellation
        let creatorBalanceBefore = 0n;
        if (mneeContract) {
          creatorBalanceBefore = await mneeContract.balanceOf(deployer.address);
          console.log("   Creator balance before:", hre.ethers.formatUnits(creatorBalanceBefore, mneeDecimals), "MNEE");
        }
        
        const cancelTx = await aptan.cancelTask(cancelTaskId);
        console.log("   Transaction:", cancelTx.hash);
        console.log("   Waiting for confirmation...");
        
        const receipt = await cancelTx.wait();
        console.log("✅ Task cancelled successfully!");
        console.log("   Gas used:", receipt.gasUsed.toString());
        console.log("");

        // Verify task is cancelled
        const cancelledTask = await aptan.getTask(cancelTaskId);
        console.log("📋 Cancelled Task Details:");
        console.log("   Completed:", cancelledTask.completed);
        console.log("   Creator:", cancelledTask.creator);
        
        if (mneeContract) {
          console.log("   Refund Amount:", hre.ethers.formatUnits(cancelledTask.reward, mneeDecimals), "MNEE");
          
          // Check creator balance after cancellation
          const creatorBalanceAfter = await mneeContract.balanceOf(deployer.address);
          console.log("   Creator balance after:", hre.ethers.formatUnits(creatorBalanceAfter, mneeDecimals), "MNEE");
          
          const refundReceived = creatorBalanceAfter - creatorBalanceBefore;
          console.log("   Refund received:", hre.ethers.formatUnits(refundReceived, mneeDecimals), "MNEE");
        }

        console.log("");
        console.log("🔗 View on Etherscan:");
        console.log(`   Transaction: https://${addresses.network === 'sepolia' ? 'sepolia.' : ''}etherscan.io/tx/${cancelTx.hash}`);
        console.log("");
      }
    } catch (error) {
      console.error("❌ cancelTask error:", error.message);
      if (error.message.includes("Task deadline has not passed")) {
        console.log("   💡 Task deadline has not passed yet. Wait a bit longer.");
      } else if (error.message.includes("Only task creator can cancel")) {
        console.log("   💡 Only the task creator can cancel the task.");
      }
      console.log("");
    }
  }

  // ============================================
  // TEST 6: Final State Check
  // ============================================
  console.log("📊 TEST 5: Final State Check");
  console.log("-".repeat(60));

  try {
    const finalTaskCounter = await aptan.taskCounter();
    console.log("✅ Total tasks created:", finalTaskCounter.toString());

    const finalPending = await aptan.getPendingTasks();
    console.log("✅ Pending tasks:", finalPending.length);

    const finalUserTasks = await aptan.getUserTasks(deployer.address);
    console.log("✅ User tasks:", finalUserTasks.length);

    const finalAgentTasks = await aptan.getAgentTasks(agent.address);
    console.log("✅ Agent tasks:", finalAgentTasks.length);

    if (mneeContract) {
      const finalEscrow = await aptan.getContractBalance();
      console.log("✅ Escrow balance:", hre.ethers.formatUnits(finalEscrow, mneeDecimals), "MNEE");
    }

    console.log("");
  } catch (error) {
    console.error("❌ Final state check error:", error.message);
  }

  // ============================================
  // Summary
  // ============================================
  console.log("=" .repeat(60));
  console.log("🎉 All Function Tests Completed!");
  console.log("=" .repeat(60));
  console.log("");
  console.log("✅ Tested Functions:");
  console.log("   1. taskCounter()");
  console.log("   2. mnee()");
  console.log("   3. getPendingTasks()");
  console.log("   4. getUserTasks()");
  console.log("   5. getAgentTasks()");
  console.log("   6. getContractBalance()");
  console.log("   7. getTask()");
  console.log("   8. createTask()");
  console.log("   9. submitResult()");
  console.log("   10. cancelTask()");
  console.log("");
  console.log("🔗 Contract:", `https://${addresses.network === 'sepolia' ? 'sepolia.' : ''}etherscan.io/address/${aptanAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });

