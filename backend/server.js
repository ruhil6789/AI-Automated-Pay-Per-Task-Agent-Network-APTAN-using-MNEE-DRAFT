const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { ethers } = require("ethers");
const OpenAI = require("openai");
const { MongoClient } = require("mongodb");
const cron = require("node-cron");
const axios = require("axios");
// Load environment variables - try both root and backend directory
const path = require("path");
const fs = require("fs");

// Try to load .env from backend directory first, then root
const backendEnvPath = path.join(__dirname, ".env");
const rootEnvPath = path.join(__dirname, "..", ".env");

if (fs.existsSync(backendEnvPath)) {
  require("dotenv").config({ path: backendEnvPath });
  console.log("✅ Loaded .env from backend directory");
} else if (fs.existsSync(rootEnvPath)) {
  require("dotenv").config({ path: rootEnvPath });
  console.log("✅ Loaded .env from root directory");
} else {
  require("dotenv").config();
  console.log("⚠️  No .env file found, using system environment variables");
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`✅ WebSocket client connected: ${socket.id}`);
  console.log(`📊 Total connected clients: ${io.sockets.sockets.size}`);
  
  // Send connection confirmation
  socket.emit('connected', { 
    socketId: socket.id,
    message: 'Connected to APTAN real-time updates'
  });
  
  // Join task-specific room for targeted updates
  socket.on('joinTask', (taskId) => {
    if (taskId && !isNaN(taskId)) {
      socket.join(`task:${taskId}`);
      console.log(`📌 Client ${socket.id} joined room: task:${taskId}`);
      socket.emit('joinedTask', { taskId, room: `task:${taskId}` });
    } else {
      console.warn(`⚠️ Invalid taskId received: ${taskId}`);
    }
  });
  
  // Leave task room
  socket.on('leaveTask', (taskId) => {
    if (taskId && !isNaN(taskId)) {
      socket.leave(`task:${taskId}`);
      console.log(`📤 Client ${socket.id} left room: task:${taskId}`);
    }
  });
  
  // Handle ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong');
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`❌ WebSocket client disconnected: ${socket.id}, reason: ${reason}`);
    console.log(`📊 Remaining connected clients: ${io.sockets.sockets.size}`);
  });
  
  socket.on('error', (error) => {
    console.error(`❌ WebSocket error for client ${socket.id}:`, error);
  });
});

// Helper function to emit task updates via WebSocket
function emitTaskUpdate(taskId, updateData) {
  const update = { taskId, ...updateData };
  // Broadcast to all clients
  io.emit('taskUpdate', update);
  // Also send to task-specific room
  io.to(`task:${taskId}`).emit('taskUpdate', update);
  console.log(`📡 Emitted task update for task ${taskId}`);
}

// Initialize OpenAI - will be reinitialized if API key is available
let openai = null;

// Initialize OpenAI client if API key is available
function initializeOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log(`🔍 Checking OpenAI API key...`);
  console.log(`   Key exists: ${!!apiKey}`);
  console.log(`   Key length: ${apiKey ? apiKey.length : 0}`);
  console.log(`   Key starts with: ${apiKey ? apiKey.substring(0, 7) : 'N/A'}`);
  
  if (apiKey && apiKey.trim()) {
    try {
      openai = new OpenAI({
        apiKey: apiKey.trim()
      });
      console.log("✅ OpenAI client initialized successfully");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize OpenAI client:", error.message);
      console.error("   Error details:", error);
      return false;
    }
  } else {
    console.log("⚠️  OPENAI_API_KEY not set or empty, OpenAI will be unavailable");
    console.log("   Please set OPENAI_API_KEY in backend/.env file");
    openai = null;
    return false;
  }
}

// Initialize on startup
console.log("🚀 Initializing API clients on startup...");
initializeOpenAI();

// Log Groq key status
const groqKey = process.env.GROQ_API_KEY;
if (groqKey && groqKey.trim()) {
  console.log(`✅ GROQ_API_KEY is configured (length: ${groqKey.length})`);
} else {
  console.log("⚠️  GROQ_API_KEY not set, Groq will be unavailable");
  console.log("   Please set GROQ_API_KEY in backend/.env file");
}

// MongoDB setup
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "aptan";
let db, tasksCollection;

// Connect to MongoDB
async function connectDB() {
  try {
    console.log(`🔌 Connecting to MongoDB: ${MONGODB_URI}`);
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    tasksCollection = db.collection("tasks");
    
    // Create indexes
    await tasksCollection.createIndex({ taskId: 1 }, { unique: true });
    await tasksCollection.createIndex({ creator: 1 });
    await tasksCollection.createIndex({ completed: 1 });
    await tasksCollection.createIndex({ blockNumber: 1 });
    
    console.log(`✅ Connected to MongoDB: ${DB_NAME}`);
    console.log(`✅ Collection 'tasks' ready`);
    
    // Check existing data
    const taskCount = await tasksCollection.countDocuments({});
    console.log(`📊 Existing tasks in database: ${taskCount}`);
    
    // If contract is already initialized, start sync
    if (aptanContract) {
      console.log("🔄 Contract already initialized, starting sync...");
      startPolling();
      startSync();
    }
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    console.error("   Make sure MongoDB is running or MONGODB_URI is correct");
  }
}

connectDB();
// APTAN Contract Address - Single contract for everything
// ============================================
// CONTRACT CONFIGURATION
// ============================================
// TEST CONTRACT (MockMNEE) - For Sepolia testing
// Contract: 0x34F0f88b1E637640F1fB0B01dBDFd02F7a8B7B92
// MockMNEE: 0x0D10aC728b7DE11183c22ebE5027369394808708
// Network: Sepolia Testnet
// Contract Creation Block: ~9788210 (use SYNC_FROM_BLOCK env var to override)
//
// PRODUCTION CONTRACT (Official MNEE) - For Mainnet
// Contract: 0x1be0f1D26748C6C879b988e3516A284c7EA1380A
// MNEE: 0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF
// Network: Ethereum Mainnet
// Contract Creation Block: 9790307
//
// To switch to production:
// 1. Set CONTRACT_ADDRESS in .env to: 0x1be0f1D26748C6C879b988e3516A284c7EA1380A
// 2. Set SYNC_FROM_BLOCK in .env to: 9790307
// 3. Update frontend .env: REACT_APP_CONTRACT_ADDRESS=0x1be0f1D26748C6C879b988e3516A284c7EA1380A
// 4. Switch MetaMask to Ethereum Mainnet
// 5. Ensure you have real MNEE tokens
// ============================================
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x34F0f88b1E637640F1fB0B01dBDFd02F7a8B7B92"; // Test contract (MockMNEE) - Sepolia

// Contract creation blocks (for sync start)
const CONTRACT_CREATION_BLOCKS = {
  "0x34F0f88b1E637640F1fB0B01dBDFd02F7a8B7B92": 9788210, // Test contract
  "0x1be0f1D26748C6C879b988e3516A284c7EA1380A": 9790307  // Production contract
};
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || "";
const RPC_URL = process.env.RPC_URL || "https://rpc.sepolia.org";

// Fallback RPC URLs
const FALLBACK_RPC_URLS = [
  "https://rpc.sepolia.org",
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
  "https://rpc.ankr.com/eth_sepolia",
  "https://0xrpc.io/sep",
  "https://sepolia.infura.io/v3/c0d425159c2548f8b5b822749d1aedb8"
];

let provider, contract, wallet, aptanContract;
let contractABI; // Store ABI for reconnection
let lastSyncedBlock = 0;

