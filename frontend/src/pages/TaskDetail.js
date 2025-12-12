import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ethers } from 'ethers';
import { io } from 'socket.io-client';
import { API_URL } from '../config';
import './TaskDetail.css';

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "";
const CONTRACT_ABI = [
  "function getTask(uint256 taskId) external view returns (tuple(address creator, uint256 reward, string description, uint256 deadline, bool completed, address agent, string solution, uint256 createdAt))"
];

function TaskDetail() {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsReconnecting, setWsReconnecting] = useState(false);
  const socketRef = useRef(null);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    loadTask();
    
    // Initialize WebSocket connection for real-time updates
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000
    });
    
    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setWsConnected(true);
      setWsReconnecting(false);
      // Join task-specific room
      socket.emit('joinTask', parseInt(id));
    });
    
    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setWsConnected(false);
      if (reason === 'io server disconnect') {
        // Server disconnected, reconnect manually
        socket.connect();
      }
    });
    
    socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 WebSocket reconnected after ${attemptNumber} attempts`);
      setWsConnected(true);
      setWsReconnecting(false);
      // Rejoin task room after reconnection
      socket.emit('joinTask', parseInt(id));
    });
    
    socket.on('reconnect_attempt', () => {
      console.log('🔄 Attempting to reconnect WebSocket...');
      setWsReconnecting(true);
    });
    
    socket.on('reconnect_error', (error) => {
      console.error('❌ WebSocket reconnection error:', error);
      setWsReconnecting(true);
    });
    
    socket.on('reconnect_failed', () => {
      console.error('❌ WebSocket reconnection failed');
      setWsConnected(false);
      setWsReconnecting(false);
    });
    
    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      setWsConnected(false);
    });
    
    socket.on('taskUpdate', (data) => {
      if (data.taskId === parseInt(id)) {
        console.log('📡 Received real-time update:', data);
        // Update task state immediately
        setTask(prev => ({
          ...prev,
          ...data
        }));
        setLoading(false);
        
        if (data.completed) {
          setSuccess('✅ Task completed! Solution received via real-time update.');
          // Clear success message after 5 seconds
          setTimeout(() => setSuccess(''), 5000);
        } else if (data.solutionError) {
          setError(`⚠️ Task error: ${data.solutionError}`);
        }
      }
    });
    
    socketRef.current = socket;
    
    // Fallback: Also set up Server-Sent Events (SSE) as alternative
    try {
      const eventSource = new EventSource(`${API_URL}/api/tasks/${id}/events`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'update' && data.taskId === parseInt(id)) {
          console.log('📡 Received SSE update:', data);
          setTask(prev => ({
            ...prev,
            ...data
          }));
          setLoading(false);
          
          if (data.completed) {
            setSuccess('Task completed! Solution received.');
          }
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource.close();
      };
      
      eventSourceRef.current = eventSource;
    } catch (err) {
      console.log('SSE not supported, using WebSocket only');
    }
    
    return () => {
      // Cleanup WebSocket
      if (socketRef.current) {
        socketRef.current.emit('leaveTask', parseInt(id));
        socketRef.current.disconnect();
      }
      // Cleanup SSE
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [id]);

  useEffect(() => {
    // Fallback polling if WebSocket/SSE fail (every 10 seconds instead of 5)
    let pollInterval;
    if (task && !task.completed && !task.solutionError) {
      setIsPolling(true);
      // Use longer interval since we have real-time updates
      pollInterval = setInterval(() => {
        loadTask();
      }, 10000); // Poll every 10 seconds as fallback
    } else {
      setIsPolling(false);
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [task?.completed, task?.solutionError]);

  const loadTask = async () => {
    if (!isPolling && !task) {
      setLoading(true);
    }
    try {
      // Try backend first
      try {
        const response = await axios.get(`${API_URL}/api/tasks/${id}`);
        if (response.data) {
          setTask(response.data);
          setLoading(false);
          return;
        }
      } catch (err) {
        if (!isPolling) {
          console.log('Loading from blockchain');
        }
      }

      // Fallback to blockchain
      if (window.ethereum && window.ethereum.isMetaMask && CONTRACT_ADDRESS) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        const taskData = await contract.getTask(id);
        
        setTask({
          taskId: parseInt(id),
          creator: taskData.creator,
          description: taskData.description,
          reward: taskData.reward.toString(),
          deadline: Number(taskData.deadline),
          completed: taskData.completed,
          agent: taskData.agent,
          solution: taskData.solution,
          createdAt: Number(taskData.createdAt)
        });
      } else {
        setError('Please connect MetaMask');
      }
    } catch (err) {
      console.error('Error loading task:', err);
      setError('Failed to load task');
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return 'N/A';
    return addr;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    // Handle both Unix timestamp (seconds) and JavaScript timestamp (milliseconds)
    const date = timestamp > 1000000000000 
      ? new Date(timestamp) 
      : new Date(timestamp * 1000);
    return date.toLocaleString();
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

  const handleRetry = async () => {
    setIsRetrying(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/api/tasks/${id}/retry`);
      if (response.data.success) {
        setSuccess('Task retry successful! Refreshing...');
        setTimeout(() => {
          loadTask();
        }, 2000);
      }
    } catch (err) {
      setError(`Retry failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="task-detail">
        <div className="container">
          <div className="loading">Loading task...</div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="task-detail">
        <div className="container">
          <div className="error">{error || 'Task not found'}</div>
          <Link to="/tasks" className="btn btn-primary">Back to Tasks</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="task-detail">
      <div className="container">
        <Link to="/tasks" className="back-link">← Back to Tasks</Link>
        
        <div className="card">
          {/* WebSocket Connection Status */}
          <div className={`ws-status ${wsConnected ? 'ws-connected' : wsReconnecting ? 'ws-reconnecting' : 'ws-disconnected'}`}>
            <span className="ws-indicator"></span>
            <span className="ws-text">
              {wsConnected 
                ? '🟢 Real-time updates active' 
                : wsReconnecting 
                  ? '🟡 Reconnecting...' 
                  : '🔴 Real-time updates unavailable (using polling)'}
            </span>
          </div>

          {success && <div className="success">{success}</div>}
          {error && <div className="error">{error}</div>}

          <div className="task-header-detail">
            <h1>Task #{task.taskId}</h1>
            <span className={`status-badge ${task.completed ? 'status-completed' : 'status-pending'}`}>
              {task.completed ? 'Completed' : 'Pending'}
            </span>
          </div>

          <div className="task-info-grid">
            <div className="info-item">
              <strong>Creator:</strong>
              <span className="address">{formatAddress(task.creator)}</span>
            </div>
            <div className="info-item">
              <strong>Reward:</strong>
              <span className="reward">{formatReward(task.reward)} MNEE</span>
            </div>
            <div className="info-item">
              <strong>Created:</strong>
              <span>{formatDate(task.createdAt)}</span>
            </div>
            <div className="info-item">
              <strong>Deadline:</strong>
              <span>{formatDate(task.deadline)}</span>
            </div>
            {task.completed && task.agent && (
              <div className="info-item">
                <strong>Completed by:</strong>
                <span className="address">{formatAddress(task.agent)}</span>
              </div>
            )}
          </div>

          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          <div className="task-section">
            <h2>Description</h2>
            <p className="task-description-full">{task.description}</p>
          </div>

          {task.completed && task.solution && (
            <div className="task-section">
              <h2>AI Agent Solution</h2>
              <div className={`solution-box ${task.solutionError ? 'solution-error' : ''}`}>
                <p>{task.solution}</p>
                {task.solutionError && (
                  <div className="error-note">
                    <strong>Note:</strong> This task encountered an error: {task.solutionError}
                    {task.fallback && (
                      <span className="fallback-badge"> (Fallback response)</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {task.solutionError && !task.completed && (
            <div className="task-section">
              <div className="error-notice">
                <h3>⚠️ Task Processing Error</h3>
                <p><strong>Error:</strong> {task.solutionError}</p>
                {task.solutionErrorCode && (
                  <p><strong>Error Code:</strong> {task.solutionErrorCode}</p>
                )}
                {task.attemptedAt && (
                  <p><strong>Last Attempt:</strong> {new Date(task.attemptedAt).toLocaleString()}</p>
                )}
                <p className="error-help">The AI agent will retry automatically. If the error persists, you can manually retry below.</p>
                <button 
                  onClick={handleRetry} 
                  disabled={isRetrying}
                  className="btn btn-primary"
                  style={{ marginTop: '16px' }}
                >
                  {isRetrying ? 'Retrying...' : '🔄 Retry Task'}
                </button>
              </div>
            </div>
          )}

          {!task.completed && !task.solutionError && (
            <div className="task-section">
              <div className="pending-notice">
                <div className="loading-spinner"></div>
                <p>⏳ This task is pending. The AI agent is processing it...</p>
                <p className="loading-subtext">Please wait, this page will update automatically when the task is completed.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaskDetail;

