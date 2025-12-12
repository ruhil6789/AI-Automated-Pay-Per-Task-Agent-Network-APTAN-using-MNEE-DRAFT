# Deploy APTAN to Any Testnet

## Supported Testnets

APTAN can be deployed to any Ethereum-compatible testnet:

- ✅ **Sepolia** (Ethereum testnet)
- ✅ **Goerli** (Ethereum testnet - deprecated but still works)
- ✅ **Mumbai** (Polygon testnet)
- ✅ **Arbitrum Sepolia** (Arbitrum testnet)
- ✅ **Base Sepolia** (Base testnet)
- ✅ **Any EVM-compatible testnet** (using custom RPC)

## Step 1: Add Testnet to MetaMask

### For Sepolia:
1. Open MetaMask → Network dropdown → "Add Network"
2. Enter:
   - **Network Name**: `Sepolia`
   - **RPC URL**: `https://rpc.sepolia.org`
   - **Chain ID**: `11155111`
   - **Currency**: `ETH`
   - **Explorer**: `https://sepolia.etherscan.io`

### For Mumbai (Polygon):
1. Open MetaMask → Network dropdown → "Add Network"
2. Enter:
   - **Network Name**: `Mumbai`
   - **RPC URL**: `https://rpc-mumbai.maticvigil.com`
   - **Chain ID**: `80001`
   - **Currency**: `MATIC`
   - **Explorer**: `https://mumbai.polygonscan.com`

### For Arbitrum Sepolia:
1. Open MetaMask → Network dropdown → "Add Network"
2. Enter:
   - **Network Name**: `Arbitrum Sepolia`
   - **RPC URL**: `https://sepolia-rollup.arbitrum.io/rpc`
   - **Chain ID**: `421614`
   - **Currency**: `ETH`
   - **Explorer**: `https://sepolia-arbiscan.io`

### For Base Sepolia:
1. Open MetaMask → Network dropdown → "Add Network"
2. Enter:
   - **Network Name**: `Base Sepolia`
   - **RPC URL**: `https://sepolia.base.org`
   - **Chain ID**: `84532`
   - **Currency**: `ETH`
   - **Explorer**: `https://sepolia.basescan.org`

### For Custom Testnet:
1. Get the network details from the testnet documentation
2. Add manually with:
   - Network Name: (your choice)
   - RPC URL: (from testnet docs)
   - Chain ID: (from testnet docs)
   - Currency: (from testnet docs)
   - Explorer: (from testnet docs)

## Step 2: Get Testnet Tokens

### Sepolia ETH:
- https://sepoliafaucet.com
- https://www.infura.io/faucet/sepolia
- https://faucets.chain.link/sepolia

### Mumbai MATIC:
- https://faucet.polygon.technology
- https://mumbaifaucet.com

### Arbitrum Sepolia ETH:
- https://faucet.quicknode.com/arbitrum/sepolia
- Bridge from Sepolia: https://bridge.arbitrum.io

### Base Sepolia ETH:
- https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- Bridge from Sepolia

## Step 3: Get Your Private Key

1. In MetaMask, click **account icon** (top right)
2. Click **"Account details"**
3. Click **"Show private key"**
4. Enter password and **copy the private key**

⚠️ **Never share your private key!**

## Step 4: Configure Environment

Create `contracts/.env`:

```env
# Your MetaMask private key
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Choose your testnet RPC URL:

# For Sepolia (default):
SEPOLIA_RPC_URL=https://rpc.sepolia.org

# For Mumbai:
# MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com

# For Arbitrum Sepolia:
# ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# For Base Sepolia:
# BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# For custom testnet:
# TESTNET_RPC_URL=https://your-testnet-rpc-url
# CHAIN_ID=12345
```

## Step 5: Deploy to Testnet

### Deploy to Sepolia:
```bash
cd contracts
npx hardhat run scripts/deploy-production.js --network sepolia
```

### Deploy to Mumbai:
```bash
cd contracts
npx hardhat run scripts/deploy-production.js --network mumbai
```

### Deploy to Arbitrum Sepolia:
```bash
cd contracts
npx hardhat run scripts/deploy-production.js --network arbitrumSepolia
```

### Deploy to Base Sepolia:
```bash
cd contracts
npx hardhat run scripts/deploy-production.js --network baseSepolia
```

### Deploy to Custom Testnet:
```bash
cd contracts
# Set TESTNET_RPC_URL and CHAIN_ID in .env first
npx hardhat run scripts/deploy-production.js --network testnet
```

## Step 6: Verify Deployment

1. **Check MetaMask**: Transaction should appear
2. **Check Block Explorer**:
   - Sepolia: https://sepolia.etherscan.io
   - Mumbai: https://mumbai.polygonscan.com
   - Arbitrum: https://sepolia-arbiscan.io
   - Base: https://sepolia.basescan.org

## Step 7: Update App Configuration

After deployment, update your `.env` files:

**`backend/.env`:**
```env
PORT=3001
RPC_URL=<YOUR_TESTNET_RPC_URL>
CONTRACT_ADDRESS=<YOUR_DEPLOYED_APTAN_ADDRESS>
AGENT_PRIVATE_KEY=<YOUR_PRIVATE_KEY>
OPENAI_API_KEY=<YOUR_OPENAI_KEY>
```

**`frontend/.env`:**
```env
REACT_APP_CONTRACT_ADDRESS=<YOUR_DEPLOYED_APTAN_ADDRESS>
```

## Important Notes

### About MNEE Token:
⚠️ **MNEE is on Ethereum mainnet** (`0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF`)

- If deploying to **Ethereum testnets** (Sepolia/Goerli):
  - MNEE might not exist on testnet
  - You may need to deploy a test MNEE token
  - Or check if MNEE team has testnet version

- If deploying to **other chains** (Polygon, Arbitrum, Base):
  - MNEE is Ethereum-only
  - You'll need to use a bridge or deploy test token
  - Or deploy MockMNEE for testing

### For Testing Without Real MNEE:

You can modify `deploy-production.js` to use MockMNEE on testnets:

```javascript
// In deploy-production.js, for testnets you can use:
const MNEE_ADDRESS = hre.network.name === 'sepolia' 
  ? OFFICIAL_MNEE_ADDRESS  // Use real MNEE if available
  : mockMNEEAddress;        // Use MockMNEE for other testnets
```

## Quick Deploy Commands

```bash
# Sepolia (recommended for Ethereum)
npx hardhat run scripts/deploy-production.js --network sepolia

# Mumbai (Polygon)
npx hardhat run scripts/deploy-production.js --network mumbai

# Arbitrum Sepolia
npx hardhat run scripts/deploy-production.js --network arbitrumSepolia

# Base Sepolia
npx hardhat run scripts/deploy-production.js --network baseSepolia
```

## Troubleshooting

**"Insufficient funds"**: Get more testnet tokens from faucet

**"Network error"**: Check RPC URL is correct

**"MNEE contract not found"**: 
- MNEE might only be on mainnet
- Use MockMNEE for testing on other chains
- Or check if MNEE has testnet deployment

**"Wrong network"**: Make sure MetaMask is on the same network

## Recommended Testnet for Hackathon

**Sepolia** is recommended because:
- ✅ Most stable Ethereum testnet
- ✅ Good faucet availability
- ✅ Fast confirmations
- ✅ Most likely to have MNEE support

Good luck with your deployment! 🚀

