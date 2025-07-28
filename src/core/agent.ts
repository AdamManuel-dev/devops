/**
 * @fileoverview Base agent class and lifecycle management for Mastra framework
 * @lastmodified 2025-07-28T02:40:00Z
 * 
 * Features: Agent lifecycle, health checks, error handling, event emission
 * Main APIs: BaseAgent class, agent registration, health monitoring
 * Constraints: Requires Mastra framework, strict error handling
 * Patterns: Template method, observer pattern, graceful shutdown
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { 
  AgentConfig, 
  AgentState, 
  HealthStatus, 
  HealthCheck, 
  AgentInfo,
  AgentEvent,
  AgentId,
  AgentConfigSchema 
} from '@/types';
import { Logger } from '@/utils/logger';
import { createCorrelationId } from '@/utils/correlation';

export abstract class BaseAgent extends EventEmitter {
  protected readonly config: AgentConfig;
  protected readonly logger: Logger;
  private state: AgentState = 'stopped';
  private healthTimer?: NodeJS.Timeout;
  private startedAt?: Date;
  private lastHealthCheck?: HealthCheck;

  constructor(config: AgentConfig) {
    super();
    
    // Validate configuration
    const validationResult = AgentConfigSchema.safeParse(config);
    if (!validationResult.success) {
      throw new Error(`Invalid agent configuration: ${validationResult.error.message}`);
    }
    
    this.config = config;
    this.logger = new Logger({
      service: `agent-${config.name}`,
      agentId: config.id as AgentId
    });
    
    this.setupEventHandlers();
  }

  /**
   * Start the agent and begin health monitoring
   */
  public async start(): Promise<void> {
    if (this.state !== 'stopped') {
      throw new Error(`Cannot start agent in state: ${this.state}`);
    }

    this.setState('starting');
    this.startedAt = new Date();
    
    try {
      this.logger.info('Starting agent', { agentId: this.config.id });
      
      await this.onStart();
      
      this.setState('running');
      this.startHealthMonitoring();
      
      this.emit('started', this.createEvent('started'));
      this.logger.info('Agent started successfully', { agentId: this.config.id });
      
    } catch (error) {
      this.setState('error');
      this.logger.error('Failed to start agent', { 
        error: error instanceof Error ? error.message : String(error),
        agentId: this.config.id 
      });
      throw error;
    }
  }

  /**
   * Stop the agent gracefully
   */
  public async stop(): Promise<void> {
    if (this.state === 'stopped' || this.state === 'stopping') {
      return;
    }

    this.setState('stopping');
    
    try {
      this.logger.info('Stopping agent', { agentId: this.config.id });
      
      this.stopHealthMonitoring();
      await this.onStop();
      
      this.setState('stopped');
      this.emit('stopped', this.createEvent('stopped'));
      this.logger.info('Agent stopped successfully', { agentId: this.config.id });
      
    } catch (error) {
      this.setState('error');
      this.logger.error('Failed to stop agent gracefully', { 
        error: error instanceof Error ? error.message : String(error),
        agentId: this.config.id 
      });
      throw error;
    }
  }

  /**
   * Get current agent information
   */
  public getInfo(): AgentInfo {
    return {
      id: this.config.id,
      name: this.config.name,
      state: this.state,
      health: this.lastHealthCheck ?? {
        status: 'unknown',
        timestamp: new Date(),
        message: 'No health check performed yet'
      },
      startedAt: this.startedAt,
      lastSeen: new Date(),
      metadata: {
        version: this.config.version,
        dependencies: this.config.dependencies,
        uptime: this.startedAt ? Date.now() - this.startedAt.getTime() : 0
      }
    };
  }

  /**
   * Force a health check
   */
  public async checkHealth(): Promise<HealthCheck> {
    try {
      const health = await this.performHealthCheck();
      this.lastHealthCheck = health;
      
      if (health.status === 'unhealthy') {
        this.emit('unhealthy', this.createEvent('unhealthy', health));
        this.logger.warn('Agent health check failed', { 
          status: health.status,
          message: health.message,
          agentId: this.config.id 
        });
      }
      
      return health;
    } catch (error) {
      const failedHealth: HealthCheck = {
        status: 'unhealthy',
        timestamp: new Date(),
        message: error instanceof Error ? error.message : 'Health check failed',
        details: { error: String(error) }
      };
      
      this.lastHealthCheck = failedHealth;
      this.emit('unhealthy', this.createEvent('unhealthy', failedHealth));
      this.logger.error('Health check threw error', { 
        error: error instanceof Error ? error.message : String(error),
        agentId: this.config.id 
      });
      
      return failedHealth;
    }
  }

  // Abstract methods to be implemented by specific agents
  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected abstract performHealthCheck(): Promise<HealthCheck>;

  // Private methods
  private setState(newState: AgentState): void {
    const oldState = this.state;
    this.state = newState;
    
    this.emit('stateChanged', this.createEvent('stateChanged', {
      oldState,
      newState,
      timestamp: new Date()
    }));
    
    this.logger.debug('Agent state changed', { 
      from: oldState, 
      to: newState,
      agentId: this.config.id 
    });
  }

  private startHealthMonitoring(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
    }
    
    this.healthTimer = setInterval(
      () => this.checkHealth(),
      this.config.healthCheckInterval
    );
    
    // Perform initial health check
    this.checkHealth();
  }

  private stopHealthMonitoring(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = undefined;
    }
  }

  private setupEventHandlers(): void {
    // Handle uncaught errors
    this.on('error', (error: Error) => {
      this.logger.error('Agent error event', { 
        error: error.message,
        stack: error.stack,
        agentId: this.config.id 
      });
      this.setState('error');
    });

    // Log important events
    this.on('started', () => {
      this.logger.info('Agent started event emitted', { agentId: this.config.id });
    });
    
    this.on('stopped', () => {
      this.logger.info('Agent stopped event emitted', { agentId: this.config.id });
    });
  }

  private createEvent(type: string, data: Record<string, unknown> = {}): AgentEvent {
    return {
      type,
      agentId: this.config.id as AgentId,
      timestamp: new Date(),
      data: {
        ...data,
        correlationId: createCorrelationId()
      }
    };
  }
}

