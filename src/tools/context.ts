/**
 * Context management for the Turso MCP server
 */
import { DatabaseContext } from '../common/types.js';
import { get_config } from '../config.js';

// Global context object
const context: DatabaseContext = {
	currentDatabase: undefined,
};

/**
 * Set the current database context
 */
export function set_current_database(
	database_name: string | undefined,
): void {
	context.currentDatabase = database_name;
}

/**
 * Get the current database context
 * If no database is set, use the default from config
 */
export function get_current_database(): string | undefined {
	return (
		context.currentDatabase || get_config().TURSO_DEFAULT_DATABASE
	);
}

/**
 * Resolve a database name from the context
 * If a database name is provided, use it
 * Otherwise, use the current database from context
 * Throws an error if no database is available
 */
export function resolve_database_name(
	provided_name?: string,
): string {
	const database_name = provided_name || get_current_database();

	if (!database_name) {
		throw new Error(
			'No database specified. Please provide a database name or set a default database.',
		);
	}

	return database_name;
}
