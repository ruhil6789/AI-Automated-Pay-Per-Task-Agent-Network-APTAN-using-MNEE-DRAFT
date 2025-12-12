const { ethers } = require("ethers");
require("dotenv").config();

async function checkContract() {
  const rpcUrl = process.env.RPC_URL || "https://rpc.sepolia.org";
  const provider = new ethers.JsonRpcProvider(rpcUrl, {
    name: "sepolia",
    chainId: 11155111
  });

  const addresses = [
    "0x34F0f88b1E637640F1fB0B01dBDFd02F7a8B7B92", // Test contract
    "0x1be0f1D26748C6C879b988e3516A284c7EA1380A"  // Production contract
  ];

  console.log("Checking contracts on Sepolia...\n");
  
  for (const addr of addresses) {
    const code = await provider.getCode(addr);
    if (code && code !== "0x") {
      console.log(`✅ Contract EXISTS at ${addr}`);
      console.log(`   Code length: ${code.length} characters\n`);
    } else {
      console.log(`❌ Contract NOT FOUND at ${addr}\n`);
    }
  }
}

checkContract().catch(console.error);
