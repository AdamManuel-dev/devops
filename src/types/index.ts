/**
 * @fileoverview Core type definitions for IntelliOps AI Agent
 * @lastmodified 2025-07-28T02:35:00Z
 * 
 * Features: Type definitions, interfaces, enums for agent system
 * Main APIs: Agent types, configuration interfaces, data models
 * Constraints: TypeScript strict mode, comprehensive typing
 * Patterns: Zod validation, discriminated unions, branded types
 */

import { z } from 'zod';

// Agent Configuration Types
export interface AgentConfig {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly dependencies: readonly string[];
  readonly healthCheckInterval: number;
  readonly maxRetries: number;
  readonly timeout: number;
}

// Health Check Types
export const HealthStatus = z.enum(['healthy', 'unhealthy', 'degraded', 'unknown']);
export type HealthStatus = z.infer<typeof HealthStatus>;

export interface HealthCheck {
  readonly status: HealthStatus;
  readonly timestamp: Date;
  readonly message?: string;
  readonly details?: Record<string, unknown>;
}

// Agent Lifecycle Types
export const AgentState = z.enum(['starting', 'running', 'stopping', 'stopped', 'error']);
export type AgentState = z.infer<typeof AgentState>;

export interface AgentInfo {
  readonly id: string;
  readonly name: string;
  readonly state: AgentState;
  readonly health: HealthCheck;
  readonly startedAt?: Date;
  readonly lastSeen: Date;
  readonly metadata: Record<string, unknown>;
}

// Error Types
export const Severity = z.enum(['P1', 'P2', 'P3', 'P4', 'P5']);
export type Severity = z.infer<typeof Severity>;

export const Category = z.enum([
  'Infrastructure',
  'Application', 
  'Security',
  'Database',
  'Integration'
]);
export type Category = z.infer<typeof Category>;

export interface ErrorRecord {
  readonly id: string;
  readonly timestamp: Date;
  readonly service: string;
  readonly environment: string;
  readonly severity: Severity;
  readonly category: readonly Category[];
  readonly message: string;
  readonly stackTrace?: string;
  readonly contextData: Record<string, unknown>;
  readonly embedding?: readonly number[];
  readonly clusterId?: string;
  readonly rootCauseAnalysis?: RootCauseAnalysis;
  readonly suggestedSolutions?: readonly Solution[];
  readonly metadata: ErrorMetadata;
}

export interface RootCauseAnalysis {
  readonly hypothesis: string;
  readonly confidence: number;
  readonly relatedCode?: CodeAnalysis;
  readonly evidence: readonly string[];
}

export interface CodeAnalysis {
  readonly filePath: string;
  readonly lineNumber: number;
  readonly context: string;
  readonly complexity: number;
  readonly recentChanges: readonly string[];
  readonly authors: readonly string[];
}

export interface Solution {
  readonly id: string;
  readonly description: string;
  readonly steps: readonly string[];
  readonly automationScript?: string;
  readonly successRate: number;
  readonly averageResolutionTime: number;
  readonly prerequisites: readonly string[];
  readonly risks: readonly string[];
  readonly lastUsed: Date;
  readonly feedback: SolutionFeedback;
}

export interface SolutionFeedback {
  readonly helpful: number;
  readonly notHelpful: number;
  readonly comments: readonly string[];
}

export interface ErrorMetadata {
  readonly source: string;
  readonly ingestionTime: Date;
  readonly processingTime: number;
  readonly correlationId: string;
}

// Configuration Validation Schemas
export const AgentConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  enabled: z.boolean(),
  dependencies: z.array(z.string()),
  healthCheckInterval: z.number().positive(),
  maxRetries: z.number().nonnegative(),
  timeout: z.number().positive()
});

export const ErrorRecordSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.date(),
  service: z.string().min(1),
  environment: z.string().min(1),
  severity: Severity,
  category: z.array(Category),
  message: z.string().min(1),
  stackTrace: z.string().optional(),
  contextData: z.record(z.unknown()),
  embedding: z.array(z.number()).optional(),
  clusterId: z.string().optional(),
  metadata: z.object({
    source: z.string(),
    ingestionTime: z.date(),
    processingTime: z.number().nonnegative(),
    correlationId: z.string().uuid()
  })
});

// Utility Types
export type Brand<T, K> = T & { readonly __brand: K };
export type AgentId = Brand<string, 'AgentId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;
export type EmbeddingVector = Brand<readonly number[], 'EmbeddingVector'>;

// Event Types
export interface AgentEvent {
  readonly type: string;
  readonly agentId: AgentId;
  readonly timestamp: Date;
  readonly data: Record<string, unknown>;
}

export interface LogEvent {
  readonly timestamp: Date;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly message: string;
  readonly context: Record<string, unknown>;
  readonly correlationId: CorrelationId;
}

// API Response Types
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
  readonly timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly hasNext: boolean;
    readonly hasPrev: boolean;
  };
}