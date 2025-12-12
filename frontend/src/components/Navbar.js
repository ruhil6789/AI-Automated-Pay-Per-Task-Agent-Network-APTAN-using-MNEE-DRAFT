import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import './Navbar.css';

// Network configurations
const NETWORKS = {
  sepolia: {
    chainId: '0xaa36a7', // 11155111
    chainName: 'Sepolia',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.sepolia.org'],
    blockExplorerUrls: ['https://sepolia.etherscan.io']
  },
  mainnet: {
    chainId: '0x1', // 1
    chainName: 'Ethereum Mainnet',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://eth.llamarpc.com'],
    blockExplorerUrls: ['https://etherscan.io']
  }
};

function Navbar() {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState('0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [network, setNetwork] = useState(null);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    checkWalletConnection();
    checkNetwork();
    
    // Listen for network changes
    if (window.ethereum) {
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
      window.ethereum.on('accountsChanged', () => {
        checkWalletConnection();
        checkNetwork();
      });
    }
  }, []);

  const checkNetwork = async () => {
    if (window.ethereum && window.ethereum.isMetaMask) {
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId === NETWORKS.sepolia.chainId) {
          setNetwork('Sepolia');
        } else if (chainId === NETWORKS.mainnet.chainId) {
          setNetwork('Mainnet');
        } else {
          setNetwork('Unknown');
        }
      } catch (error) {
        console.error('Error checking network:', error);
      }
    }
  };

  const switchNetwork = async (networkName) => {
    if (!window.ethereum || !window.ethereum.isMetaMask) {
      alert('Please install MetaMask to switch networks');
      return;
    }

    setIsSwitching(true);
    try {
      const targetNetwork = NETWORKS[networkName.toLowerCase()];
      if (!targetNetwork) {
        throw new Error('Invalid network');
      }

      try {
        // Try to switch to the network
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetNetwork.chainId }],
        });
        setNetwork(targetNetwork.chainName);
      } catch (switchError) {
        // If network doesn't exist, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [targetNetwork],
          });
          setNetwork(targetNetwork.chainName);
        } else {
          throw switchError;
        }
      }
    } catch (error) {
      console.error('Error switching network:', error);
      alert(`Failed to switch network: ${error.message}`);
    } finally {
      setIsSwitching(false);
    }
  };

  const checkWalletConnection = async () => {
    // Only check for MetaMask
    if (window.ethereum && window.ethereum.isMetaMask) {
      try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        setAccount(accounts[0].address);
        updateBalance(accounts[0].address);
        }
      } catch (error) {
        console.error('Error checking MetaMask connection:', error);
      }
    }
  };

  const updateBalance = async (address) => {
    if (window.ethereum && window.ethereum.isMetaMask && address) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const balance = await provider.getBalance(address);
        setBalance(ethers.formatEther(balance));
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    }
  };

  const connectWallet = async () => {
    // Check for MetaMask specifically
    if (window.ethereum && window.ethereum.isMetaMask) {
      // MetaMask is available
    setIsConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);
      updateBalance(address);
    } catch (error) {
        console.error('Error connecting MetaMask:', error);
        if (error.code === 4001) {
          alert('Please connect your MetaMask account');
        } else {
          alert('Failed to connect MetaMask: ' + error.message);
        }
    } finally {
      setIsConnecting(false);
      }
    } else if (window.ethereum) {
      // Other wallet detected (like Phantom)
      alert('Please use MetaMask wallet. Other wallets are not supported. Please install MetaMask extension.');
    } else {
      alert('Please install MetaMask extension to use this application!');
      window.open('https://metamask.io/download/', '_blank');
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">🤖</span>
          APTAN
        </Link>
        <div className="navbar-links">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/create-task" className="nav-link">Create Task</Link>
          <Link to="/tasks" className="nav-link">Tasks</Link>
          <div className="network-switcher">
            <select 
              className="network-select"
              value={network || ''}
              onChange={(e) => switchNetwork(e.target.value)}
              disabled={isSwitching || !window.ethereum}
            >
              <option value="">Select Network</option>
              <option value="sepolia">Sepolia Testnet</option>
              <option value="mainnet">Ethereum Mainnet</option>
            </select>
            {network && <span className="network-badge">{network}</span>}
          </div>
          {account ? (
            <div className="wallet-info">
              <span className="balance">{parseFloat(balance).toFixed(4)} ETH</span>
              <span className="address">{formatAddress(account)}</span>
            </div>
          ) : (
            <button 
              className="btn-connect" 
              onClick={connectWallet}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

