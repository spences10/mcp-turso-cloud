/**
 * Turso Database HTTP API client for database-level operations
 */
import { Client, createClient, ResultSet } from '@libsql/client';
import { TursoApiError } from '../common/errors.js';
import { get_config } from '../config.js';
import { get_database_token } from './token-manager.js';

// Cache of database clients
const client_cache: Record<string, Client> = {};

/**
 * Get a client for a specific database, creating one if necessary
 */
export async function get_database_client(
	database_name: string,
	permission: 'full-access' | 'read-only' = 'full-access',
): Promise<Client> {
	// Check if we have a cached client
	const cache_key = `${database_name}:${permission}`;
	if (client_cache[cache_key]) {
		return client_cache[cache_key];
	}

	try {
		// Get a token for the database
		const token = await get_database_token(database_name, permission);

		// Get the organization name from config
		const config = get_config();
		const organization = config.TURSO_ORGANIZATION;

		// Create a new client with the correct hostname format
		const client = createClient({
			url: `https://${database_name}-${organization}.turso.io`,
			authToken: token,
		});

		// Cache the client
		client_cache[cache_key] = client;

		return client;
	} catch (error) {
		if (error instanceof TursoApiError) {
			throw error;
		}
		throw new TursoApiError(
			`Failed to create client for database ${database_name}: ${
				(error as Error).message
			}`,
			500,
		);
	}
}

/**
 * List all tables in a database
 */
export async function list_tables(
	database_name: string,
): Promise<string[]> {
	try {
		const client = await get_database_client(
			database_name,
			'read-only',
		);

		// Query the sqlite_schema table to get all tables
		const result = await client.execute({
			sql: `SELECT name FROM sqlite_schema 
            WHERE type = 'table' 
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name`,
		});

		// Extract table names from the result
		return result.rows.map((row) => row.name as string);
	} catch (error) {
		throw new TursoApiError(
			`Failed to list tables for database ${database_name}: ${
				(error as Error).message
			}`,
			500,
		);
	}
}

/**
 * Execute a SQL query against a database
 */
export async function execute_query(
	database_name: string,
	query: string,
	params: Record<string, any> = {},
): Promise<ResultSet> {
	try {
		// Determine if this is a read-only query
		const is_read_only = query
			.trim()
			.toLowerCase()
			.startsWith('select');
		const permission = is_read_only ? 'read-only' : 'full-access';

		const client = await get_database_client(
			database_name,
			permission,
		);

		// Execute the query
		return await client.execute({
			sql: query,
			args: params,
		});
	} catch (error) {
		throw new TursoApiError(
			`Failed to execute query for database ${database_name}: ${
				(error as Error).message
			}`,
			500,
		);
	}
}

/**
 * Get schema information for a table
 */
export async function describe_table(
	database_name: string,
	table_name: string,
): Promise<
	{
		name: string;
		type: string;
		notnull: number;
		dflt_value: string | null;
		pk: number;
	}[]
> {
	try {
		const client = await get_database_client(
			database_name,
			'read-only',
		);

		// Query the table info
		const result = await client.execute({
			sql: `PRAGMA table_info(${table_name})`,
		});

		// Return the column definitions
		return result.rows.map((row) => ({
			name: row.name as string,
			type: row.type as string,
			notnull: row.notnull as number,
			dflt_value: row.dflt_value as string | null,
			pk: row.pk as number,
		}));
	} catch (error) {
		throw new TursoApiError(
			`Failed to describe table ${table_name} for database ${database_name}: ${
				(error as Error).message
			}`,
			500,
		);
	}
}
