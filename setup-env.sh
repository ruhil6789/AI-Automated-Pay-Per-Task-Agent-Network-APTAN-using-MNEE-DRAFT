#!/bin/bash

# APTAN Environment Setup Script
# This script helps you set up the .env files for the project

echo "🚀 APTAN Environment Setup"
echo "=========================="
echo ""

# Check if deployed-addresses.json exists
if [ -f "contracts/deployed-addresses.json" ]; then
    echo "✅ Found deployed-addresses.json"
    CONTRACT_ADDRESS=$(cat contracts/deployed-addresses.json | grep -o '"APTAN": "[^"]*"' | cut -d'"' -f4)
    echo "   Contract Address: $CONTRACT_ADDRESS"
    echo ""
else
    echo "⚠️  deployed-addresses.json not found"
    echo "   Please deploy contracts first: cd contracts && npx hardhat run scripts/deploy.js --network localhost"
    echo ""
    read -p "Enter contract address manually (or press Enter to skip): " CONTRACT_ADDRESS
    echo ""
fi

# Backend .env
echo "📝 Setting up backend/.env..."
read -p "Enter OpenAI API Key: " OPENAI_KEY
read -p "Enter Agent Private Key (from Hardhat node): " AGENT_KEY

cat > backend/.env << EOF
PORT=3001
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=$CONTRACT_ADDRESS
AGENT_PRIVATE_KEY=$AGENT_KEY
OPENAI_API_KEY=$OPENAI_KEY
EOF

echo "✅ Created backend/.env"
echo ""

# Frontend .env
echo "📝 Setting up frontend/.env..."
cat > frontend/.env << EOF
REACT_APP_CONTRACT_ADDRESS=$CONTRACT_ADDRESS
EOF

echo "✅ Created frontend/.env"
echo ""

echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start backend: cd backend && npm run dev"
echo "2. Start frontend: cd frontend && npm start"
echo "3. Connect MetaMask to http://127.0.0.1:8545"
echo ""