// Try to connect with fallback RPCs
async function initializeProvider() {
  const rpcs = RPC_URL ? [RPC_URL, ...FALLBACK_RPC_URLS] : FALLBACK_RPC_URLS;
  
  for (let i = 0; i < rpcs.length; i++) {
    try {
      const testProvider = new ethers.JsonRpcProvider(rpcs[i], {
        name: "sepolia",
        chainId: 11155111
      });
      
      // Test connection with timeout
      const blockNumber = await Promise.race([
        testProvider.getBlockNumber(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))
      ]);
      
      console.log(`✅ Connected to RPC: ${rpcs[i]} (Block: ${blockNumber})`);
      return testProvider;
    } catch (error) {
      if (i < rpcs.length - 1) {
        console.log(`⚠️  RPC ${rpcs[i]} failed, trying next...`);
      } else {
        console.error(`❌ All RPC endpoints failed`);
        throw error;
      }
    }
  }
}

// Initialize contract
async function initializeContract() {
  if (!CONTRACT_ADDRESS || !PRIVATE_KEY) {
    console.log("⚠️  Contract address or private key not configured");
    return;
  }

  try {
    provider = await initializeProvider();
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
    contractABI = [
      "function createTask(string memory description, uint256 reward, uint256 deadline) external",
      "function submitResult(uint256 taskId, address agent, string memory solution) external",
      "function cancelTask(uint256 taskId) external",
      "function getTask(uint256 taskId) external view returns (tuple(address creator, uint256 reward, string description, uint256 deadline, bool completed, address agent, string solution, uint256 createdAt))",
      "function getPendingTasks() external view returns (uint256[] memory)",
      "function taskCounter() external view returns (uint256)",
      "function mnee() external view returns (address)",
      "event TaskCreated(uint256 indexed taskId, address indexed creator, uint256 reward, string description, uint256 deadline)",
      "event TaskCompleted(uint256 indexed taskId, address indexed agent, string solution)",
      "event PaymentReleased(uint256 indexed taskId, address indexed agent, uint256 amount)",
      "event TaskCancelled(uint256 indexed taskId, address indexed creator, uint256 refundAmount)"
    ];
    
    const MNEE_ABI = [
      "function balanceOf(address account) external view returns (uint256)",
      "function transfer(address to, uint256 amount) external returns (bool)"
    ];
    
    aptanContract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);
    console.log("✅ Contract initialized:", CONTRACT_ADDRESS);
    console.log("✅ Agent wallet:", wallet.address);
    
    // Wait for database connection before starting sync
    const checkDB = setInterval(() => {
      if (tasksCollection) {
        clearInterval(checkDB);
        // Start polling and sync
        startPolling();
        startSync();
      }
    }, 1000);
    
    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkDB);
      if (tasksCollection) {
        startPolling();
        startSync();
      } else {
        console.log("⚠️  Database not ready, sync will start when available");
      }
    }, 10000);
  } catch (error) {
    console.error("❌ Failed to initialize contract:", error.message);
    console.log("⚠️  Backend will run without blockchain connection");
  }
}

// Start polling for tasks
function startPolling() {
  if (!aptanContract) return;
  
  // Poll every 30 seconds
  setInterval(pollAndSolveTasks, 30000);
  pollAndSolveTasks(); // Initial poll
  console.log("✅ Task polling started (every 30 seconds)");
}

// Start blockchain sync
async function startSync() {
  if (!aptanContract) {
    console.log("⚠️  Cannot start sync: Contract not initialized");
    return;
  }
  
  if (!tasksCollection) {
    console.log("⚠️  Cannot start sync: Database not connected");
    return;
  }
  
  // Get last synced block from database or use default
  try {
    const syncState = await tasksCollection.findOne({ _id: "sync_state" });
    if (syncState && syncState.lastSyncedBlock) {
      // Check if contract address changed - if so, reset sync state
      if (syncState.contractAddress && syncState.contractAddress !== CONTRACT_ADDRESS) {
        console.log(`⚠️  Contract address changed from ${syncState.contractAddress} to ${CONTRACT_ADDRESS}`);
        console.log(`   Resetting sync state to start fresh...`);
        const defaultBlock = CONTRACT_CREATION_BLOCKS[CONTRACT_ADDRESS.toLowerCase()] || CONTRACT_CREATION_BLOCKS[CONTRACT_ADDRESS] || 9788210;
        const SYNC_FROM_BLOCK = process.env.SYNC_FROM_BLOCK || defaultBlock;
        lastSyncedBlock = Number(SYNC_FROM_BLOCK);
        // Update sync state with new contract address
        await tasksCollection.updateOne(
          { _id: "sync_state" },
          { 
            $set: { 
              lastSyncedBlock: lastSyncedBlock,
              contractAddress: CONTRACT_ADDRESS,
              lastSyncTime: Date.now()
            } 
          },
          { upsert: true }
        );
        console.log(`📡 Starting fresh sync from block ${lastSyncedBlock} for new contract`);
      } else {
      lastSyncedBlock = Number(syncState.lastSyncedBlock);
      console.log(`📡 Resuming sync from block ${lastSyncedBlock}`);
      }
      } else {
        const defaultBlock = CONTRACT_CREATION_BLOCKS[CONTRACT_ADDRESS.toLowerCase()] || CONTRACT_CREATION_BLOCKS[CONTRACT_ADDRESS] || 9788210;
        const SYNC_FROM_BLOCK = process.env.SYNC_FROM_BLOCK || defaultBlock;
        lastSyncedBlock = Number(SYNC_FROM_BLOCK);
        console.log(`📡 Starting sync from block ${lastSyncedBlock} (contract creation block)`);
      // Save initial sync state with contract address
      await tasksCollection.updateOne(
        { _id: "sync_state" },
        { 
          $set: { 
            lastSyncedBlock: lastSyncedBlock,
            contractAddress: CONTRACT_ADDRESS,
            lastSyncTime: Date.now()
          } 
        },
        { upsert: true }
      );
    }
  } catch (error) {
    console.error("Error getting sync state:", error.message);
    const defaultBlock = CONTRACT_CREATION_BLOCKS[CONTRACT_ADDRESS.toLowerCase()] || CONTRACT_CREATION_BLOCKS[CONTRACT_ADDRESS] || 9788210;
    const SYNC_FROM_BLOCK = process.env.SYNC_FROM_BLOCK || defaultBlock;
    lastSyncedBlock = Number(SYNC_FROM_BLOCK);
    console.log(`📡 Starting sync from block ${lastSyncedBlock} (contract creation block)`);
  }
  
  // Sync on startup
  console.log("🔄 Starting initial blockchain sync...");
  await syncBlockchainData(lastSyncedBlock);
  
  // Cron job: Sync every 10 seconds (for testing) - change to "*/5 * * * *" for 5 minutes
  cron.schedule("*/10 * * * * *", async () => {
    if (aptanContract && tasksCollection) {
      console.log("🔄 Cron: Starting blockchain sync...");
      // Sync from last synced block + 1
      const syncState = await tasksCollection.findOne({ _id: "sync_state" });
      const fromBlock = syncState?.lastSyncedBlock ? Number(syncState.lastSyncedBlock) + 1 : lastSyncedBlock + 1;
      await syncBlockchainData(fromBlock);
    }
  });
  
  console.log("✅ Blockchain sync cron job started (every 10 seconds)");
}

// Initialize contract on startup
initializeContract();

// AI Provider Helper Functions

