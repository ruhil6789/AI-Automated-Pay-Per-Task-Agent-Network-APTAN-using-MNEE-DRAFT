import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ethers } from 'ethers';
import './Tasks.css';

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "";
const CONTRACT_ABI = [
  "function getTask(uint256 taskId) external view returns (tuple(address creator, uint256 reward, string description, uint256 deadline, bool completed, address agent, string solution, uint256 createdAt))",
  "function taskCounter() external view returns (uint256)"
];

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      // Try to load from backend first
      try {
        const response = await axios.get('http://localhost:3001/api/tasks');
        // If backend responds successfully (even with empty array), use it
        setTasks(response.data || []);
        setLoading(false);
        return;
      } catch (err) {
        // Only fallback to blockchain if backend is actually unavailable
        if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK' || err.response?.status >= 500) {
          console.log('Backend not available, loading from blockchain');
        } else {
          // Backend responded but with an error, use empty array
          setTasks([]);
          setLoading(false);
          return;
        }
      }

      // Fallback to blockchain only if backend is unavailable
      if (window.ethereum && window.ethereum.isMetaMask && CONTRACT_ADDRESS) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        const taskCounter = await contract.taskCounter();
        const taskCount = Number(taskCounter);

        const tasksList = [];
        for (let i = 1; i <= taskCount; i++) {
          try {
            const task = await contract.getTask(i);
            tasksList.push({
              taskId: i,
              creator: task.creator,
              description: task.description,
              reward: task.reward.toString(),
              deadline: Number(task.deadline),
              completed: task.completed,
              agent: task.agent,
              solution: task.solution,
              createdAt: Number(task.createdAt)
            });
          } catch (err) {
            console.error(`Error loading task ${i}:`, err);
          }
        }

        setTasks(tasksList.reverse());
      } else {
        setError('Please connect MetaMask and ensure contract is deployed');
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return 'N/A';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const formatReward = (reward) => {
    if (!reward) return '0';
    try {
      // Handle both string and BigNumber inputs
      let rewardValue;
      if (typeof reward === 'string') {
        // Check if it's a very small number that might be incorrectly stored
        const numValue = parseFloat(reward);
        // If the value is less than 1e15 (0.001 MNEE in wei), it might be incorrectly stored
        // as human-readable value instead of wei
        if (numValue < 1e15 && numValue > 0 && numValue < 1000000) {
          console.warn(`⚠️ Reward value "${reward}" seems too small. It might be stored incorrectly. Expected wei value (e.g., "3000000000000000000" for 3 MNEE).`);
          // Assume it's already in MNEE format if it's a reasonable number
          return numValue.toString();
        }
        rewardValue = BigInt(reward);
      } else {
        rewardValue = reward;
      }
      // formatEther assumes 18 decimals (standard for ERC20 tokens)
      const formatted = ethers.formatEther(rewardValue);
      return formatted;
    } catch (error) {
      console.error('Error formatting reward:', error, 'reward:', reward);
      // Fallback: try to parse as number if it's already in human-readable format
      if (typeof reward === 'string' && !isNaN(parseFloat(reward))) {
        return parseFloat(reward).toString();
      }
      return reward.toString();
    }
  };

  if (loading) {
    return (
      <div className="tasks">
        <div className="container">
          <div className="loading">Loading tasks...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="tasks">
      <div className="container">
        <h1>All Tasks</h1>
        {error && <div className="error">{error}</div>}
        
        {tasks.length === 0 ? (
          <div className="card">
            <p>No tasks found. <Link to="/create-task">Create the first task!</Link></p>
          </div>
        ) : (
          <div className="task-grid">
            {tasks.map((task) => (
              <Link key={task.taskId} to={`/task/${task.taskId}`} className="task-card-link">
                <div className="task-card">
                  <div className="task-header">
                    <h3>Task #{task.taskId}</h3>
                    <span className={`status-badge ${task.completed ? 'status-completed' : 'status-pending'}`}>
                      {task.completed ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                  <p className="task-description">{task.description}</p>
                  <div className="task-meta">
                    <div>
                      <strong>Reward:</strong> {formatReward(task.reward)} MNEE
                    </div>
                    <div>
                      <strong>Deadline:</strong> {formatDate(task.deadline)}
                    </div>
                  </div>
                  {task.completed && task.agent && (
                    <div className="task-agent">
                      <strong>Completed by:</strong> {formatAddress(task.agent)}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Tasks;

