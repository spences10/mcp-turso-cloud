/**
 * Error handling utilities for the Turso MCP server
 */
import {
	ErrorCode,
	McpError,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Custom error class for Turso API errors
 */
export class TursoApiError extends Error {
	status_code: number;

	constructor(message: string, status_code: number) {
		super(message);
		this.name = 'TursoApiError';
		this.status_code = status_code;
	}
}

/**
 * Convert various error types to MCP errors
 */
export function handle_error(error: unknown): McpError {
	if (error instanceof McpError) {
		return error;
	}

	if (error instanceof TursoApiError) {
		// Map HTTP status codes to appropriate MCP error codes
		if (error.status_code === 401 || error.status_code === 403) {
			return new McpError(
				ErrorCode.InvalidParams,
				`Authentication error: ${error.message}`,
			);
		} else if (error.status_code === 404) {
			return new McpError(
				ErrorCode.InvalidRequest,
				`Not found: ${error.message}`,
			);
		} else if (error.status_code >= 400 && error.status_code < 500) {
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
		'An unknown error occurred',
	);
}