// Try OpenAI API
async function tryOpenAI(description) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.error("❌ OpenAI API key is empty or not set in environment variables");
    throw new Error("OpenAI API key not configured");
  }
  
  // Reinitialize OpenAI client if needed
  if (!openai) {
    console.log("🔄 Reinitializing OpenAI client...");
    const initialized = initializeOpenAI();
    if (!initialized) {
      console.error("❌ Failed to initialize OpenAI client");
      throw new Error("OpenAI API key not configured or invalid");
    }
  }
  
  // Verify client is ready
  if (!openai) {
    throw new Error("OpenAI client not initialized");
  }

  const models = ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"];
  let lastError = null;
  
  for (const model of models) {
    try {
      console.log(`🔄 Calling OpenAI API with model: ${model}...`);
      const response = await Promise.race([
        openai.chat.completions.create({
          model: model,
          messages: [
            {
              role: "system",
              content: "You are an autonomous task-solving agent. Solve the given task accurately and provide a clear, complete solution."
            },
            {
              role: "user",
              content: description
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("OpenAI request timeout after 30s")), 30000))
      ]);

      console.log(`📥 OpenAI ${model} response received`);
      if (!response || !response.choices || !response.choices[0]) {
        console.error(`❌ OpenAI ${model} returned invalid response structure:`, JSON.stringify(response));
        throw new Error(`OpenAI ${model} returned invalid response`);
      }

      const solution = response.choices[0].message.content;
      if (solution && solution.trim().length > 0) {
        console.log(`✅ OpenAI ${model} returned solution (${solution.length} chars)`);
        return solution;
      } else {
        console.warn(`⚠️  OpenAI ${model} returned empty solution`);
      }
    } catch (error) {
      lastError = error;
      console.error(`❌ OpenAI ${model} error:`, {
        message: error.message,
        code: error.code,
        status: error.status,
        type: error.type,
        stack: error.stack?.substring(0, 200)
      });
      
      // Log more details for debugging
      if (error.response) {
        console.error(`   Response status: ${error.response.status}`);
        console.error(`   Response data:`, JSON.stringify(error.response.data));
      }
      
      const recoverableErrors = ['model_not_found', 'insufficient_quota', 'rate_limit_exceeded', '429'];
      if (!recoverableErrors.includes(error.code) && error.status !== 429) {
        // Non-recoverable error, stop trying OpenAI
        console.error(`❌ Non-recoverable OpenAI error, stopping attempts`);
        throw new Error(`OpenAI error (${error.code || error.status}): ${error.message}`);
      }
      // Continue to next model for recoverable errors
      console.log(`🔄 Trying next OpenAI model...`);
    }
  }
  
  // All models failed
  if (lastError) {
    throw new Error(`OpenAI all models failed: ${lastError.message} (code: ${lastError.code || 'unknown'})`);
  }
  throw new Error("OpenAI failed: Unknown error");
}

// Try Groq API (Free tier available - very fast)
async function tryGroq(description) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.error("❌ Groq API key is empty or not set in environment variables");
    throw new Error("Groq API key not configured");
  }
  
  // Don't log full API key for security, just confirm it's being used
  console.log(`🔑 Using Groq API key (length: ${apiKey.length}, starts with: ${apiKey.substring(0, 7)})`);

  try {
    console.log(`🔄 Calling Groq API...`);
    const response = await Promise.race([
      axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile', // Updated model (llama-3.1-70b-versatile was decommissioned)
          messages: [
            {
              role: "system",
              content: "You are an autonomous task-solving agent. Solve the given task accurately and provide a clear, complete solution."
            },
            {
              role: "user",
              content: description
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Groq request timeout after 30s")), 30000))
    ]);

    console.log(`📥 Groq API response received`);
    if (!response || !response.data) {
      console.error(`❌ Groq returned no data:`, response);
      throw new Error("Groq returned no response data");
    }
    
    if (!response.data.choices || !response.data.choices[0]) {
      console.error(`❌ Groq returned invalid response format:`, JSON.stringify(response.data));
      throw new Error("Groq returned invalid response format");
    }

    const solution = response.data.choices[0].message.content;
    if (!solution || solution.trim().length === 0) {
      console.error(`❌ Groq returned empty solution`);
      throw new Error("Groq returned empty solution");
    }
    
    console.log(`✅ Groq returned solution (${solution.length} chars)`);
    return solution.trim();
  } catch (error) {
    console.error(`❌ Groq API error details:`, {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    });
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      console.error(`   HTTP Status: ${status}`);
      console.error(`   Response Data:`, JSON.stringify(data));
      
      if (status === 401 || status === 403) {
        throw new Error(`Groq API authentication failed (${status}): Check your GROQ_API_KEY - it may be invalid or expired`);
      } else if (status === 429) {
        throw new Error(`Groq API rate limit exceeded (${status}): Please wait before trying again`);
      } else {
        throw new Error(`Groq API error (${status}): ${data?.error?.message || error.message}`);
      }
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error(`Groq API network error: ${error.message} - Check your internet connection`);
    }
    
    throw new Error(`Groq API error: ${error.message}`);
  }
}

// Main AI Agent function with OpenAI and Groq only
async function solveTask(description) {
  console.log(`🤖 Solving task: "${description.substring(0, 50)}..."`);
  
  // Check which providers are configured with detailed logging
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const hasOpenAI = !!(openaiKey && openaiKey.trim());
  const hasGroq = !!(groqKey && groqKey.trim());
  
  console.log(`🔑 API Keys Status:`);
  console.log(`   OpenAI: ${hasOpenAI ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   Groq: ${hasGroq ? '✅ Configured' : '❌ Not configured'}`);
  
  if (!hasOpenAI && !hasGroq) {
    console.error("❌ No AI providers configured! Please set OPENAI_API_KEY or GROQ_API_KEY in backend/.env");
    console.error("   Make sure the .env file is in the backend/ directory and the server has been restarted after adding keys.");
    const fallbackSolution = generateFallbackSolution(description, { 
      code: 'no_providers_configured', 
      message: 'No AI providers configured' 
    });
    return { 
      success: true, 
      solution: fallbackSolution,
      fallback: true,
      originalError: 'No AI providers configured',
      errorCode: 'no_providers_configured'
    };
  }
  
  // Try providers in order: OpenAI -> Groq -> Basic Fallback
  const providers = [];
  if (hasOpenAI) {
    providers.push({ name: 'OpenAI', fn: () => tryOpenAI(description) });
  }
  if (hasGroq) {
    providers.push({ name: 'Groq', fn: () => tryGroq(description) });
  }

  let lastError = null;
  for (const provider of providers) {
    try {
      console.log(`🔄 Trying ${provider.name}...`);
      const startTime = Date.now();
      const solution = await provider.fn();
      const duration = Date.now() - startTime;
      if (solution && solution.trim().length > 0) {
        console.log(`✅ Successfully solved task using ${provider.name} (${duration}ms)`);
        return { 
          success: true, 
          solution: solution.trim(),
          provider: provider.name
        };
      } else {
        console.log(`⚠️  ${provider.name} returned empty solution`);
      }
    } catch (error) {
      lastError = error;
      console.error(`❌ ${provider.name} error: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data: ${JSON.stringify(error.response.data)}`);
      }
      if (error.code) {
        console.error(`   Error Code: ${error.code}`);
      }
      // Continue to next provider
      continue;
    }
  }

  // All AI providers failed - use basic fallback
  console.error("❌ All AI providers failed, using basic fallback solution generator");
  console.error(`   Last error: ${lastError?.message || 'Unknown error'}`);
  const fallbackSolution = generateFallbackSolution(description, { 
    code: 'all_providers_failed', 
    message: lastError?.message || 'All AI providers unavailable' 
  });
  
  return { 
    success: true, 
    solution: fallbackSolution,
    fallback: true,
    originalError: lastError?.message || 'All AI providers unavailable',
    errorCode: 'all_providers_failed'
  };
}

