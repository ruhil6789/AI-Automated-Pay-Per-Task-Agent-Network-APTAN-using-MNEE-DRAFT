const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("APTAN", function () {
  let aptan, mockMNEE;
  let owner, creator, agent;
  const initialSupply = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, creator, agent] = await ethers.getSigners();

    // Deploy MockMNEE
    const MockMNEE = await ethers.getContractFactory("MockMNEE");
    mockMNEE = await MockMNEE.deploy();
    await mockMNEE.waitForDeployment();

    // Deploy APTAN
    const APTAN = await ethers.getContractFactory("APTAN");
    aptan = await APTAN.deploy(await mockMNEE.getAddress());
    await aptan.waitForDeployment();

    // Mint tokens to creator
    await mockMNEE.mint(creator.address, initialSupply);
  });

  describe("Task Creation", function () {
    it("Should create a task and lock reward in escrow", async function () {
      const reward = ethers.parseEther("10");
      const deadline = Math.floor(Date.now() / 1000) + 86400; // 1 day

      // Approve spending
      await mockMNEE.connect(creator).approve(await aptan.getAddress(), reward);

      // Create task
      await expect(
        aptan.connect(creator).createTask("Test task", reward, deadline)
      )
        .to.emit(aptan, "TaskCreated")
        .withArgs(1, creator.address, reward, "Test task", deadline);

      // Check task was created
      const task = await aptan.getTask(1);
      expect(task.creator).to.equal(creator.address);
      expect(task.reward).to.equal(reward);
      expect(task.description).to.equal("Test task");
      expect(task.completed).to.be.false;

      // Check escrow balance
      const escrowBalance = await mockMNEE.balanceOf(await aptan.getAddress());
      expect(escrowBalance).to.equal(reward);
    });

    it("Should revert if reward is zero", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await expect(
        aptan.connect(creator).createTask("Test", 0, deadline)
      ).to.be.revertedWith("Reward must be greater than 0");
    });

    it("Should revert if deadline is in the past", async function () {
      const reward = ethers.parseEther("10");
      const pastDeadline = Math.floor(Date.now() / 1000) - 86400;
      
      await mockMNEE.connect(creator).approve(await aptan.getAddress(), reward);
      
      await expect(
        aptan.connect(creator).createTask("Test", reward, pastDeadline)
      ).to.be.revertedWith("Deadline must be in the future");
    });
  });

  describe("Task Completion", function () {
    beforeEach(async function () {
      const reward = ethers.parseEther("10");
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      
      await mockMNEE.connect(creator).approve(await aptan.getAddress(), reward);
      await aptan.connect(creator).createTask("Test task", reward, deadline);
    });

    it("Should complete task and release payment", async function () {
      const initialBalance = await mockMNEE.balanceOf(agent.address);
      const solution = "This is the AI solution";

      await expect(
        aptan.connect(agent).submitResult(1, agent.address, solution)
      )
        .to.emit(aptan, "TaskCompleted")
        .withArgs(1, agent.address, solution)
        .to.emit(aptan, "PaymentReleased")
        .withArgs(1, agent.address, ethers.parseEther("10"));

      // Check task is completed
      const task = await aptan.getTask(1);
      expect(task.completed).to.be.true;
      expect(task.agent).to.equal(agent.address);
      expect(task.solution).to.equal(solution);

      // Check payment was released
      const finalBalance = await mockMNEE.balanceOf(agent.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("10"));
    });

    it("Should revert if task already completed", async function () {
      const solution = "First solution";
      await aptan.connect(agent).submitResult(1, agent.address, solution);

      await expect(
        aptan.connect(agent).submitResult(1, agent.address, "Second solution")
      ).to.be.revertedWith("Task already completed");
    });

    it("Should revert if deadline passed", async function () {
      // Create task with very short deadline
      const reward = ethers.parseEther("5");
      const shortDeadline = Math.floor(Date.now() / 1000) + 1;
      
      await mockMNEE.connect(creator).approve(await aptan.getAddress(), reward);
      await aptan.connect(creator).createTask("Short deadline", reward, shortDeadline);

      // Wait for deadline to pass
      await new Promise(resolve => setTimeout(resolve, 2000));

      await expect(
        aptan.connect(agent).submitResult(2, agent.address, "Solution")
      ).to.be.revertedWith("Task deadline passed");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      const reward = ethers.parseEther("10");
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      
      await mockMNEE.connect(creator).approve(await aptan.getAddress(), reward);
      await aptan.connect(creator).createTask("Task 1", reward, deadline);
    });

    it("Should return user tasks", async function () {
      const userTasks = await aptan.getUserTasks(creator.address);
      expect(userTasks.length).to.equal(1);
      expect(userTasks[0]).to.equal(1);
    });

    it("Should return pending tasks", async function () {
      const pending = await aptan.getPendingTasks();
      expect(pending.length).to.equal(1);
      expect(pending[0]).to.equal(1);
    });
  });
});

