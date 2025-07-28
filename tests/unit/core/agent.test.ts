/**
 * @fileoverview Unit tests for BaseAgent class and AgentRegistry
 * @lastmodified 2025-07-28T05:58:47Z
 *
 * Features: Agent lifecycle testing, health check validation, registry management
 * Main APIs: BaseAgent test suite, AgentRegistry test suite
 * Constraints: Jest framework, comprehensive coverage, mock dependencies
 * Patterns: Test doubles, behavior verification, state testing
 */

import { BaseAgent, AgentRegistry } from "../../../src/core/agent";
import { AgentConfig, HealthCheck, AgentState } from "../../../src/types";

// Mock logger to avoid log output during tests
jest.mock("../../../src/utils/logger", () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  createLogger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Test implementation of BaseAgent
class TestAgent extends BaseAgent {
  private shouldFailHealthCheck = false;
  private shouldFailStart = false;
  private shouldFailStop = false;
  private startDelay = 0;
  private stopDelay = 0;

  constructor(config: AgentConfig) {
    super(config);
  }

  public setFailHealthCheck(fail: boolean): void {
    this.shouldFailHealthCheck = fail;
  }

  public setFailStart(fail: boolean): void {
    this.shouldFailStart = fail;
  }

  public setFailStop(fail: boolean): void {
    this.shouldFailStop = fail;
  }

  public setStartDelay(delay: number): void {
    this.startDelay = delay;
  }

  public setStopDelay(delay: number): void {
    this.stopDelay = delay;
  }

  protected async onStart(): Promise<void> {
    if (this.startDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.startDelay));
    }
    if (this.shouldFailStart) {
      throw new Error("Start failed");
    }
  }

  protected async onStop(): Promise<void> {
    if (this.stopDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.stopDelay));
    }
    if (this.shouldFailStop) {
      throw new Error("Stop failed");
    }
  }

  protected async performHealthCheck(): Promise<HealthCheck> {
    if (this.shouldFailHealthCheck) {
      throw new Error("Health check failed");
    }
    return {
      status: "healthy",
      timestamp: new Date(),
      message: "All systems operational",
    };
  }
}

