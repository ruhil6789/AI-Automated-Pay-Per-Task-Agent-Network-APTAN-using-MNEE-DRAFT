// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract APTAN {
    struct Task {
        address creator;
        uint256 reward;
        string description;
        uint256 deadline;
        bool completed;
        address agent;
        string solution;
        uint256 createdAt;
    }

    IERC20 public mnee;
    uint256 public taskCounter;
    mapping(uint256 => Task) public tasks;
    mapping(address => uint256[]) public userTasks;
    mapping(address => uint256[]) public agentTasks;
    
    event TaskCreated(uint256 indexed taskId, address indexed creator, uint256 reward, string description, uint256 deadline);
    event TaskCompleted(uint256 indexed taskId, address indexed agent, string solution);
    event PaymentReleased(uint256 indexed taskId, address indexed agent, uint256 amount);
    event TaskCancelled(uint256 indexed taskId, address indexed creator, uint256 refundAmount);

    constructor(address _mnee) {
        require(_mnee != address(0), "Invalid MNEE address");
        mnee = IERC20(_mnee);
    }

    function createTask(
        string memory description,
        uint256 reward,
        uint256 deadline
    ) external {
        require(reward > 0, "Reward must be greater than 0");
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(
            mnee.allowance(msg.sender, address(this)) >= reward,
            "Insufficient allowance"
        );

        taskCounter++;
        tasks[taskCounter] = Task({
            creator: msg.sender,
            reward: reward,
            description: description,
            deadline: deadline,
            completed: false,
            agent: address(0),
            solution: "",
            createdAt: block.timestamp
        });

        userTasks[msg.sender].push(taskCounter);

        // Move MNEE to escrow
        require(
            mnee.transferFrom(msg.sender, address(this), reward),
            "Transfer failed"
        );

        emit TaskCreated(taskCounter, msg.sender, reward, description, deadline);
    }

    function submitResult(
        uint256 taskId,
        address agent,
        string memory solution
    ) external {
        Task storage t = tasks[taskId];
        require(!t.completed, "Task already completed");
        require(block.timestamp <= t.deadline, "Task deadline passed");
        require(taskId > 0 && taskId <= taskCounter, "Invalid task ID");

        t.completed = true;
        t.agent = agent;
        t.solution = solution;

        agentTasks[agent].push(taskId);

        // Release payment to agent
        require(mnee.transfer(agent, t.reward), "Payment transfer failed");

        emit TaskCompleted(taskId, agent, solution);
        emit PaymentReleased(taskId, agent, t.reward);
    }

    function cancelTask(uint256 taskId) external {
        Task storage t = tasks[taskId];
        require(taskId > 0 && taskId <= taskCounter, "Invalid task ID");
        require(!t.completed, "Task already completed");
        require(block.timestamp > t.deadline, "Task deadline has not passed");
        require(msg.sender == t.creator, "Only task creator can cancel");

        // Mark as completed to prevent further actions
        t.completed = true;

        // Refund the reward to the creator
        require(mnee.transfer(t.creator, t.reward), "Refund transfer failed");

        emit TaskCancelled(taskId, t.creator, t.reward);
    }

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function getUserTasks(address user) external view returns (uint256[] memory) {
        return userTasks[user];
    }

    function getAgentTasks(address agent) external view returns (uint256[] memory) {
        return agentTasks[agent];
    }

    function getPendingTasks() external view returns (uint256[] memory) {
        uint256[] memory pending = new uint256[](taskCounter);
        uint256 count = 0;
        
        for (uint256 i = 1; i <= taskCounter; i++) {
            if (!tasks[i].completed && block.timestamp <= tasks[i].deadline) {
                pending[count] = i;
                count++;
            }
        }
        
        // Resize array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = pending[i];
        }
        
        return result;
    }

    function getContractBalance() external view returns (uint256) {
        return mnee.balanceOf(address(this));
    }
}

