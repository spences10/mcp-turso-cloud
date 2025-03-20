/**
 * Turso Database HTTP API client for database-level operations
 */
import { createClient, Client, ResultSet } from '@libsql/client';
import { getDatabaseToken } from './token-manager.js';
import { TursoApiError } from '../common/errors.js';

// Cache of database clients
const clientCache: Record<string, Client> = {};

/**
 * Get a client for a specific database, creating one if necessary
 */
export async function getDatabaseClient(
  databaseName: string,
  permission: 'full-access' | 'read-only' = 'full-access'
): Promise<Client> {
  // Check if we have a cached client
  const cacheKey = `${databaseName}:${permission}`;
  if (clientCache[cacheKey]) {
    return clientCache[cacheKey];
  }
  
  try {
    // Get a token for the database
    const token = await getDatabaseToken(databaseName, permission);
    
    // Create a new client
    const client = createClient({
      url: `https://${databaseName}.turso.io`,
      authToken: token,
    });
    
    // Cache the client
    clientCache[cacheKey] = client;
    
    return client;
  } catch (error) {
    if (error instanceof TursoApiError) {
      throw error;
    }
    throw new TursoApiError(
      `Failed to create client for database ${databaseName}: ${(error as Error).message}`,
      500
    );
  }
}

/**
 * List all tables in a database
 */
export async function listTables(databaseName: string): Promise<string[]> {
  try {
    const client = await getDatabaseClient(databaseName, 'read-only');
    
    // Query the sqlite_schema table to get all tables
    const result = await client.execute({
      sql: `SELECT name FROM sqlite_schema 
            WHERE type = 'table' 
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name`,
    });
    
    // Extract table names from the result
    return result.rows.map(row => row.name as string);
  } catch (error) {
    throw new TursoApiError(
      `Failed to list tables for database ${databaseName}: ${(error as Error).message}`,
      500
    );
  }
}

/**
 * Execute a SQL query against a database
 */
export async function executeQuery(
  databaseName: string,
  query: string,
  params: Record<string, any> = {}
): Promise<ResultSet> {
  try {
    // Determine if this is a read-only query
    const isReadOnly = query.trim().toLowerCase().startsWith('select');
    const permission = isReadOnly ? 'read-only' : 'full-access';
    
    const client = await getDatabaseClient(databaseName, permission);
    
    // Execute the query
    return await client.execute({
      sql: query,
      args: params,
    });
  } catch (error) {
    throw new TursoApiError(
      `Failed to execute query for database ${databaseName}: ${(error as Error).message}`,
      500
    );
  }
}

/**
 * Get schema information for a table
 */
export async function describeTable(
  databaseName: string,
  tableName: string
): Promise<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }[]> {
  try {
    const client = await getDatabaseClient(databaseName, 'read-only');
    
    // Query the table info
    const result = await client.execute({
      sql: `PRAGMA table_info(${tableName})`,
    });
    
    // Return the column definitions
    return result.rows.map(row => ({
      name: row.name as string,
      type: row.type as string,
      notnull: row.notnull as number,
      dflt_value: row.dflt_value as string | null,
      pk: row.pk as number
    }));
  } catch (error) {
    throw new TursoApiError(
      `Failed to describe table ${tableName} for database ${databaseName}: ${(error as Error).message}`,
      500
    );
  }
}
