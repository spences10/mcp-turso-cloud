/**
 * Context management for the Turso MCP server
 */
import { DatabaseContext } from '../common/types.js';
import { getConfig } from '../config.js';

// Global context object
const context: DatabaseContext = {
  currentDatabase: undefined,
};

/**
 * Set the current database context
 */
export function setCurrentDatabase(databaseName: string | undefined): void {
  context.currentDatabase = databaseName;
}

/**
 * Get the current database context
 * If no database is set, use the default from config
 */
export function getCurrentDatabase(): string | undefined {
  return context.currentDatabase || getConfig().TURSO_DEFAULT_DATABASE;
}

/**
 * Resolve a database name from the context
 * If a database name is provided, use it
 * Otherwise, use the current database from context
 * Throws an error if no database is available
 */
export function resolveDatabaseName(providedName?: string): string {
  const databaseName = providedName || getCurrentDatabase();
  
  if (!databaseName) {
    throw new Error(
      'No database specified. Please provide a database name or set a default database.'
    );
  }
  
  return databaseName;
}