// Fallback solution generator when OpenAI API fails
function generateFallbackSolution(description, error) {
  const lowerDesc = description.toLowerCase();
  
  // Simple pattern matching for common task types
  if (lowerDesc.includes('hello') || lowerDesc.includes('hellow') || lowerDesc.includes('greet')) {
    return "Hello! Greetings and welcome. This is a friendly response to your greeting task.";
  }
  
  if (lowerDesc.includes('blog') || lowerDesc.includes('write blog') || lowerDesc.includes('article')) {
    const topic = description.replace(/write|blog|article|on/gi, '').trim() || 'Blockchain';
    return `# Blog Post: ${topic}\n\n## Introduction\n\n${topic} is a revolutionary technology that has transformed how we think about digital transactions and data integrity.\n\n## Key Points\n\n1. **Decentralization**: ${topic} operates on a distributed network, eliminating the need for central authorities.\n\n2. **Transparency**: All transactions are recorded on a public ledger, ensuring transparency and accountability.\n\n3. **Security**: Cryptographic techniques ensure that data cannot be tampered with once recorded.\n\n4. **Immutability**: Once data is added to the blockchain, it becomes extremely difficult to alter.\n\n## Applications\n\n${topic} technology has applications in:\n- Financial services and cryptocurrencies\n- Supply chain management\n- Digital identity verification\n- Smart contracts and decentralized applications\n- Voting systems\n\n## Conclusion\n\n${topic} represents a paradigm shift in how we handle digital information, offering unprecedented levels of security, transparency, and decentralization.\n\n---\n*This blog post was generated by the fallback system. For AI-powered content, please configure an OpenAI API key.*`;
  }
  
  if (lowerDesc.includes('explain') || lowerDesc.includes('what is') || lowerDesc.includes('describe')) {
    const topic = description.replace(/explain|what is|describe/gi, '').trim();
    return `Here's an explanation of ${topic}: This is a basic explanation generated by the fallback system. For a more detailed response, please ensure OpenAI API is properly configured.`;
  }
  
  // Handle math questions
  if (lowerDesc.includes('sum') || lowerDesc.includes('plus') || lowerDesc.includes('add') || 
      lowerDesc.includes('minus') || lowerDesc.includes('multiply') || lowerDesc.includes('divide')) {
    // Try to extract and solve simple math
    const mathMatch = description.match(/(\d+)\s*(plus|\+|\-|minus|multiply|\*|divide|\/)\s*(\d+)/i);
    if (mathMatch) {
      const num1 = parseInt(mathMatch[1]);
      const num2 = parseInt(mathMatch[3]);
      const op = mathMatch[2].toLowerCase();
      let result;
      if (op === 'plus' || op === '+') result = num1 + num2;
      else if (op === 'minus' || op === '-') result = num1 - num2;
      else if (op === 'multiply' || op === '*') result = num1 * num2;
      else if (op === 'divide' || op === '/') result = num1 / num2;
      else result = num1 + num2; // default to addition
      return `The answer is: ${result}\n\nCalculation: ${num1} ${op} ${num2} = ${result}`;
    }
  }
  
  if (lowerDesc.includes('write') || lowerDesc.includes('create') || lowerDesc.includes('generate')) {
    return `Task completed: ${description}\n\nThis response was generated by the basic fallback system. To get AI-powered responses, please configure:\n- OpenAI API key (OPENAI_API_KEY) in backend/.env\n- OR Groq API key (GROQ_API_KEY) in backend/.env - Free tier available at https://console.groq.com`;
  }
  
  // Generic fallback
  return `Task Response: ${description}\n\nThis is an automated response generated by the basic fallback system. The AI agent attempted to solve this task but both OpenAI and Groq providers are currently unavailable.\n\nTo enable AI-powered task completion, please ensure:\n- OPENAI_API_KEY is set correctly in backend/.env\n- OR GROQ_API_KEY is set correctly in backend/.env (Free tier available at https://console.groq.com)\n\nPlease check your API keys and restart the backend server. The task has been processed and logged.`;
}

