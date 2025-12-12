# Contract Configuration Guide

## Current Setup: Test Contract (MockMNEE) - Sepolia

### Test Contract Configuration
- **APTAN Contract**: `0x34F0f88b1E637640F1fB0B01dBDFd02F7a8B7B92`
- **MockMNEE Token**: `0x0D10aC728b7DE11183c22ebE5027369394808708`
- **Network**: Sepolia Testnet
- **Purpose**: Testing and development

### Files to Update for Test Contract:
- `frontend/.env`: `REACT_APP_CONTRACT_ADDRESS=0x34F0f88b1E637640F1fB0B01dBDFd02F7a8B7B92`
- `backend/.env`: `CONTRACT_ADDRESS=0x34F0f88b1E637640F1fB0B01dBDFd02F7a8B7B92`

---

## Production Setup: Official MNEE - Ethereum Mainnet

### Production Contract Configuration
- **APTAN Contract**: `0x1be0f1D26748C6C879b988e3516A284c7EA1380A`
- **Official MNEE Token**: `0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF`
- **Network**: Ethereum Mainnet
- **Purpose**: Production deployment

### Files to Update for Production:
- `frontend/.env`: `REACT_APP_CONTRACT_ADDRESS=0x1be0f1D26748C6C879b988e3516A284c7EA1380A`
- `backend/.env`: `CONTRACT_ADDRESS=0x1be0f1D26748C6C879b988e3516A284c7EA1380A`

---

## How to Switch to Production (Mainnet)

### Step 1: Update Environment Files

**Frontend:**
```bash
cd frontend
echo "REACT_APP_CONTRACT_ADDRESS=0x1be0f1D26748C6C879b988e3516A284c7EA1380A" > .env
```

**Backend:**
```bash
cd backend
echo "CONTRACT_ADDRESS=0x1be0f1D26748C6C879b988e3516A284c7EA1380A" >> .env
```

### Step 2: Update RPC URL (if needed)
```bash
# In backend/.env
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
# OR
RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
```

### Step 3: Switch MetaMask Network
1. Open MetaMask
2. Click network dropdown
3. Select "Ethereum Mainnet"

### Step 4: Verify You Have MNEE Tokens
- You need real MNEE tokens on Mainnet
- Token address: `0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF`

### Step 5: Restart Services
```bash
# Restart frontend
cd frontend && npm start

# Restart backend
cd backend && npm start
```

---

## Quick Reference

| Setting | Test (Sepolia) | Production (Mainnet) |
|---------|---------------|---------------------|
| Contract | `0x34F0f88b1E637640F1fB0B01dBDFd02F7a8B7B92` | `0x1be0f1D26748C6C879b988e3516A284c7EA1380A` |
| Token | `0x0D10aC728b7DE11183c22ebE5027369394808708` (MockMNEE) | `0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF` (MNEE) |
| Network | Sepolia Testnet | Ethereum Mainnet |
| Chain ID | 11155111 | 1 |

---

## Notes

- **Test Contract**: Use for development and testing on Sepolia
- **Production Contract**: Use for live deployment on Mainnet
- Always verify the contract address matches the network you're connected to
- Production requires real ETH for gas and real MNEE tokens for rewards

