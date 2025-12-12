import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import axios from 'axios';
import { API_URL } from '../config';
import './CreateTask.css';

// ============================================
// CONTRACT CONFIGURATION
// ============================================
// TEST CONTRACT (MockMNEE) - For Sepolia testing
// Contract: 0x34F0f88b1E637640F1fB0B01dBDFd02F7a8B7B92
// MockMNEE: 0x0D10aC728b7DE11183c22ebE5027369394808708
// Network: Sepolia Testnet
//
// PRODUCTION CONTRACT (Official MNEE) - For Mainnet
// Contract: 0x1be0f1D26748C6C879b988e3516A284c7EA1380A
// MNEE: 0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF
// Network: Ethereum Mainnet
//
// To switch to production:
// 1. Update .env: REACT_APP_CONTRACT_ADDRESS=0x1be0f1D26748C6C879b988e3516A284c7EA1380A
// 2. Update .env: REACT_APP_MNEE_ADDRESS=0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF (optional, will use contract's mnee() if not set)
// 3. Switch MetaMask to Ethereum Mainnet
// 4. Ensure you have real MNEE tokens
// ============================================
const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "0x34F0f88b1E637640F1fB0B01dBDFd02F7a8B7B92"; // Test contract (MockMNEE) - Sepolia
// MNEE address can be set via environment variable, otherwise will be fetched from contract
const MNEE_ADDRESS = process.env.REACT_APP_MNEE_ADDRESS || null; // Optional: Set to override contract's mnee() function
const CONTRACT_ABI = [
  "function createTask(string memory description, uint256 reward, uint256 deadline) external",
  "function mnee() external view returns (address)",
  "function taskCounter() external view returns (uint256)",
  "event TaskCreated(uint256 indexed taskId, address indexed creator, uint256 reward, string description, uint256 deadline)"
];

const MNEE_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function balanceOf(address account) external view returns (uint256)"
];

