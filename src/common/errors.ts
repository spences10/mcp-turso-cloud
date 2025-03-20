/**
 * Error handling utilities for the Turso MCP server
 */
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

/**
 * Custom error class for Turso API errors
 */
export class TursoApiError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'TursoApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Convert various error types to MCP errors
 */
export function handleError(error: unknown): McpError {
  if (error instanceof McpError) {
    return error;
  }
  
  if (error instanceof TursoApiError) {
    // Map HTTP status codes to appropriate MCP error codes
    if (error.statusCode === 401 || error.statusCode === 403) {
      return new McpError(ErrorCode.InvalidParams, `Authentication error: ${error.message}`);
    } else if (error.statusCode === 404) {
      return new McpError(ErrorCode.InvalidRequest, `Not found: ${error.message}`);
    } else if (error.statusCode >= 400 && error.statusCode < 500) {
      return new McpError(ErrorCode.InvalidRequest, error.message);
    } else {
      return new McpError(ErrorCode.InternalError, error.message);
    }
  }
  
  if (error instanceof Error) {
    return new McpError(ErrorCode.InternalError, error.message);
  }
  
  return new McpError(
    ErrorCode.InternalError,
    'An unknown error occurred'
  );
}
