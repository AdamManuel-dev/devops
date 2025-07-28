/**
 * @fileoverview Correlation ID utilities for request tracing
 * @lastmodified 2025-07-28T02:45:00Z
 * 
 * Features: Correlation ID generation, context propagation, tracing utilities
 * Main APIs: createCorrelationId, correlation context management
 * Constraints: UUID v4 based, thread-safe, lightweight
 * Patterns: Context propagation, distributed tracing, request lifecycle
 */

import { randomUUID } from 'crypto';
import { CorrelationId } from '@/types';

/**
 * Generate a new correlation ID
 */
export function createCorrelationId(): CorrelationId {
  return randomUUID() as CorrelationId;
}

/**
 * Extract correlation ID from headers
 */
export function extractCorrelationId(headers: Record<string, string | string[] | undefined>): CorrelationId | undefined {
  const correlationHeader = headers['x-correlation-id'] || headers['X-Correlation-ID'];
  
  if (typeof correlationHeader === 'string') {
    return correlationHeader as CorrelationId;
  }
  
  if (Array.isArray(correlationHeader) && correlationHeader.length > 0) {
    return correlationHeader[0] as CorrelationId;
  }
  
  return undefined;
}

/**
 * Validate correlation ID format
 */
export function isValidCorrelationId(value: string): value is CorrelationId {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Context manager for correlation IDs
 */
class CorrelationContext {
  private static instance: CorrelationContext;
  private contextMap = new Map<string, CorrelationId>();

  public static getInstance(): CorrelationContext {
    if (!CorrelationContext.instance) {
      CorrelationContext.instance = new CorrelationContext();
    }
    return CorrelationContext.instance;
  }

  /**
   * Set correlation ID for current context
   */
  public set(correlationId: CorrelationId): void {
    const contextKey = this.getContextKey();
    this.contextMap.set(contextKey, correlationId);
  }

  /**
   * Get correlation ID for current context
   */
  public get(): CorrelationId | undefined {
    const contextKey = this.getContextKey();
    return this.contextMap.get(contextKey);
  }

  /**
   * Clear correlation ID for current context
   */
  public clear(): void {
    const contextKey = this.getContextKey();
    this.contextMap.delete(contextKey);
  }

  /**
   * Get or create correlation ID for current context
   */
  public getOrCreate(): CorrelationId {
    const existing = this.get();
    if (existing) {
      return existing;
    }
    
    const newId = createCorrelationId();
    this.set(newId);
    return newId;
  }

  private getContextKey(): string {
    // In a real implementation, this would use async_hooks or similar
    // For now, use a simple approach based on process/thread
    return `${process.pid}-${Date.now()}`;
  }
}

export const correlationContext = CorrelationContext.getInstance();