/**
 * Agent registry for managing multiple agents
 */
export class AgentRegistry {
  private readonly agents = new Map<string, BaseAgent>();
  private readonly logger = new Logger({ service: 'agent-registry' });

  /**
   * Register a new agent
   */
  public register(agent: BaseAgent): void {
    const info = agent.getInfo();
    
    if (this.agents.has(info.id)) {
      throw new Error(`Agent with ID ${info.id} is already registered`);
    }
    
    this.agents.set(info.id, agent);
    this.logger.info('Agent registered', { 
      agentId: info.id, 
      name: info.name 
    });
    
    // Forward agent events
    agent.on('started', (event) => this.emit('agentStarted', event));
    agent.on('stopped', (event) => this.emit('agentStopped', event));
    agent.on('unhealthy', (event) => this.emit('agentUnhealthy', event));
  }

  /**
   * Unregister an agent
   */
  public unregister(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} is not registered`);
    }
    
    this.agents.delete(agentId);
    this.logger.info('Agent unregistered', { agentId });
  }

  /**
   * Get agent by ID
   */
  public get(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  public getAll(): AgentInfo[] {
    return Array.from(this.agents.values()).map(agent => agent.getInfo());
  }

  /**
   * Start all agents
   */
  public async startAll(): Promise<void> {
    const startPromises = Array.from(this.agents.values()).map(agent => 
      agent.start().catch(error => {
        this.logger.error('Failed to start agent', { 
          agentId: agent.getInfo().id,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      })
    );
    
    await Promise.all(startPromises);
    this.logger.info('All agents started', { count: this.agents.size });
  }

  /**
   * Stop all agents gracefully
   */
  public async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.agents.values()).map(agent => 
      agent.stop().catch(error => {
        this.logger.error('Failed to stop agent', { 
          agentId: agent.getInfo().id,
          error: error instanceof Error ? error.message : String(error)
        });
        // Don't throw - we want to attempt to stop all agents
      })
    );
    
    await Promise.all(stopPromises);
    this.logger.info('All agents stopped', { count: this.agents.size });
  }

  private emit(event: string, data: unknown): void {
    // Registry event emission would go here
    this.logger.debug('Registry event', { event, data });
  }
}