describe("BaseAgent", () => {
  let testConfig: AgentConfig;

  beforeEach(() => {
    testConfig = {
      id: "test-agent-001",
      name: "Test Agent",
      version: "1.0.0",
      enabled: true,
      dependencies: [],
      healthCheckInterval: 1000,
      maxRetries: 3,
      timeout: 5000,
    };
  });

  describe("constructor", () => {
    it("should create agent with valid configuration", () => {
      const agent = new TestAgent(testConfig);
      const info = agent.getInfo();

      expect(info.id).toBe(testConfig.id);
      expect(info.name).toBe(testConfig.name);
      expect(info.state).toBe("stopped");
    });

    it("should throw error with invalid configuration", () => {
      const invalidConfig = { ...testConfig, version: "invalid" };

      expect(() => new TestAgent(invalidConfig)).toThrow(
        "Invalid agent configuration",
      );
    });

    it("should throw error with missing required fields", () => {
      const invalidConfig = { ...testConfig, id: "" };

      expect(() => new TestAgent(invalidConfig)).toThrow(
        "Invalid agent configuration",
      );
    });
  });

  describe("lifecycle management", () => {
    let agent: TestAgent;

    beforeEach(() => {
      agent = new TestAgent(testConfig);
    });

    afterEach(async () => {
      if (agent.getInfo().state === "running") {
        await agent.stop();
      }
    });

    it("should start agent successfully", async () => {
      const startPromise = agent.start();

      expect(agent.getInfo().state).toBe("starting");

      await startPromise;

      const info = agent.getInfo();
      expect(info.state).toBe("running");
      expect(info.startedAt).toBeDefined();
    });

    it("should stop agent successfully", async () => {
      await agent.start();
      expect(agent.getInfo().state).toBe("running");

      const stopPromise = agent.stop();
      expect(agent.getInfo().state).toBe("stopping");

      await stopPromise;
      expect(agent.getInfo().state).toBe("stopped");
    });

    it("should handle start failure", async () => {
      agent.setFailStart(true);

      await expect(agent.start()).rejects.toThrow("Start failed");
      expect(agent.getInfo().state).toBe("error");
    });

    it("should handle stop failure", async () => {
      await agent.start();
      agent.setFailStop(true);

      await expect(agent.stop()).rejects.toThrow("Stop failed");
      expect(agent.getInfo().state).toBe("error");
    });

    it("should not start if already running", async () => {
      await agent.start();

      await expect(agent.start()).rejects.toThrow(
        "Cannot start agent in state: running",
      );
    });

    it("should handle multiple stop calls gracefully", async () => {
      await agent.start();
      await agent.stop();

      // Second stop should not throw
      await expect(agent.stop()).resolves.not.toThrow();
    });
  });

  describe("health monitoring", () => {
    let agent: TestAgent;

    beforeEach(() => {
      agent = new TestAgent(testConfig);
    });

    afterEach(async () => {
      if (agent.getInfo().state === "running") {
        await agent.stop();
      }
    });

    it("should perform health check successfully", async () => {
      const health = await agent.checkHealth();

      expect(health.status).toBe("healthy");
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.message).toBe("All systems operational");
    });

    it("should handle health check failure", async () => {
      agent.setFailHealthCheck(true);

      const health = await agent.checkHealth();

      expect(health.status).toBe("unhealthy");
      expect(health.message).toBe("Health check failed");
    });

    it("should emit events on health status changes", async () => {
      const unhealthyEventSpy = jest.fn();
      agent.on("unhealthy", unhealthyEventSpy);

      agent.setFailHealthCheck(true);
      await agent.checkHealth();

      expect(unhealthyEventSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("event emission", () => {
    let agent: TestAgent;

    beforeEach(() => {
      agent = new TestAgent(testConfig);
    });

    afterEach(async () => {
      if (agent.getInfo().state === "running") {
        await agent.stop();
      }
    });

    it("should emit started event", async () => {
      const startedEventSpy = jest.fn();
      agent.on("started", startedEventSpy);

      await agent.start();

      expect(startedEventSpy).toHaveBeenCalledTimes(1);
    });

    it("should emit stopped event", async () => {
      const stoppedEventSpy = jest.fn();
      agent.on("stopped", stoppedEventSpy);

      await agent.start();
      await agent.stop();

      expect(stoppedEventSpy).toHaveBeenCalledTimes(1);
    });

    it("should emit state change events", async () => {
      const stateChangedEventSpy = jest.fn();
      agent.on("stateChanged", stateChangedEventSpy);

      await agent.start();

      expect(stateChangedEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "stateChanged",
          data: expect.objectContaining({
            oldState: "stopped",
            newState: "starting",
          }),
        }),
      );
    });
  });
});

describe("AgentRegistry", () => {
  let registry: AgentRegistry;
  let agent1: TestAgent;
  let agent2: TestAgent;

  beforeEach(() => {
    registry = new AgentRegistry();

    agent1 = new TestAgent({
      id: "agent-001",
      name: "Agent 1",
      version: "1.0.0",
      enabled: true,
      dependencies: [],
      healthCheckInterval: 1000,
      maxRetries: 3,
      timeout: 5000,
    });

    agent2 = new TestAgent({
      id: "agent-002",
      name: "Agent 2",
      version: "1.0.0",
      enabled: true,
      dependencies: [],
      healthCheckInterval: 1000,
      maxRetries: 3,
      timeout: 5000,
    });
  });

  afterEach(async () => {
    await registry.stopAll();
  });

  describe("registration", () => {
    it("should register agent successfully", () => {
      registry.register(agent1);

      const retrieved = registry.get("agent-001");
      expect(retrieved).toBe(agent1);
    });

    it("should throw error when registering duplicate agent", () => {
      registry.register(agent1);

      expect(() => registry.register(agent1)).toThrow(
        "Agent with ID agent-001 is already registered",
      );
    });

    it("should unregister agent successfully", () => {
      registry.register(agent1);
      registry.unregister("agent-001");

      const retrieved = registry.get("agent-001");
      expect(retrieved).toBeUndefined();
    });

    it("should throw error when unregistering non-existent agent", () => {
      expect(() => registry.unregister("non-existent")).toThrow(
        "Agent with ID non-existent is not registered",
      );
    });
  });

  describe("bulk operations", () => {
    beforeEach(() => {
      registry.register(agent1);
      registry.register(agent2);
    });

    it("should start all agents", async () => {
      await registry.startAll();

      const agents = registry.getAll();
      agents.forEach((agent) => {
        expect(agent.state).toBe("running");
      });
    });

    it("should stop all agents", async () => {
      await registry.startAll();
      await registry.stopAll();

      const agents = registry.getAll();
      agents.forEach((agent) => {
        expect(agent.state).toBe("stopped");
      });
    });

    it("should handle partial start failures", async () => {
      agent1.setFailStart(true);

      await expect(registry.startAll()).rejects.toThrow();

      // Agent 2 should still be stopped since the operation failed
      expect(agent2.getInfo().state).toBe("stopped");
    });

    it("should continue stopping other agents even if one fails", async () => {
      await registry.startAll();
      agent1.setFailStop(true);

      // Should not throw, but should attempt to stop all agents
      await registry.stopAll();

      expect(agent2.getInfo().state).toBe("stopped");
    });
  });

  describe("query operations", () => {
    beforeEach(() => {
      registry.register(agent1);
      registry.register(agent2);
    });

    it("should get all registered agents", () => {
      const agents = registry.getAll();

      expect(agents).toHaveLength(2);
      expect(agents.map((a) => a.id)).toContain("agent-001");
      expect(agents.map((a) => a.id)).toContain("agent-002");
    });

    it("should get specific agent by ID", () => {
      const agent = registry.get("agent-001");

      expect(agent).toBe(agent1);
    });

    it("should return undefined for non-existent agent", () => {
      const agent = registry.get("non-existent");

      expect(agent).toBeUndefined();
    });
  });
});