// Poll for new tasks and solve them
async function pollAndSolveTasks() {
  if (!aptanContract || !tasksCollection) {
    return; // Silently skip if not initialized
  }

  try {
    const pendingTasks = await aptanContract.getPendingTasks();
    if (pendingTasks.length > 0) {
      console.log(`Found ${pendingTasks.length} pending tasks`);
    }

    for (const taskId of pendingTasks) {
      const taskIdNum = Number(taskId);
      
      try {
        // Check if already processed
        const existingTask = await tasksCollection.findOne({ 
          taskId: taskIdNum, 
          completed: true 
        });
        
        if (existingTask) {
          continue; // Already completed
        }

        // Get task details
        const task = await aptanContract.getTask(taskIdNum);
        
        if (task.completed) {
          continue; // Already completed
        }

        console.log(`Solving task ${taskIdNum}: ${task.description}`);
        
        // Solve the task
        const result = await solveTask(task.description);
        
        // Check if solution was successful
        if (!result.success) {
          // Save error to database but don't submit to blockchain
          const errorMessage = `Failed to solve task: ${result.error}`;
          console.error(`❌ ${errorMessage}`);
          
          await tasksCollection.updateOne(
            { taskId: taskIdNum },
            { 
              $set: { 
                solution: errorMessage,
                solutionError: result.error,
                solutionErrorCode: result.code,
                attemptedAt: Date.now(),
                attemptedBy: wallet.address
              } 
            },
            { upsert: true }
          );
          continue; // Skip this task, try next one
        }
        
        const solution = result.solution;
        
        // Validate solution before submitting
        if (!solution || solution.trim().length === 0) {
          console.error(`❌ Empty solution for task ${taskIdNum}, skipping...`);
          await tasksCollection.updateOne(
            { taskId: taskIdNum },
            { 
              $set: { 
                solution: "Error: Empty solution generated",
                solutionError: "Empty solution generated",
                attemptedAt: Date.now(),
                attemptedBy: wallet.address
              } 
            },
            { upsert: true }
          );
          continue;
        }
        
        // Ensure solution is not too long (blockchain string limit)
        const MAX_SOLUTION_LENGTH = 10000; // Reasonable limit
        let trimmedSolution = solution.length > MAX_SOLUTION_LENGTH 
          ? solution.substring(0, MAX_SOLUTION_LENGTH) + "... [truncated]"
          : solution;
        
        // Check if task deadline has passed
        const currentTime = Math.floor(Date.now() / 1000);
        if (Number(task.deadline) < currentTime) {
          console.error(`❌ Task ${taskIdNum} deadline has passed, skipping...`);
          await tasksCollection.updateOne(
            { taskId: taskIdNum },
            { 
              $set: { 
                solution: "Error: Task deadline has passed",
                attemptedAt: Date.now(),
                attemptedBy: wallet.address
              } 
            },
            { upsert: true }
          );
          continue;
        }
        
        // Submit solution to contract with retry logic
        try {
          console.log(`📤 Submitting solution for task ${taskIdNum}...`);
          console.log(`📝 Solution length: ${trimmedSolution.length} characters`);
          console.log(`📝 Solution preview: ${trimmedSolution.substring(0, 100)}...`);
          
          let tx, receipt;
          const maxRetries = 3;
          let lastSubmitError = null;
          let success = false;
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            // Double-check task is still pending before submitting
            const currentTask = await aptanContract.getTask(taskIdNum);
            console.log(`🔍 Task ${taskIdNum} status check (attempt ${attempt}/${maxRetries}):`);
            console.log(`   - Completed: ${currentTask.completed}`);
            console.log(`   - Deadline: ${Number(currentTask.deadline)} (current: ${Math.floor(Date.now() / 1000)})`);
            console.log(`   - Reward: ${currentTask.reward.toString()}`);
            
            if (currentTask.completed) {
              throw new Error("Task already completed");
            }
            
            // Check deadline again
            const currentTime = Math.floor(Date.now() / 1000);
            if (Number(currentTask.deadline) < currentTime) {
              throw new Error("Task deadline has passed");
            }
            
            // Check contract MNEE balance (Approach 1: Pre-check balance)
            try {
              const mneeAddress = await aptanContract.mnee();
              const mneeContract = new ethers.Contract(mneeAddress, [
                "function balanceOf(address account) external view returns (uint256)"
              ], provider);
              const contractBalance = await mneeContract.balanceOf(CONTRACT_ADDRESS);
              const rewardAmount = currentTask.reward;
              console.log(`💰 Contract MNEE balance: ${ethers.formatEther(contractBalance)} MNEE`);
              console.log(`💰 Required reward: ${ethers.formatEther(rewardAmount)} MNEE`);
              
              if (contractBalance < rewardAmount) {
                throw new Error(`Insufficient MNEE in contract escrow. Contract has ${ethers.formatEther(contractBalance)} MNEE but needs ${ethers.formatEther(rewardAmount)} MNEE`);
              }
            } catch (balanceError) {
              console.error(`⚠️  Balance check failed: ${balanceError.message}`);
              // Continue anyway, let the transaction fail if balance is insufficient
            }
            
            // Estimate gas first to catch errors early
            try {
              const gasEstimate = await aptanContract.submitResult.estimateGas(
                taskIdNum,
                wallet.address,
                trimmedSolution
              );
              console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
            } catch (estimateError) {
              // Decode the error reason if possible
              let errorReason = estimateError.reason || estimateError.message || "Transaction would revert";
              
              // Try to decode common revert reasons from error data
              if (estimateError.data) {
                try {
                  // Check for common revert reasons in message
                  const errorMsg = estimateError.message?.toLowerCase() || '';
                  if (errorMsg.includes("task already completed") || errorMsg.includes("already completed")) {
                    errorReason = "Task already completed";
                  } else if (errorMsg.includes("deadline") || errorMsg.includes("deadline passed")) {
                    errorReason = "Task deadline has passed";
                  } else if (errorMsg.includes("invalid task") || errorMsg.includes("invalid task id")) {
                    errorReason = "Invalid task ID";
                  } else if (errorMsg.includes("payment") || errorMsg.includes("transfer failed")) {
                    errorReason = "Payment transfer failed - contract may not have enough MNEE tokens in escrow";
                  } else if (errorMsg.includes("revert")) {
                    errorReason = `Transaction would revert: ${estimateError.message}`;
                  }
                  
                  // Try to decode error data using contract interface
                  try {
                    const iface = new ethers.Interface(contractABI);
                    const decodedError = iface.parseError(estimateError.data);
                    if (decodedError) {
                      errorReason = decodedError.name + ": " + (decodedError.args?.join(", ") || "");
                      console.log(`🔍 Decoded error: ${errorReason}`);
                    }
                  } catch (decodeError) {
                    // Couldn't decode, continue with message-based detection
                  }
                } catch (e) {
                  // Couldn't decode, use original error
                  console.error("Error decoding revert reason:", e);
                }
              }
              
              throw new Error(errorReason);
            }
            
            // Submit transaction
            tx = await aptanContract.submitResult(
              taskIdNum,
              wallet.address,
              trimmedSolution
            );
            
            console.log(`⏳ Transaction submitted (attempt ${attempt}/${maxRetries}): ${tx.hash}, waiting for confirmation...`);
            receipt = await tx.wait();
            
            if (receipt.status === 0) {
              // Try to decode revert reason from receipt
              let revertReason = "Transaction reverted (status: 0)";
              try {
                // Check logs for error events
                if (receipt.logs && receipt.logs.length === 0) {
                  revertReason = "Transaction reverted with no events - likely a require() failure";
                }
              } catch (e) {
                console.error("Error analyzing receipt:", e);
              }
              throw new Error(revertReason);
            }
            
            console.log(`✅ Task ${taskIdNum} completed! TX: ${tx.hash}`);
            success = true;
            break; // Success, exit retry loop
            
          } catch (submitError) {
            lastSubmitError = submitError;
            console.error(`❌ Attempt ${attempt}/${maxRetries} failed: ${submitError.message}`);
            
            // If it's a non-retryable error, break immediately
            if (submitError.message.includes("Task already completed") || 
                submitError.message.includes("deadline has passed") ||
                submitError.message.includes("Invalid task ID")) {
              throw submitError;
            }
            
            // Wait before retry (exponential backoff)
            if (attempt < maxRetries) {
              const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
              console.log(`⏳ Waiting ${waitTime/1000}s before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              
              // Try with minimal solution on last retry (Approach 2: Fallback to minimal solution)
              if (attempt === maxRetries - 1 && trimmedSolution.length > 100) {
                console.log(`🔄 Last retry: Trying with minimal solution...`);
                trimmedSolution = trimmedSolution.substring(0, 100) + "... [truncated for retry]";
              }
            }
          }
        }
        
          // If all retries failed, throw the last error
          if (!success) {
            throw lastSubmitError || new Error("All retry attempts failed");
          }

          // Update database with blockchain data
          await tasksCollection.updateOne(
            { taskId: taskIdNum },
            { 
              $set: { 
                completed: true, 
                agent: wallet.address, 
                solution: trimmedSolution,
                completedTxHash: tx.hash,
                completedBlockNumber: receipt.blockNumber,
                completedAt: Date.now()
              } 
            },
            { upsert: true }
          );
          
          // Emit real-time update via WebSocket
          emitTaskUpdate(taskIdNum, {
            completed: true,
            agent: wallet.address,
            solution: trimmedSolution,
            completedTxHash: tx.hash,
            completedBlockNumber: receipt.blockNumber,
            completedAt: Date.now()
          });
          
        } catch (txError) {
          // Transaction failed - save error to database
          let errorMsg = txError.reason || txError.message || "Transaction failed";
          
          // Decode common error messages
          if (txError.message?.includes("Task already completed")) {
            errorMsg = "Task already completed";
          } else if (txError.message?.includes("deadline") || txError.message?.includes("Deadline")) {
            errorMsg = "Task deadline has passed";
          } else if (txError.message?.includes("Invalid task ID")) {
            errorMsg = "Invalid task ID";
          } else if (txError.message?.includes("Payment transfer failed") || txError.message?.includes("transfer")) {
            errorMsg = "Payment transfer failed - contract may not have enough MNEE tokens in escrow";
          } else if (txError.message?.includes("revert")) {
            errorMsg = `Transaction reverted: ${txError.message}`;
          }
          
          console.error(`❌ Transaction failed for task ${taskIdNum}:`, errorMsg);
          
        await tasksCollection.updateOne(
          { taskId: taskIdNum },
          { 
            $set: { 
              solution: `Error submitting solution: ${errorMsg}`,
              solutionError: errorMsg,
              transactionError: true,
              attemptedAt: Date.now(),
              attemptedBy: wallet.address,
              failedTxHash: tx?.hash || null
            } 
          },
          { upsert: true }
        );
        
        // Emit error update via WebSocket
        emitTaskUpdate(taskIdNum, {
          completed: false,
          solutionError: errorMsg,
          transactionError: true,
          attemptedAt: Date.now()
        });
        
        // Continue to next task instead of throwing
        }
      } catch (error) {
        console.error(`Error processing task ${taskIdNum}:`, error);
        // Save error to database
        try {
          await tasksCollection.updateOne(
            { taskId: taskIdNum },
            { 
              $set: { 
                solution: `Error processing task: ${error.message}`,
                solutionError: error.message,
                attemptedAt: Date.now(),
                attemptedBy: wallet.address
              } 
            },
            { upsert: true }
          );
        } catch (dbError) {
          console.error(`Failed to save error to database:`, dbError.message);
        }
      }
    }
  } catch (error) {
    // Only log if it's not a network error (to reduce spam)
    if (!error.message.includes("SERVER_ERROR") && !error.message.includes("network")) {
      console.error("Error polling tasks:", error.message);
    }
    // Silently retry on next poll
  }
}

// Sync blockchain data to database
async function syncBlockchainData(fromBlock = 0) {
  if (!aptanContract) {
    console.log("⚠️  Contract not initialized, skipping sync");
    return;
  }
  
  if (!tasksCollection) {
    console.log("⚠️  Database not connected, skipping sync");
    return;
  }

  try {
    // Get current block number with retry logic
    let currentBlock;
    let retries = 3;
    while (retries > 0) {
    try {
      currentBlock = await provider.getBlockNumber();
        break;
    } catch (error) {
        retries--;
        if (retries === 0) {
          console.error("❌ Error getting current block after retries:", error.message);
          // Try to reconnect to a different RPC
          try {
            provider = await initializeProvider();
            wallet = new ethers.Wallet(PRIVATE_KEY, provider);
            currentBlock = await provider.getBlockNumber();
            if (contractABI) {
              aptanContract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);
            }
            console.log("✅ Reconnected to RPC, retrying sync...");
          } catch (reconnectError) {
            console.error("❌ Failed to reconnect:", reconnectError.message);
      return;
    }
        } else {
          console.log(`⚠️  RPC error, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // Limit sync to 1000 blocks per cycle to avoid missing events and RPC timeouts
    const BLOCKS_PER_SYNC = 1000;
    const defaultBlock = CONTRACT_CREATION_BLOCKS[CONTRACT_ADDRESS.toLowerCase()] || CONTRACT_CREATION_BLOCKS[CONTRACT_ADDRESS] || 9788210;
    const CONTRACT_CREATION_BLOCK = process.env.SYNC_FROM_BLOCK ? Number(process.env.SYNC_FROM_BLOCK) : defaultBlock;
    
    // Ensure we start from contract creation block if fromBlock is before it
    const actualFromBlock = Math.max(fromBlock, CONTRACT_CREATION_BLOCK);
    
    // Limit toBlock to 1000 blocks ahead, but don't exceed current block
    const toBlock = Math.min(actualFromBlock + BLOCKS_PER_SYNC - 1, currentBlock);
    
    if (actualFromBlock > toBlock) {
      console.log(`⏭️  Already synced up to current block (${currentBlock})`);
      return;
    }
    
    const blocksToSync = toBlock - actualFromBlock + 1;
    console.log(`📡 Syncing ${blocksToSync} blocks: ${actualFromBlock} to ${toBlock} (max 1000 blocks per cycle)...`);
    
    // Get TaskCreated events
    let taskCreatedEvents = [];
    try {
      const taskCreatedFilter = aptanContract.filters.TaskCreated();
      
      // Verify contract exists
      const contractCode = await provider.getCode(CONTRACT_ADDRESS);
      if (!contractCode || contractCode === "0x") {
        console.error(`❌ Contract not found at ${CONTRACT_ADDRESS}`);
        return;
      }
      
      // Query with retry logic - using actualFromBlock to ensure we start from contract creation
      let retries = 3;
      while (retries > 0) {
        try {
          taskCreatedEvents = await aptanContract.queryFilter(taskCreatedFilter, actualFromBlock, toBlock);
          break;
        } catch (error) {
          retries--;
          if (retries === 0) {
            try {
              provider = await initializeProvider();
              wallet = new ethers.Wallet(PRIVATE_KEY, provider);
              if (contractABI) {
                aptanContract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);
              }
              taskCreatedEvents = await aptanContract.queryFilter(taskCreatedFilter, actualFromBlock, toBlock);
            } catch (retryError) {
              throw error;
            }
          } else {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      if (taskCreatedEvents.length > 0) {
        console.log(`✅ Found ${taskCreatedEvents.length} TaskCreated event(s)`);
      }
    } catch (error) {
      console.error("❌ Error fetching TaskCreated events:", error.message);
      taskCreatedEvents = [];
    }
    
    let syncedCount = 0;
    for (const event of taskCreatedEvents) {
      try {
        const taskId = Number(event.args.taskId);
        const eventBlock = Number(event.blockNumber);
        
        // Check if already in database
        const existing = await tasksCollection.findOne({ taskId });
        if (existing) {
          continue;
        }
        
        // Get full task details from blockchain with retry
        let task;
        let retries = 3;
        while (retries > 0) {
        try {
          task = await aptanContract.getTask(taskId);
            break;
        } catch (error) {
            retries--;
            if (retries === 0) {
              console.error(`❌ Error getting task ${taskId}:`, error.message);
              // Try to save from event data if getTask fails
              task = {
                creator: event.args.creator,
                description: event.args.description,
                reward: event.args.reward,
                deadline: event.args.deadline,
                completed: false,
                agent: null,
                solution: null,
                createdAt: BigInt(eventBlock) // Use block number as fallback
              };
            } else {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        // Store in database
        // Ensure reward is stored as string to preserve precision
        let rewardValue;
        if (task.reward) {
          rewardValue = typeof task.reward === 'bigint' || task.reward.toString ? task.reward.toString() : String(task.reward);
        } else if (event.args.reward) {
          rewardValue = typeof event.args.reward === 'bigint' || event.args.reward.toString ? event.args.reward.toString() : String(event.args.reward);
        } else {
          rewardValue = '0';
        }
        
        const taskDoc = {
          taskId: taskId,
          creator: task.creator || event.args.creator,
          description: task.description || event.args.description,
          reward: rewardValue,
          deadline: Number(task.deadline || event.args.deadline),
          completed: task.completed || false,
          agent: task.agent || null,
          solution: task.solution || null,
          txHash: event.transactionHash,
          blockNumber: eventBlock,
          createdAt: task.createdAt ? Number(task.createdAt) * 1000 : eventBlock * 1000,
          syncedAt: Date.now()
        };
        
        // Log reward for debugging
        console.log(`💰 Task ${taskId} reward: ${rewardValue} (wei) = ${ethers.formatEther(rewardValue)} MNEE`);
        
        const result = await tasksCollection.insertOne(taskDoc);
        if (result.insertedId) {
          syncedCount++;
          console.log(`✅ Saved task ${taskId} to database (block ${eventBlock})`);
          
          // Emit WebSocket update for newly synced task
          emitTaskUpdate(taskId, {
            ...taskDoc,
            completed: taskDoc.completed || false
          });
        } else {
          console.error(`❌ Failed to save task ${taskId}`);
        }
      } catch (error) {
        if (error.code === 11000) {
          // Duplicate key - already exists, skip
        } else {
          console.error(`❌ Error syncing task:`, error.message);
        }
      }
    }
    
    // Get TaskCompleted events with retry
    let taskCompletedEvents = [];
    try {
      const taskCompletedFilter = aptanContract.filters.TaskCompleted();
      let retries = 3;
      while (retries > 0) {
        try {
          taskCompletedEvents = await aptanContract.queryFilter(taskCompletedFilter, actualFromBlock, toBlock);
          break;
        } catch (error) {
          retries--;
          if (retries === 0) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      console.error("❌ Error fetching TaskCompleted events:", error.message);
      taskCompletedEvents = [];
    }
    
    let updatedCount = 0;
    for (const event of taskCompletedEvents) {
      try {
        const taskId = Number(event.args.taskId);
        const updateResult = await tasksCollection.updateOne(
          { taskId },
          {
            $set: {
              completed: true,
              agent: event.args.agent,
              solution: event.args.solution,
              completedTxHash: event.transactionHash,
              completedBlockNumber: Number(event.blockNumber),
              completedAt: Date.now()
            }
          },
          { upsert: true }
        );
        
        if (updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0) {
          updatedCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating task:`, error.message);
      }
    }
    
    // Get TaskCancelled events with retry
    let taskCancelledEvents = [];
    try {
      const taskCancelledFilter = aptanContract.filters.TaskCancelled();
      let retries = 3;
      while (retries > 0) {
        try {
          taskCancelledEvents = await aptanContract.queryFilter(taskCancelledFilter, actualFromBlock, toBlock);
          break;
        } catch (error) {
          retries--;
          if (retries === 0) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      console.error("❌ Error fetching TaskCancelled events:", error.message);
      taskCancelledEvents = [];
    }
    
    let cancelledCount = 0;
    for (const event of taskCancelledEvents) {
      try {
        const taskId = Number(event.args.taskId);
        const updateResult = await tasksCollection.updateOne(
          { taskId },
          {
            $set: {
              completed: true,
              cancelled: true,
              cancelledBy: event.args.creator,
              refundAmount: event.args.refundAmount.toString(),
              cancelledTxHash: event.transactionHash,
              cancelledBlockNumber: Number(event.blockNumber),
              cancelledAt: Date.now()
            }
          },
          { upsert: true }
        );
        
        if (updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0) {
          cancelledCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating cancelled task:`, error.message);
      }
    }
    
    // Update last synced block to toBlock + 1 so next sync starts from the next block
    // This ensures no events are skipped between sync cycles
    lastSyncedBlock = toBlock + 1;
    
    // Store last synced block in database
    try {
      await tasksCollection.updateOne(
        { _id: "sync_state" },
        { 
          $set: { 
            lastSyncedBlock: lastSyncedBlock,
            contractAddress: CONTRACT_ADDRESS,
            lastSyncTime: Date.now()
          } 
        },
        { upsert: true }
      );
      console.log(`💾 Saved sync state: next sync will start from block ${lastSyncedBlock}`);
    } catch (error) {
      console.error("❌ Error saving sync state:", error.message);
    }
    
    // Summary
    if (syncedCount > 0 || updatedCount > 0 || cancelledCount > 0) {
      console.log(`✅ Sync: ${syncedCount} new, ${updatedCount} completed, ${cancelledCount} cancelled (block ${toBlock})`);
    }
    
    // Verify data in database
    try {
      const totalTasks = await tasksCollection.countDocuments({ _id: { $ne: "sync_state" } });
      if (totalTasks === 0 && syncedCount === 0) {
        console.log(`⚠️  No tasks in database. Check contract address: ${CONTRACT_ADDRESS}`);
      }
    } catch (error) {
      // Silent fail
    }
  } catch (error) {
    console.error("❌ Error syncing blockchain data:", error.message);
    console.error("   Stack:", error.stack);
  }
}

// Note: Polling and sync are started in initializeContract()

// API Routes

// Get all tasks
app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await tasksCollection.find({ _id: { $ne: "sync_state" } }).sort({ createdAt: -1 }).toArray();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task by ID
app.get("/api/tasks/:id", async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = await tasksCollection.findOne({ taskId });
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending tasks
app.get("/api/tasks/pending", async (req, res) => {
  if (!aptanContract) {
    return res.json([]);
  }
  
  try {
    const pendingTasks = await aptanContract.getPendingTasks();
    const tasks = [];
    
    for (const taskId of pendingTasks) {
      const task = await aptanContract.getTask(taskId);
      tasks.push({
        taskId: Number(taskId),
        creator: task.creator,
        description: task.description,
        reward: task.reward.toString(),
        deadline: Number(task.deadline),
        completed: task.completed,
        createdAt: Number(task.createdAt)
      });
    }
    
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create task (stores in DB, actual creation happens on frontend)
app.post("/api/tasks", async (req, res) => {
  try {
    const { taskId, creator, description, reward, deadline, txHash, blockNumber } = req.body;
    
    if (!taskId || !creator || !description || !reward || !deadline || !txHash) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Ensure reward is stored as string to preserve precision
    const rewardValue = typeof reward === 'bigint' || (reward && reward.toString) 
      ? reward.toString() 
      : String(reward);
    
    // Check if task already exists
    const existing = await tasksCollection.findOne({ taskId });
    if (existing) {
      console.log(`Task ${taskId} already exists in database, updating...`);
      // Update existing task with latest info
      await tasksCollection.updateOne(
        { taskId },
        {
          $set: {
            creator,
            description,
            reward: rewardValue,
            deadline,
            txHash,
            blockNumber: blockNumber || existing.blockNumber,
            updatedAt: Date.now()
          }
        }
      );
      return res.json({ taskId, message: "Task updated successfully" });
    }
    
    const task = {
      taskId: Number(taskId),
      creator,
      description,
      reward: rewardValue,
      deadline: Number(deadline),
      txHash,
      blockNumber: blockNumber ? Number(blockNumber) : null,
      completed: false,
      agent: null,
      solution: null,
      createdAt: Date.now(),
      syncedAt: Date.now(),
      source: 'frontend' // Mark as saved from frontend
    };
    
    // Log reward for debugging
    console.log(`💰 Task ${taskId} reward from frontend: ${rewardValue} (wei) = ${ethers.formatEther(rewardValue)} MNEE`);
    
    const result = await tasksCollection.insertOne(task);
    if (result.insertedId) {
      console.log(`✅ Task ${taskId} saved to database from frontend`);
      
      // Emit WebSocket update for new task
      emitTaskUpdate(taskId, {
        ...task,
        completed: false
      });
      
      res.json({ taskId, message: "Task stored successfully" });
    } else {
      res.status(500).json({ error: "Failed to insert task" });
    }
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error - task already exists
      console.log(`Task ${req.body.taskId} already exists`);
      res.json({ taskId: req.body.taskId, message: "Task already exists" });
    } else {
      console.error("Error storing task:", error);
      res.status(500).json({ error: error.message });
    }
  }
});

// Sync blockchain data endpoint
app.post("/api/sync", async (req, res) => {
  try {
    let fromBlock = req.body.fromBlock;
    
    // If reset flag is set, start from contract creation block
    if (req.body.reset) {
      const defaultBlock = CONTRACT_CREATION_BLOCKS[CONTRACT_ADDRESS.toLowerCase()] || CONTRACT_CREATION_BLOCKS[CONTRACT_ADDRESS] || 9788210;
      fromBlock = process.env.SYNC_FROM_BLOCK || defaultBlock;
      console.log(`🔄 Resetting sync state, starting from block ${fromBlock} (contract creation)`);
      if (tasksCollection) {
        await tasksCollection.updateOne(
          { _id: "sync_state" },
          { 
            $set: { 
              lastSyncedBlock: Number(fromBlock),
              contractAddress: CONTRACT_ADDRESS,
              lastSyncTime: Date.now()
            } 
          },
          { upsert: true }
        );
      }
    }
    
      const defaultBlock = CONTRACT_CREATION_BLOCKS[CONTRACT_ADDRESS.toLowerCase()] || CONTRACT_CREATION_BLOCKS[CONTRACT_ADDRESS] || 9788210;
      fromBlock = fromBlock || lastSyncedBlock || defaultBlock;
    await syncBlockchainData(Number(fromBlock));
    res.json({ 
      success: true, 
      message: `Synced data from block ${fromBlock}`,
      lastSyncedBlock: lastSyncedBlock,
      contractAddress: CONTRACT_ADDRESS
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sync status
app.get("/api/sync/status", async (req, res) => {
  try {
    const syncState = await tasksCollection.findOne({ _id: "sync_state" });
    res.json({
      lastSyncedBlock: syncState?.lastSyncedBlock || lastSyncedBlock || 0,
      lastSyncTime: syncState?.lastSyncTime || null,
      contract: CONTRACT_ADDRESS || "not configured",
      agent: wallet ? wallet.address : "not configured"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual retry endpoint for failed tasks
app.post("/api/tasks/:id/retry", async (req, res) => {
  if (!aptanContract || !wallet) {
    return res.status(500).json({ error: "Contract or wallet not configured" });
  }
  
  try {
    const taskId = parseInt(req.params.id);
    console.log(`🔄 Manual retry requested for task ${taskId}`);
    
    // Get task from blockchain
    const task = await aptanContract.getTask(taskId);
    
    if (task.completed) {
      return res.json({ 
        success: true, 
        message: "Task is already completed",
        taskId 
      });
    }
    
    // Check if task exists in database
    const dbTask = await tasksCollection.findOne({ taskId });
    if (!dbTask) {
      return res.status(404).json({ error: "Task not found in database" });
    }
    
    // Get solution from database or generate new one
    let solution = dbTask.solution;
    if (!solution || solution.startsWith("Error")) {
      // Regenerate solution
      console.log(`🤖 Regenerating solution for task ${taskId}...`);
      const result = await solveTask(task.description);
      if (result.success) {
        solution = result.solution;
      } else {
        return res.status(500).json({ error: `Failed to generate solution: ${result.error}` });
      }
    }
    
    // Validate solution
    if (!solution || solution.trim().length === 0) {
      return res.status(400).json({ error: "Solution is empty" });
    }
    
    const MAX_SOLUTION_LENGTH = 10000;
    const trimmedSolution = solution.length > MAX_SOLUTION_LENGTH 
      ? solution.substring(0, MAX_SOLUTION_LENGTH) + "... [truncated]"
      : solution;
    
    // Submit to blockchain
    console.log(`📤 Submitting solution for task ${taskId} (manual retry)...`);
    const tx = await aptanContract.submitResult(
      taskId,
      wallet.address,
      trimmedSolution
    );
    
    console.log(`⏳ Transaction submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    
    if (receipt.status === 0) {
      return res.status(500).json({ error: "Transaction reverted", txHash: tx.hash });
    }
    
    // Update database
    await tasksCollection.updateOne(
      { taskId },
      { 
        $set: { 
          completed: true, 
          agent: wallet.address, 
          solution: trimmedSolution,
          completedTxHash: tx.hash,
          completedBlockNumber: receipt.blockNumber,
          completedAt: Date.now()
        } 
      }
    );
    
    // Emit WebSocket update for retry completion
    emitTaskUpdate(taskId, {
      completed: true,
      agent: wallet.address,
      solution: trimmedSolution,
      completedTxHash: tx.hash,
      completedBlockNumber: receipt.blockNumber,
      completedAt: Date.now()
    });
    
    res.json({ 
      success: true, 
      message: "Task completed successfully",
      taskId,
      txHash: tx.hash
    });
    
  } catch (error) {
    console.error("Manual retry error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    contract: CONTRACT_ADDRESS || "not configured",
    agent: wallet ? wallet.address : "not configured",
    database: tasksCollection ? "connected" : "not connected"
  });
});

// API Test endpoint - test both OpenAI and Groq
app.get("/api/test-apis", async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    openai: { configured: false, tested: false, success: false, error: null },
    groq: { configured: false, tested: false, success: false, error: null }
  };
  
  // Test OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey.trim()) {
    results.openai.configured = true;
    results.openai.tested = true;
    try {
      // Reinitialize if needed
      if (!openai) {
        initializeOpenAI();
      }
      if (openai) {
        const testResponse = await Promise.race([
          openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: "Say 'API test successful' if you can read this." }],
            max_tokens: 20
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))
        ]);
        if (testResponse.choices && testResponse.choices[0]) {
          results.openai.success = true;
          results.openai.response = testResponse.choices[0].message.content;
        }
      } else {
        results.openai.error = "Failed to initialize OpenAI client";
      }
    } catch (error) {
      results.openai.error = error.message;
      if (error.code) results.openai.errorCode = error.code;
      if (error.status) results.openai.statusCode = error.status;
    }
  } else {
    results.openai.error = "OPENAI_API_KEY not set in environment";
  }
  
  // Test Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey.trim()) {
    results.groq.configured = true;
    results.groq.tested = true;
    try {
      const testResponse = await Promise.race([
        axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: "user", content: "Say 'API test successful' if you can read this." }],
            max_tokens: 20
          },
          {
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))
      ]);
      if (testResponse.data && testResponse.data.choices && testResponse.data.choices[0]) {
        results.groq.success = true;
        results.groq.response = testResponse.data.choices[0].message.content;
      }
    } catch (error) {
      results.groq.error = error.message;
      if (error.response) {
        results.groq.statusCode = error.response.status;
        results.groq.errorData = error.response.data;
      }
    }
  } else {
    results.groq.error = "GROQ_API_KEY not set in environment";
  }
  
  res.json(results);
});

// Server-Sent Events endpoint (Alternative to WebSocket)
app.get('/api/tasks/:id/events', (req, res) => {
  const taskId = parseInt(req.params.id);
  
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  console.log(`📡 SSE connection opened for task ${taskId}`);
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', taskId })}\n\n`);
  
  // Listen for WebSocket events and forward to SSE
  const updateHandler = (data) => {
    if (data.taskId === taskId) {
      res.write(`data: ${JSON.stringify({ type: 'update', ...data })}\n\n`);
    }
  };
  
  io.on('taskUpdate', updateHandler);
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);
  
  // Cleanup on client disconnect
  req.on('close', () => {
    console.log(`📡 SSE connection closed for task ${taskId}`);
    io.removeListener('taskUpdate', updateHandler);
    clearInterval(keepAlive);
    res.end();
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`APTAN Backend running on port ${PORT}`);
  console.log(`WebSocket server ready on ws://localhost:${PORT}`);
  console.log(`SSE endpoint available at /api/tasks/:id/events`);
  console.log(`Contract: ${CONTRACT_ADDRESS || "Not configured"}`);
  console.log(`Agent Wallet: ${wallet ? wallet.address : "Not configured"}`);
});



