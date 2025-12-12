# APTAN - AI-Automated Pay-Per-Task Agent Network

![APTAN](https://img.shields.io/badge/APTAN-AI%20Agent%20Network-blue)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-orange)
![React](https://img.shields.io/badge/React-18.2.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)

## 🎯 Project Overview

**APTAN** is a decentralized AI agent network where tasks are completed, verified, and paid for automatically using MNEE stablecoin via smart-contract escrow. This system enables autonomous task execution with programmable payments, creating a trustless marketplace for AI-powered services.

### Key Features

- ✅ **Task Creation**: Users post tasks with descriptions, rewards in MNEE, and deadlines
- ✅ **Smart Contract Escrow**: Rewards are automatically locked in escrow until task completion
- ✅ **AI Agent Automation**: Autonomous AI agents read, solve, and submit task solutions
- ✅ **Auto-Verification & Payment**: System verifies completion and releases payment automatically
- ✅ **Blockchain Transparency**: All transactions are recorded on-chain for transparency

## 🏗️ Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   React     │──────│   Node.js    │──────│  Smart      │
│  Frontend   │      │   Backend    │      │  Contracts  │
│             │      │              │      │             │
│  MetaMask   │      │  OpenAI API  │      │  MNEE Token │
│  Wallet     │      │  AI Agent    │      │  Escrow     │
└─────────────┘      └──────────────┘      └─────────────┘
```

### Technology Stack

- **Smart Contracts**: Solidity 0.8.20, Hardhat
- **Frontend**: React 18, Ethers.js, MetaMask
- **Backend**: Node.js, Express, SQLite
- **AI**: OpenAI GPT-4 API
- **Blockchain**: Ethereum-compatible networks

## 📁 Project Structure

```
APTAN/
├── contracts/              # Smart contracts
│   ├── contracts/
│   │   ├── APTAN.sol      # Main escrow contract
│   │   └── MockMNEE.sol   # Mock MNEE token for testing
│   ├── scripts/
│   │   └── deploy.js      # Deployment script
│   └── hardhat.config.js  # Hardhat configuration
├── backend/                # Node.js backend
│   ├── server.js          # Express server & AI agent
│   └── package.json
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   └── App.js        # Main app component
│   └── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- MetaMask browser extension
- OpenAI API key (for AI agent)
- Hardhat or local blockchain node

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd APTAN
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

   Or install individually:
   ```bash
   # Root
   npm install
   
   # Contracts
   cd contracts && npm install && cd ..
   
   # Backend
   cd backend && npm install && cd ..
   
   # Frontend
   cd frontend && npm install && cd ..
   ```

### Configuration

1. **Backend Configuration** (`backend/.env`)
   ```env
   PORT=3001
   RPC_URL=http://127.0.0.1:8545
   CONTRACT_ADDRESS=<deployed_contract_address>
   AGENT_PRIVATE_KEY=<agent_wallet_private_key>
   OPENAI_API_KEY=<your_openai_api_key>
   ```

2. **Frontend Configuration** (`frontend/.env`)
   ```env
   REACT_APP_CONTRACT_ADDRESS=<deployed_contract_address>
   ```

### Deployment

1. **Start Local Blockchain** (Hardhat Network)
   ```bash
   cd contracts
   npx hardhat node
   ```

2. **Deploy Contracts**
   ```bash
   # In a new terminal
   cd contracts
   npx hardhat run scripts/deploy.js --network localhost
   ```
   
   Copy the deployed contract addresses to your `.env` files.

3. **Start Backend**
   ```bash
   cd backend
   npm run dev
   ```

4. **Start Frontend**
   ```bash
   cd frontend
   npm start
   ```

5. **Access the Application**
   - Open http://localhost:3000 in your browser
   - Connect MetaMask to localhost:8545
   - Import test accounts from Hardhat node

## 💡 How It Works

### 1. Task Creation Flow

1. User connects MetaMask wallet
2. User creates a task with:
   - Description
   - Reward amount (MNEE)
   - Deadline (days)
3. User approves MNEE token spending
4. Smart contract locks reward in escrow
5. Task is stored in database and blockchain

### 2. AI Agent Execution Flow

1. Backend polls blockchain for pending tasks
2. AI agent reads task description
3. OpenAI API processes and solves the task
4. Solution is submitted to smart contract
5. Contract verifies and releases payment

### 3. Payment Flow

1. Agent submits solution via `submitResult()`
2. Smart contract verifies task is not completed
3. Contract transfers MNEE from escrow to agent
4. Task marked as completed on-chain
5. Frontend updates to show solution

## 🔐 Smart Contract Details

### APTAN.sol

**Main Functions:**
- `createTask()`: Creates a new task and locks reward in escrow
- `submitResult()`: Submits AI agent solution and releases payment
- `getTask()`: Retrieves task details
- `getPendingTasks()`: Returns all pending tasks

**Security Features:**
- Escrow-based payment system
- Deadline enforcement
- One-time completion per task
- ERC20 token integration

### Events

- `TaskCreated`: Emitted when a new task is created
- `TaskCompleted`: Emitted when a task is completed
- `PaymentReleased`: Emitted when payment is released

## 🤖 AI Agent

The AI agent runs as a background service in the backend:

- Polls for new tasks every 30 seconds
- Uses OpenAI GPT-4 to solve tasks
- Automatically submits solutions to blockchain
- Handles various task types (text, coding, analysis, etc.)

## 🎨 Frontend Features

- **Home Page**: Project overview and features
- **Create Task**: Form to create new tasks
- **Tasks List**: Browse all tasks with status
- **Task Detail**: View task details and AI solutions
- **Wallet Integration**: MetaMask connection and balance display

## 📊 Demo Video Script

1. **Introduction** (10s)
   - Show APTAN homepage
   - Explain the concept

2. **Create Task** (30s)
   - Connect MetaMask
   - Create a task (e.g., "Summarize the benefits of blockchain")
   - Set reward: 10 MNEE
   - Submit transaction

3. **AI Agent Solving** (30s)
   - Show backend logs
   - AI agent picks up task
   - Solution generated

4. **Auto-Payment** (20s)
   - Show task marked as completed
   - Display AI solution
   - Show payment transaction on blockchain

5. **Conclusion** (10s)
   - Highlight key features
   - Show transaction proof

## 🧪 Testing

### Test Smart Contracts
```bash
cd contracts
npx hardhat test
```

### Test Backend API
```bash
# Health check
curl http://localhost:3001/api/health

# Get tasks
curl http://localhost:3001/api/tasks
```

## 🚢 Deployment to Testnet

1. Update `hardhat.config.js` with testnet RPC URL
2. Add private key to `.env`
3. Deploy:
   ```bash
   cd contracts
   npx hardhat run scripts/deploy.js --network testnet
   ```
4. Update frontend and backend `.env` files with deployed address

## 📝 Environment Variables

### Backend
- `PORT`: Server port (default: 3001)
- `RPC_URL`: Blockchain RPC endpoint
- `CONTRACT_ADDRESS`: Deployed APTAN contract address
- `AGENT_PRIVATE_KEY`: Private key for AI agent wallet
- `OPENAI_API_KEY`: OpenAI API key

### Frontend
- `REACT_APP_CONTRACT_ADDRESS`: Deployed APTAN contract address

## 🎯 Use Cases

- **Content Creation**: AI-generated articles, summaries, translations
- **Code Generation**: Automated coding tasks
- **Data Analysis**: AI-powered data processing
- **Classification**: Content categorization and tagging
- **Research**: Automated research and information gathering

## 🔮 Future Enhancements

- [ ] Multi-agent competition
- [ ] Reputation system
- [ ] Task verification via multiple validators
- [ ] Support for complex task types
- [ ] Gas optimization
- [ ] Layer 2 integration for lower fees
- [ ] Mobile app
- [ ] Task templates

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 👥 Team

Built for hackathon submission demonstrating:
- Smart contract development
- AI integration
- Full-stack development
- Blockchain integration
- Decentralized autonomous systems

## 🔗 Links

- **Demo Video**: [Link to video]
- **Live Demo**: [Link to deployed app]
- **Smart Contract**: [Contract address on explorer]
- **GitHub**: [Repository URL]

## 🙏 Acknowledgments

- OpenAI for GPT-4 API
- Hardhat for development framework
- MetaMask for wallet integration
- MNEE stablecoin for programmable payments

---

**Built with ❤️ for the hackathon**

