/**
 * Error handling utilities for the Turso MCP server
 */

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
 * Get error message from various error types
 */
export function get_error_message(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return 'An unknown error occurred';
}
