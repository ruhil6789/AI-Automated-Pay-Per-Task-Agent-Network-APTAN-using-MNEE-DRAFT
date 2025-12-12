// Test script to manually trigger sync and verify data
const { MongoClient } = require("mongodb");
require("dotenv").config();

async function testSync() {
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const DB_NAME = process.env.DB_NAME || "aptan";
  
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const tasksCollection = db.collection("tasks");
    
    console.log("📊 Testing MongoDB connection and data...");
    
    // Count tasks
    const totalTasks = await tasksCollection.countDocuments({});
    console.log(`Total tasks: ${totalTasks}`);
    
    // Get all tasks
    const tasks = await tasksCollection.find({}).sort({ blockNumber: -1 }).toArray();
    console.log(`\n📋 All tasks in database:`);
    tasks.forEach((t, i) => {
      console.log(`${i + 1}. Task ${t.taskId}:`);
      console.log(`   Description: ${t.description}`);
      console.log(`   Block: ${t.blockNumber}`);
      console.log(`   Completed: ${t.completed}`);
      console.log(`   TX Hash: ${t.txHash}`);
      console.log("");
    });
    
    // Get sync state
    const syncState = await tasksCollection.findOne({ _id: "sync_state" });
    if (syncState) {
      console.log(`📡 Sync State:`);
      console.log(`   Last synced block: ${syncState.lastSyncedBlock}`);
      console.log(`   Last sync time: ${new Date(syncState.lastSyncTime).toLocaleString()}`);
    } else {
      console.log("⚠️  No sync state found");
    }
    
    await client.close();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testSync();

