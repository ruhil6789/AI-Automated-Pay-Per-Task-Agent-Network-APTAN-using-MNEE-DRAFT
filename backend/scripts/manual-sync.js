// Manual sync script to debug why data isn't being saved
const { ethers } = require("ethers");
const { MongoClient } = require("mongodb");
require("dotenv").config();

// Try both contract addresses
const CONTRACT_ADDRESSES = [
  process.env.CONTRACT_ADDRESS || "0x1be0f1D26748C6C879b988e3516A284c7EA1380A", // Latest Production
  "0x34F0f88b1E637640F1fB0B01dBDFd02F7a8B7B92" // Test Contract (MockMNEE)
];
// Try multiple RPCs
const RPC_URLS = [
  process.env.RPC_URL,
  "https://rpc.sepolia.org",
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
  "https://rpc.ankr.com/eth_sepolia"
].filter(Boolean);
const SYNC_FROM_BLOCK = parseInt(process.env.SYNC_FROM_BLOCK || "9788210");
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "aptan";

// Contract ABI (with proper struct definition for getTask)
const contractABI = [
  "event TaskCreated(uint256 indexed taskId, address indexed creator, uint256 reward, string description, uint256 deadline)",
  "event TaskCompleted(uint256 indexed taskId, address indexed agent, string solution)",
  {
    "inputs": [{ "internalType": "uint256", "name": "taskId", "type": "uint256" }],
    "name": "getTask",
    "outputs": [{
      "components": [
        { "internalType": "address", "name": "creator", "type": "address" },
        { "internalType": "uint256", "name": "reward", "type": "uint256" },
        { "internalType": "string", "name": "description", "type": "string" },
        { "internalType": "uint256", "name": "deadline", "type": "uint256" },
        { "internalType": "bool", "name": "completed", "type": "bool" },
        { "internalType": "address", "name": "agent", "type": "address" },
        { "internalType": "string", "name": "solution", "type": "string" },
        { "internalType": "uint256", "name": "createdAt", "type": "uint256" }
      ],
      "internalType": "struct APTAN.Task",
      "name": "",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  }
];

async function manualSync() {
  try {
    // Try connecting with multiple RPCs
    let provider;
    for (const rpc of RPC_URLS) {
      try {
        console.log(`🔌 Trying RPC: ${rpc}...`);
        provider = new ethers.JsonRpcProvider(rpc, {
          name: "sepolia",
          chainId: 11155111
        });
        const testBlock = await Promise.race([
          provider.getBlockNumber(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))
        ]);
        console.log(`✅ Connected! Current block: ${testBlock}`);
        break;
      } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        continue;
      }
    }
    
    if (!provider) {
      throw new Error("Could not connect to any RPC");
    }
    
    const currentBlock = await provider.getBlockNumber();
    console.log(`📊 Current block: ${currentBlock}`);
    console.log(`📊 Sync from block: ${SYNC_FROM_BLOCK}`);
    
    // Try both contract addresses
    let contract, taskCreatedEvents = [], contractAddress;
    
    for (const addr of CONTRACT_ADDRESSES) {
      console.log(`\n🔍 Trying contract: ${addr}`);
      contract = new ethers.Contract(addr, contractABI, provider);
      
      // Query TaskCreated events
      const taskCreatedFilter = contract.filters.TaskCreated();
      const events = await contract.queryFilter(taskCreatedFilter, SYNC_FROM_BLOCK, currentBlock);
      
      if (events.length > 0) {
        console.log(`✅ Found ${events.length} TaskCreated events on this contract!`);
        taskCreatedEvents = events;
        contractAddress = addr;
        break;
      } else {
        console.log(`   No events found on this contract`);
      }
    }
    
    if (taskCreatedEvents.length === 0) {
      console.log(`\n⚠️  No events found on any contract!`);
      console.log(`⚠️  This could mean:`);
      console.log(`   1. Events don't exist in this block range`);
      console.log(`   2. Contract address is wrong`);
      console.log(`   3. Events were emitted before block ${SYNC_FROM_BLOCK}`);
      
      // Try a wider range on the last contract we checked
      if (contract) {
        console.log(`\n🔍 Trying wider range: block 9788000 to ${currentBlock}...`);
        const taskCreatedFilter = contract.filters.TaskCreated();
        const widerEvents = await contract.queryFilter(taskCreatedFilter, 9788000, currentBlock);
        console.log(`   Found ${widerEvents.length} events in wider range`);
        
        if (widerEvents.length > 0) {
          console.log(`\n📋 Events found:`);
          widerEvents.forEach((e, i) => {
            console.log(`   ${i + 1}. Task ${e.args.taskId} at block ${e.blockNumber}`);
          });
          taskCreatedEvents = widerEvents;
          contractAddress = CONTRACT_ADDRESSES[CONTRACT_ADDRESSES.length - 1];
        }
      }
    } else {
      console.log(`\n📋 TaskCreated events:`);
      taskCreatedEvents.forEach((e, i) => {
        console.log(`   ${i + 1}. Task ${e.args.taskId} at block ${e.blockNumber}`);
        console.log(`      Creator: ${e.args.creator}`);
        console.log(`      Reward: ${e.args.reward.toString()}`);
        console.log(`      Description: ${e.args.description.substring(0, 50)}...`);
      });
    }
    
    // Query TaskCompleted events
    console.log(`\n🔍 Querying TaskCompleted events...`);
    const taskCompletedFilter = contract.filters.TaskCompleted();
    const taskCompletedEvents = await contract.queryFilter(taskCompletedFilter, SYNC_FROM_BLOCK, currentBlock);
    console.log(`✅ Found ${taskCompletedEvents.length} TaskCompleted events`);
    
    if (taskCompletedEvents.length > 0) {
      taskCompletedEvents.forEach((e, i) => {
        console.log(`   ${i + 1}. Task ${e.args.taskId} completed at block ${e.blockNumber}`);
      });
    }
    
    // Connect to MongoDB and save
    if (taskCreatedEvents.length > 0 && contractAddress) {
      console.log(`\n💾 Connecting to MongoDB...`);
      console.log(`   Using contract: ${contractAddress}`);
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      const db = client.db(DB_NAME);
      const tasksCollection = db.collection("tasks");
      
      // Reconnect contract with correct address
      contract = new ethers.Contract(contractAddress, contractABI, provider);
      
      let saved = 0;
      for (const event of taskCreatedEvents) {
        try {
          const taskId = Number(event.args.taskId);
          
          // Check if exists
          const existing = await tasksCollection.findOne({ taskId });
          if (existing) {
            console.log(`   ⏭️  Task ${taskId} already exists`);
            continue;
          }
          
          // Get task details
          console.log(`   📥 Fetching task ${taskId} from blockchain...`);
          const task = await contract.getTask(taskId);
          
          const taskDoc = {
            taskId: taskId,
            creator: task.creator,
            description: task.description,
            reward: task.reward.toString(),
            deadline: Number(task.deadline),
            completed: task.completed,
            agent: task.agent || null,
            solution: task.solution || null,
            txHash: event.transactionHash,
            blockNumber: Number(event.blockNumber),
            createdAt: Number(task.createdAt) * 1000,
            syncedAt: Date.now()
          };
          
          await tasksCollection.insertOne(taskDoc);
          saved++;
          console.log(`   ✅ Saved task ${taskId} to MongoDB`);
        } catch (error) {
          console.error(`   ❌ Error saving task ${event.args.taskId}:`, error.message);
        }
      }
      
      console.log(`\n✅ Saved ${saved} new tasks to MongoDB`);
      
      // Update sync state
      await tasksCollection.updateOne(
        { _id: "sync_state" },
        { 
          $set: { 
            lastSyncedBlock: currentBlock,
            lastSyncTime: Date.now()
          } 
        },
        { upsert: true }
      );
      
      // Verify
      const totalTasks = await tasksCollection.countDocuments({ _id: { $ne: "sync_state" } });
      console.log(`📊 Total tasks in database: ${totalTasks}`);
      
      await client.close();
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  }
}

manualSync();

