# Deploy APTAN to Sepolia Testnet

## Step 1: Add Sepolia Network to MetaMask

1. **Open MetaMask** extension
2. Click the **network dropdown** (top left)
3. Click **"Add Network"** or **"Add a network manually"**
4. Enter these details:
   - **Network Name**: `Sepolia`
   - **New RPC URL**: `https://sepolia.infura.io/v3/YOUR_INFURA_KEY` 
     - OR use public RPC: `https://rpc.sepolia.org`
   - **Chain ID**: `11155111`
   - **Currency Symbol**: `ETH`
   - **Block Explorer URL**: `https://sepolia.etherscan.io`
5. Click **"Save"**

## Step 2: Get Sepolia ETH (Testnet Faucet)

You need Sepolia ETH to pay for gas fees:

1. **Sepolia Faucet Options:**
   - **Alchemy Faucet**: https://sepoliafaucet.com
   - **Infura Faucet**: https://www.infura.io/faucet/sepolia
   - **Chainlink Faucet**: https://faucets.chain.link/sepolia
   - **PoW Faucet**: https://sepolia-faucet.pk910.de

2. **Connect your MetaMask wallet** to the faucet
3. **Request test ETH** (usually 0.1-0.5 ETH)
4. **Wait for confirmation** (may take a few minutes)

**Minimum needed**: ~0.01 ETH should be enough for deployment

## Step 3: Get Your Private Key from MetaMask

⚠️ **SECURITY WARNING**: Never share your private key or commit it to git!

1. In MetaMask, click the **account icon** (top right)
2. Click **"Account details"**
3. Click **"Show private key"**
4. Enter your MetaMask password
5. **Copy the private key** (starts with `0x`)

## Step 4: Configure Environment Variables

Create/update `contracts/.env`:

```env
# Your MetaMask account private key
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Sepolia RPC URL (choose one):
# Option 1: Public RPC (free, no signup)
SEPOLIA_RPC_URL=https://rpc.sepolia.org

# Option 2: Infura (requires free account)
# SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# Option 3: Alchemy (requires free account)
# SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
```

**Get Free RPC URLs:**
- **Infura**: https://infura.io (sign up, create project, get API key)
- **Alchemy**: https://alchemy.com (sign up, create app, get API key)

## Step 5: Deploy to Sepolia

```bash
cd contracts
npx hardhat run scripts/deploy-production.js --network sepolia
```

This will:
- ✅ Use official MNEE contract: `0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF`
- ✅ Deploy APTAN contract to Sepolia
- ✅ Save addresses to `deployed-addresses-production.json`

## Step 6: Verify Deployment

1. **Check MetaMask**: You should see the transaction
2. **Check Etherscan**: https://sepolia.etherscan.io
   - Search for your deployed contract address
   - Verify it's deployed correctly

## Step 7: Get MNEE Tokens for Testing

You'll need MNEE tokens to test the system:

1. **Check if MNEE has a testnet faucet**: https://mnee.io
2. **Or swap ETH for MNEE** on Sepolia (if DEX available)
3. **Or contact MNEE team** for testnet tokens

## Step 8: Update Your App Configuration

After deployment, update your `.env` files:

**`backend/.env`:**
```env
PORT=3001
RPC_URL=https://rpc.sepolia.org
CONTRACT_ADDRESS=<YOUR_DEPLOYED_APTAN_ADDRESS>
AGENT_PRIVATE_KEY=<YOUR_PRIVATE_KEY>
OPENAI_API_KEY=<YOUR_OPENAI_KEY>
```

**`frontend/.env`:**
```env
REACT_APP_CONTRACT_ADDRESS=<YOUR_DEPLOYED_APTAN_ADDRESS>
```

## Step 9: Test on Sepolia

1. **Switch MetaMask to Sepolia network**
2. **Start backend**: `cd backend && npm run dev`
3. **Start frontend**: `cd frontend && npm start`
4. **Connect MetaMask** to your app
5. **Create a task** with MNEE reward
6. **Watch AI agent** solve it automatically!

## Troubleshooting

**"Insufficient funds" error:**
- Get more Sepolia ETH from faucet
- Check you have at least 0.01 ETH

**"Network error" error:**
- Check RPC URL is correct
- Try a different RPC provider
- Make sure you're on Sepolia network in MetaMask

**"Contract not found" error:**
- Verify MNEE contract exists on Sepolia
- Check official MNEE address is correct
- MNEE might only be on mainnet - check with MNEE team

## Important Notes

- ⚠️ **Sepolia is a testnet** - tokens have no real value
- ⚠️ **Keep private key secure** - never share or commit to git
- ✅ **Use `.env` file** - add it to `.gitignore`
- ✅ **Verify on Etherscan** - always check your deployment

## Next Steps

After successful deployment:
1. ✅ Test the complete flow
2. ✅ Record demo video
3. ✅ Take screenshots
4. ✅ Update DEVPOST.md with contract address
5. ✅ Submit to hackathon!

Good luck! 🚀

