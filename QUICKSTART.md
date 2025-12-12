# Quick Start Guide

Get APTAN running in 5 minutes!

## Prerequisites Check

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] MetaMask browser extension installed
- [ ] OpenAI API key (get from https://platform.openai.com/api-keys)

## Step-by-Step Setup

### 1. Install Dependencies (2 minutes)

```bash
# From project root
npm run install:all
```

### 2. Start Local Blockchain (1 minute)

```bash
cd contracts
npx hardhat node
```

Keep this terminal open! You'll see 20 test accounts with private keys.

### 3. Deploy Contracts (1 minute)

Open a **new terminal**:

```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

Copy the `APTAN` address from the output.

### 4. Configure Environment (1 minute)

**Create `backend/.env`:**
```env
PORT=3001
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=<paste_APTAN_address_here>
AGENT_PRIVATE_KEY=<paste_any_private_key_from_hardhat_node>
OPENAI_API_KEY=<your_openai_api_key>
```

**Create `frontend/.env`:**
```env
REACT_APP_CONTRACT_ADDRESS=<paste_APTAN_address_here>
```

### 5. Start Backend (30 seconds)

Open a **new terminal**:

```bash
cd backend
npm run dev
```

You should see: `APTAN Backend running on port 3001`

### 6. Start Frontend (30 seconds)

Open a **new terminal**:

```bash
cd frontend
npm start
```

Browser should open to http://localhost:3000

### 7. Connect MetaMask

1. Open MetaMask
2. Click network dropdown → "Add Network"
3. Add:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `1337`
   - Currency: `ETH`
4. Import account: Copy a private key from Hardhat node terminal
5. Connect wallet in the app

### 8. Get Test MNEE Tokens

You need MNEE tokens to create tasks. The MockMNEE contract was deployed. You can:
- Use Hardhat console to mint tokens
- Or modify the deployment script to mint to your address

### 9. Create Your First Task!

1. Click "Create Task" in the app
2. Enter a task description
3. Set reward (e.g., 10 MNEE)
4. Set deadline (e.g., 7 days)
5. Approve and create!

The AI agent will automatically pick it up and solve it!

## Troubleshooting

**"Contract address not configured"**
- Make sure you created `.env` files with the correct addresses

**"Insufficient allowance"**
- You need to approve MNEE spending first
- The frontend should handle this automatically

**"Backend not connecting"**
- Check that backend is running on port 3001
- Verify RPC_URL in backend/.env

**"AI agent not solving tasks"**
- Check OpenAI API key is correct
- Verify agent wallet has gas (ETH)
- Check backend logs for errors

## Next Steps

- Read the full [README.md](README.md)
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- Review [ARCHITECTURE.md](ARCHITECTURE.md) for system design

Happy hacking! 🚀