function CreateTask() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    description: '',
    reward: '',
    deadline: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [expectedNetwork, setExpectedNetwork] = useState(null);
  const [networkMatch, setNetworkMatch] = useState(null);

  // Check network on mount and listen for changes
  useEffect(() => {
    const checkNetwork = async () => {
      if (window.ethereum && window.ethereum.isMetaMask) {
        try {
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          const chainIdNum = typeof chainId === 'string' && chainId.startsWith('0x') 
            ? parseInt(chainId, 16) 
            : parseInt(chainId);
          const isSepolia = chainIdNum === 11155111 || chainId === '0xaa36a7' || chainId === '11155111';
          const isMainnet = chainIdNum === 1 || chainId === '0x1' || chainId === '1';
          const network = isSepolia ? 'Sepolia' : (isMainnet ? 'Mainnet' : 'Unknown');
          setCurrentNetwork(network);
          
          // Determine expected network based on contract address
          const normalizedContractAddress = CONTRACT_ADDRESS.toLowerCase().trim();
          const testContractAddress = "0x34f0f88b1e637640f1fb0b01dbfd02f7a8b7b92";
          const productionContractAddress = "0x1be0f1d26748c6c879b988e3516a284c7ea1380a";
          const isTestContract = normalizedContractAddress === testContractAddress;
          const isProductionContract = normalizedContractAddress === productionContractAddress;
          const expected = isTestContract ? 'Sepolia' : (isProductionContract ? 'Mainnet' : 'Unknown');
          setExpectedNetwork(expected);
          setNetworkMatch(network === expected);
        } catch (error) {
          console.error('Error checking network:', error);
        }
      }
    };

    checkNetwork();

    // Listen for network changes
    if (window.ethereum) {
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('chainChanged', () => {});
      }
    };
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Check for MetaMask specifically
    if (!window.ethereum || !window.ethereum.isMetaMask) {
    if (!window.ethereum) {
        setError('Please install MetaMask extension!');
      } else {
        setError('Please use MetaMask wallet. Other wallets are not supported.');
      }
      return;
    }

    if (!CONTRACT_ADDRESS) {
      setError('Contract address not configured. Please set REACT_APP_CONTRACT_ADDRESS in .env');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if MetaMask is connected
      if (!window.ethereum.isMetaMask) {
        setError('Please use MetaMask wallet. Other wallets are not supported.');
        setIsSubmitting(false);
        return;
      }
      
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) {
        setError('Please connect your MetaMask wallet first! Click "Connect Wallet" in the navbar.');
        setIsSubmitting(false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Check current network
      let chainId;
      try {
        chainId = await window.ethereum.request({ method: 'eth_chainId' });
      } catch (error) {
        setError(`Failed to get network: ${error.message}. Please check MetaMask connection.`);
        setIsSubmitting(false);
        return;
      }
      
      // Normalize chainId (handle both hex and decimal)
      const chainIdNum = typeof chainId === 'string' && chainId.startsWith('0x') 
        ? parseInt(chainId, 16) 
        : parseInt(chainId);
      
      const isSepolia = chainIdNum === 11155111 || chainId === '0xaa36a7' || chainId === '11155111';
      const isMainnet = chainIdNum === 1 || chainId === '0x1' || chainId === '1';
      const currentNetwork = isSepolia ? 'Sepolia' : (isMainnet ? 'Mainnet' : `Chain ID ${chainIdNum}`);
      
      // Determine expected network based on contract address (normalize addresses for comparison)
      const normalizedContractAddress = CONTRACT_ADDRESS.toLowerCase().trim();
      const testContractAddress = "0x34f0f88b1e637640f1fb0b01dbfd02f7a8b7b92";
      const productionContractAddress = "0x1be0f1d26748c6c879b988e3516a284c7ea1380a";
      
      const isTestContract = normalizedContractAddress === testContractAddress;
      const isProductionContract = normalizedContractAddress === productionContractAddress;
      const expectedNetwork = isTestContract ? 'Sepolia' : (isProductionContract ? 'Mainnet' : 'Unknown');
      
      console.log('Network check:', { 
        chainId, 
        chainIdNum, 
        isSepolia, 
        isMainnet, 
        currentNetwork, 
        isTestContract, 
        isProductionContract,
        expectedNetwork, 
        CONTRACT_ADDRESS,
        normalizedContractAddress
      });
      
      // Check network match first
      if (isTestContract && !isSepolia) {
        setError(`Network mismatch: You're on ${currentNetwork}, but the test contract requires Sepolia. Please switch to Sepolia using the network selector in the navbar.`);
        setIsSubmitting(false);
        return;
      }
      
      if (isProductionContract && !isMainnet) {
        // Offer to switch network automatically
        const shouldSwitch = window.confirm(
          `Network mismatch: You're on ${currentNetwork}, but the production contract requires Mainnet. ` +
          `Would you like to switch to Mainnet automatically?`
        );
        
        if (shouldSwitch) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x1' }],
            });
            // Reload page after network switch
            window.location.reload();
            return;
          } catch (switchError) {
            // If network doesn't exist, add it
            if (switchError.code === 4902) {
              try {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: '0x1',
                    chainName: 'Ethereum Mainnet',
                    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                    rpcUrls: ['https://eth.llamarpc.com'],
                    blockExplorerUrls: ['https://etherscan.io']
                  }],
                });
                window.location.reload();
                return;
              } catch (addError) {
                setError(`Failed to add Mainnet: ${addError.message}. Please switch manually using MetaMask.`);
                setIsSubmitting(false);
                return;
              }
            } else {
              setError(`Failed to switch network: ${switchError.message}. Please switch to Mainnet manually using the network selector in the navbar.`);
              setIsSubmitting(false);
              return;
            }
          }
        } else {
          setError(`Network mismatch: You're on ${currentNetwork}, but the production contract requires Mainnet. Please switch to Mainnet using the network selector in the navbar.`);
          setIsSubmitting(false);
          return;
        }
      }
      
      // If contract address doesn't match known addresses, warn but allow to proceed
      if (!isTestContract && !isProductionContract) {
        console.warn(`Unknown contract address: ${CONTRACT_ADDRESS}. Proceeding with transaction but network validation is skipped.`);
      }
      
      // Verify contract exists at address (only if network matches)
      let contractCode;
      try {
        contractCode = await provider.getCode(CONTRACT_ADDRESS);
        console.log('Contract code check:', { address: CONTRACT_ADDRESS, codeLength: contractCode?.length, isEmpty: !contractCode || contractCode === "0x" });
      } catch (codeError) {
        console.error('Error checking contract code:', codeError);
        setError(`Failed to verify contract: ${codeError.message}. Please check your network connection and RPC endpoint.`);
        setIsSubmitting(false);
        return;
      }
      
      // Check if contract exists
      if (!contractCode || contractCode === "0x") {
        let errorMsg = `Contract not found at address ${CONTRACT_ADDRESS} on ${currentNetwork}. `;
        if (isTestContract) {
          errorMsg += `The test contract might not be deployed at this address on Sepolia. `;
          errorMsg += `Please verify: https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`;
        } else {
          errorMsg += `Please verify: https://etherscan.io/address/${CONTRACT_ADDRESS}`;
        }
        setError(errorMsg);
        setIsSubmitting(false);
        return;
      }
      
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      // Get MNEE token address with error handling
      // Priority: 1) Environment variable, 2) Contract's mnee() function, 3) Hardcoded fallback for production
      let mneeAddress;
      
      // First, check if MNEE address is set in environment variable
      if (MNEE_ADDRESS) {
        mneeAddress = MNEE_ADDRESS;
        console.log("Using MNEE address from environment variable:", mneeAddress);
      } else {
        // Try to get from contract
        try {
          mneeAddress = await contract.mnee();
          if (!mneeAddress || mneeAddress === ethers.ZeroAddress) {
            throw new Error("MNEE address is zero or invalid");
          }
          console.log("Using MNEE address from contract:", mneeAddress);
        } catch (error) {
          console.error("Error fetching MNEE address from contract:", error);
          
          // For production contract, use the known MNEE address from deployment
          if (isProductionContract) {
            // Use the official MNEE address from deployment config
            mneeAddress = "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF";
            console.warn("Using hardcoded MNEE address for production contract:", mneeAddress);
          } else {
            setError(`Failed to get MNEE token address. The contract may not be properly deployed or the address is incorrect. Error: ${error.message}`);
            setIsSubmitting(false);
            return;
          }
        }
      }
      
      // Verify MNEE contract exists (but allow it to proceed if MNEE address is set via env or it's production contract)
      try {
        const mneeCode = await provider.getCode(mneeAddress);
        if (!mneeCode || mneeCode === "0x") {
          // If MNEE address was set via environment variable, trust it and proceed
          if (MNEE_ADDRESS) {
            console.warn(`MNEE token contract not found at ${mneeAddress} on ${currentNetwork}. Proceeding anyway since address was set via REACT_APP_MNEE_ADDRESS environment variable.`);
          } else if (isProductionContract) {
            // For production contract on Sepolia, MNEE doesn't exist but we'll try anyway
            // The transaction will fail at the contract level, but at least we can attempt it
            console.warn(`MNEE token contract not found at ${mneeAddress} on Sepolia. This is expected - the official MNEE only exists on Mainnet. The transaction may fail.`);
          } else {
            setError(`MNEE token contract not found at ${mneeAddress}. Please check the token address.`);
            setIsSubmitting(false);
            return;
          }
        } else {
          console.log(`✅ MNEE token contract verified at ${mneeAddress}`);
        }
      } catch (error) {
        console.warn("Could not verify MNEE contract:", error);
        // If MNEE address was set via environment variable, trust it and proceed
        if (MNEE_ADDRESS) {
          console.warn(`Could not verify MNEE contract, but proceeding since address was set via REACT_APP_MNEE_ADDRESS: ${error.message}`);
        } else if (!isProductionContract) {
          setError(`Could not verify MNEE contract: ${error.message}`);
          setIsSubmitting(false);
          return;
        }
      }
      
      const mneeContract = new ethers.Contract(mneeAddress, MNEE_ABI, signer);
      
      // Get decimals with fallback to 18 (standard ERC-20)
      let decimals = 18; // Default to 18 decimals
      try {
        decimals = await mneeContract.decimals();
      } catch (error) {
        console.warn('Could not fetch decimals, using default 18:', error.message);
        // If decimals() fails, assume 18 decimals (standard ERC-20)
      }
      
      const rewardAmount = ethers.parseUnits(formData.reward, decimals);
      
      // Check and approve allowance
      let allowance = 0n;
      try {
        allowance = await mneeContract.allowance(await signer.getAddress(), CONTRACT_ADDRESS);
      } catch (error) {
        console.warn('Could not check allowance, will attempt approval:', error.message);
      }
      
      if (allowance < rewardAmount) {
        setSuccess('Approving MNEE spending... Please confirm in MetaMask.');
        try {
        const approveTx = await mneeContract.approve(CONTRACT_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
          setSuccess('Approval confirmed! Creating task...');
        } catch (approveError) {
          setError(`Approval failed: ${approveError.message}. Please try again.`);
          setIsSubmitting(false);
          return;
        }
      }

      // Calculate deadline (convert days to timestamp)
      const days = parseInt(formData.deadline);
      const deadline = Math.floor(Date.now() / 1000) + (days * 24 * 60 * 60);

      // Validate deadline is in the future
      if (deadline <= Math.floor(Date.now() / 1000)) {
        setError('Deadline must be in the future. Please enter a valid number of days.');
        setIsSubmitting(false);
        return;
      }

      // Check MNEE balance before creating task
      let balance;
      try {
        balance = await mneeContract.balanceOf(await signer.getAddress());
        if (balance < rewardAmount) {
          setError(`Insufficient MNEE balance. You have ${ethers.formatUnits(balance, decimals)} MNEE, but need ${formData.reward} MNEE.`);
          setIsSubmitting(false);
          return;
        }
      } catch (error) {
        console.warn('Could not check balance:', error.message);
      }

      // Create task with better error handling
      setSuccess('Creating task... Please confirm in MetaMask.');
      let tx;
      try {
        // Try to estimate gas first to catch errors early
        try {
          await contract.createTask.estimateGas(formData.description, rewardAmount, deadline);
        } catch (estimateError) {
          // Parse the error to get the actual revert reason
          let errorMsg = 'Failed to create task. ';
          
          // Try to decode the error
          if (estimateError.reason) {
            errorMsg += estimateError.reason;
          } else if (estimateError.data) {
            // Try to decode error data
            try {
              const reason = contract.interface.parseError(estimateError.data);
              errorMsg += reason ? reason.name : 'Contract reverted';
            } catch (e) {
              // If we can't decode, check common error patterns
              if (estimateError.data && estimateError.data.length > 10) {
                errorMsg += 'Contract reverted. Check your MNEE balance and allowance.';
              } else {
                errorMsg += 'Transaction would fail. ';
              }
            }
          }
          
          // Check error message for common issues
          if (estimateError.message) {
            if (estimateError.message.includes('allowance') || estimateError.message.includes('Insufficient allowance')) {
              errorMsg = 'Insufficient MNEE allowance. Please approve spending first.';
            } else if (estimateError.message.includes('balance') || estimateError.message.includes('Transfer failed')) {
              errorMsg = 'Insufficient MNEE balance. Please check your MNEE token balance.';
            } else if (estimateError.message.includes('deadline') || estimateError.message.includes('Deadline must be')) {
              errorMsg = 'Deadline must be in the future.';
            } else if (estimateError.message.includes('Reward must be')) {
              errorMsg = 'Reward must be greater than 0.';
            } else if (!errorMsg.includes('Contract reverted') && !errorMsg.includes('Failed to create task')) {
              errorMsg += estimateError.message;
            }
          }
          
          // Final fallback
          if (errorMsg === 'Failed to create task. ') {
            errorMsg = 'Transaction would fail. Please check: 1) You have enough MNEE tokens, 2) You approved spending, 3) Deadline is in the future.';
          }
          
          setError(errorMsg);
          setIsSubmitting(false);
          return;
        }
        
        tx = await contract.createTask(formData.description, rewardAmount, deadline);
      setSuccess(`Transaction submitted! Waiting for confirmation...`);
      } catch (createError) {
        let errorMsg = 'Failed to create task. ';
        if (createError.reason) {
          errorMsg += createError.reason;
        } else if (createError.message) {
          if (createError.message.includes('user rejected')) {
            errorMsg = 'Transaction was cancelled.';
          } else if (createError.message.includes('allowance')) {
            errorMsg += 'Insufficient MNEE allowance.';
          } else if (createError.message.includes('balance')) {
            errorMsg += 'Insufficient MNEE balance.';
          } else {
            errorMsg += createError.message;
          }
        } else {
          errorMsg += 'Please check your MNEE balance and allowance.';
        }
        setError(errorMsg);
        setIsSubmitting(false);
        return;
      }
      
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt.hash);
      
      // Get task ID from event or taskCounter
      let taskId;
      try {
        // Try to get task ID from event first
        if (receipt.logs && receipt.logs.length > 0) {
          const iface = new ethers.Interface(CONTRACT_ABI);
          for (const log of receipt.logs) {
            try {
              const parsed = iface.parseLog(log);
              if (parsed && parsed.name === 'TaskCreated') {
                taskId = Number(parsed.args.taskId);
                console.log('Task ID from event:', taskId);
                break;
              }
            } catch (e) {
              // Not our event, continue
            }
          }
        }
        
        // Fallback to taskCounter if event parsing failed
        if (!taskId) {
          const taskCounter = await contract.taskCounter();
          taskId = Number(taskCounter);
          console.log('Task ID from taskCounter:', taskId);
        }
      } catch (error) {
        console.error('Error getting task ID:', error);
        setError('Task created but failed to get task ID. Please check the transaction on Etherscan.');
        setIsSubmitting(false);
        return;
      }

      // Store in backend - try multiple times if needed
      let backendSaved = false;
      const creatorAddress = await signer.getAddress();
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await axios.post(`${API_URL}/api/tasks`, {
            taskId,
            creator: creatorAddress,
            description: formData.description,
            reward: rewardAmount.toString(), // Send wei value, not human-readable value
            deadline,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber
          });
          console.log('✅ Task saved to backend:', response.data);
          backendSaved = true;
          break;
        } catch (err) {
          console.error(`Error storing task in backend (attempt ${attempt}/3):`, err.message);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Wait before retry
          }
        }
      }
      
      if (!backendSaved) {
        console.warn('⚠️  Task created on blockchain but backend save failed. Backend sync will pick it up automatically.');
        setSuccess(`Task created successfully on blockchain! Task ID: ${taskId}. Backend will sync automatically.`);
      } else {
        setSuccess(`Task created successfully! Task ID: ${taskId}`);
      }
      
      setTimeout(() => {
        navigate(`/task/${taskId}`);
      }, 2000);
    } catch (error) {
      console.error('Error creating task:', error);
      let errorMessage = 'Failed to create task';
      
      if (error.message && error.message.includes('user rejected')) {
        errorMessage = 'Transaction was cancelled. Please try again.';
      } else if (error.message && error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds. Please check your ETH balance for gas fees.';
      } else if (error.message && error.message.includes('allowance')) {
        errorMessage = 'Insufficient MNEE allowance. Please approve spending first.';
      } else if (error.message && error.message.includes('gas')) {
        errorMessage = 'Gas limit error. Please try again or adjust gas settings in MetaMask.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-task">
      <div className="container">
        <div className="card">
          <h1>Create New Task</h1>
          <p className="subtitle">Post a task and set a reward in MNEE. The AI agent will automatically solve it!</p>

          {/* Network Status Indicator */}
          {currentNetwork && expectedNetwork && (
            <div className={`network-status ${networkMatch ? 'network-match' : 'network-mismatch'}`}>
              <div className="network-info">
                <span className="network-label">Current Network:</span>
                <span className="network-value">{currentNetwork}</span>
                {networkMatch ? (
                  <span className="network-check">✓</span>
                ) : (
                  <>
                    <span className="network-separator">→</span>
                    <span className="network-label">Required:</span>
                    <span className="network-value">{expectedNetwork}</span>
                  </>
                )}
              </div>
              {!networkMatch && (
                <div className="network-warning">
                  Please switch to {expectedNetwork} using the network selector in the navbar.
                </div>
              )}
            </div>
          )}

          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="description">Task Description *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                placeholder="Describe the task you want the AI agent to complete. Be specific and clear."
              />
            </div>

            <div className="input-group">
              <label htmlFor="reward">Reward (MNEE) *</label>
              <input
                type="number"
                id="reward"
                name="reward"
                value={formData.reward}
                onChange={handleChange}
                required
                min="0.01"
                step="0.01"
                placeholder="0.00"
              />
            </div>

            <div className="input-group">
              <label htmlFor="deadline">Deadline (Days) *</label>
              <input
                type="number"
                id="deadline"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                required
                min="1"
                placeholder="7"
              />
              <small>Number of days from now until the task deadline</small>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Task...' : 'Create Task'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateTask;

