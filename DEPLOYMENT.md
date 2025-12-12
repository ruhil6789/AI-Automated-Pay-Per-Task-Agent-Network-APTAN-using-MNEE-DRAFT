# Deployment Guide

## Local Development Setup

### Step 1: Start Local Blockchain

```bash
cd contracts
npx hardhat node
```

This starts a local Hardhat network on `http://127.0.0.1:8545` with 20 test accounts.

### Step 2: Deploy Contracts

In a new terminal:

```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

This will:
- Deploy MockMNEE token
- Deploy APTAN contract
- Save addresses to `deployed-addresses.json`

### Step 3: Configure Environment

Copy the contract address from `deployed-addresses.json`:

**backend/.env:**
```env
PORT=3001
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=<APTAN_ADDRESS_FROM_DEPLOYMENT>
AGENT_PRIVATE_KEY=<PRIVATE_KEY_FROM_HARDHAT_NODE>
OPENAI_API_KEY=<YOUR_OPENAI_KEY>
```

**frontend/.env:**
```env
REACT_APP_CONTRACT_ADDRESS=<APTAN_ADDRESS_FROM_DEPLOYMENT>
```

### Step 4: Fund Agent Wallet

The agent wallet needs MNEE tokens to submit transactions. Get test tokens:

```bash
# Use Hardhat console or script to mint MNEE to agent address
```

### Step 5: Start Services

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### Step 6: Connect MetaMask

1. Open MetaMask
2. Add network:
   - Network Name: Hardhat Local
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 1337
   - Currency: ETH
3. Import test account from Hardhat node (use private keys from console output)

## Testnet Deployment

### Prerequisites

- Testnet RPC URL (e.g., Sepolia, Mumbai)
- Private key with testnet ETH
- MNEE token address on testnet (or deploy MockMNEE)

### Deploy to Testnet

1. Update `contracts/hardhat.config.js` with testnet configuration
2. Add to `contracts/.env`:
   ```env
   PRIVATE_KEY=<your_private_key>
   TESTNET_RPC_URL=<testnet_rpc_url>
   CHAIN_ID=<testnet_chain_id>
   ```
3. Deploy:
   ```bash
   cd contracts
   npx hardhat run scripts/deploy.js --network testnet
   ```
4. Update frontend and backend `.env` files with deployed address

## Mainnet Deployment

⚠️ **Only deploy to mainnet after thorough testing!**

1. Ensure all tests pass
2. Audit smart contracts
3. Update configuration for mainnet
4. Deploy with verified private key
5. Verify contracts on block explorer
6. Update frontend and backend with mainnet addresses

