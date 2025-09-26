/**
 * Unified tool handler for the Turso MCP server
 */
import { McpServer } from 'tmcp';
import { z } from 'zod';
import * as database_client from '../clients/database.js';
import * as organization_client from '../clients/organization.js';
import { ResultSet } from '../common/types.js';
import {
	resolve_database_name,
	set_current_database,
} from './context.js';

// Zod schemas for tool inputs
const EmptySchema = z.object({});

const CreateDatabaseSchema = z.object({
	name: z.string().describe('Name of the database to create - Must be unique within organization'),
	group: z.string().optional().describe('Optional group name for the database (defaults to "default")'),
	regions: z.array(z.string()).optional().describe('Optional list of regions to deploy the database to (affects latency and compliance)'),
});

const DeleteDatabaseSchema = z.object({
	name: z.string().describe('Name of the database to permanently delete - WARNING: ALL DATA WILL BE LOST FOREVER'),
});

const GenerateDatabaseTokenSchema = z.object({
	database: z.string().describe('Name of the database to generate a token for'),
	permission: z.enum(['full-access', 'read-only']).optional().describe('Permission level for the token'),
});

const DatabaseOnlySchema = z.object({
	database: z.string().optional().describe('Database name (optional, uses context if not provided)'),
});

const QuerySchema = z.object({
	query: z.string().describe('SQL query to execute'),
	params: z.record(z.string(), z.any()).optional().describe('Query parameters (optional) - Use parameterized queries for security'),
	database: z.string().optional().describe('Database name (optional, uses context if not provided)'),
});

const ReadOnlyQuerySchema = z.object({
	query: z.string().describe('Read-only SQL query to execute (SELECT, PRAGMA, EXPLAIN only)'),
	params: z.record(z.string(), z.any()).optional().describe('Query parameters (optional) - Use parameterized queries for security'),
	database: z.string().optional().describe('Database name (optional, uses context if not provided) - Specify target database'),
});

const DescribeTableSchema = z.object({
	table: z.string().describe('Table name'),
	database: z.string().optional().describe('Database name (optional, uses context if not provided)'),
});

const VectorSearchSchema = z.object({
	table: z.string().describe('Table name'),
	vector_column: z.string().describe('Column containing vectors'),
	query_vector: z.array(z.number()).describe('Query vector for similarity search'),
	limit: z.number().optional().describe('Maximum number of results (optional, default 10)'),
	database: z.string().optional().describe('Database name (optional, uses context if not provided)'),
});

/**
 * Create a tool error response
 */
function create_tool_error_response(error: unknown) {
	return {
		content: [
			{
				type: 'text' as const,
				text: JSON.stringify(
					{
						error: 'internal_error',
						message:
							error instanceof Error
								? error.message
								: 'Unknown error',
					},
					null,
					2,
				),
			},
		],
		isError: true,
	};
}

/**
 * Create a tool success response
 */
function create_tool_response(data: any) {
	return {
		content: [
			{
				type: 'text' as const,
				text: JSON.stringify(data, null, 2),
			},
		],
	};
}

/**
 * Register all tools with the server
 */
export function register_tools(server: McpServer<any>): void {
	// Organization tools
	server.tool(
		{
			name: 'list_databases',
			description: 'List all databases in your Turso organization',
			schema: EmptySchema,
		},
		async () => {
			try {
				const databases = await organization_client.list_databases();
				return create_tool_response({ databases });
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);

	server.tool(
		{
			name: 'create_database',
			description: `✓ SAFE: Create a new database in your Turso organization. Database name must be unique.`,
			schema: CreateDatabaseSchema,
		},
		async ({ name, group, regions }) => {
			try {
				const database = await organization_client.create_database(
					name,
					{ group, regions },
				);
				return create_tool_response({ database });
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);

	server.tool(
		{
			name: 'delete_database',
			description: `⚠️ DESTRUCTIVE: Permanently deletes a database and ALL its data. Cannot be undone. Always confirm with user before proceeding and verify correct database name.`,
			schema: DeleteDatabaseSchema,
		},
		async ({ name }) => {
			try {
				await organization_client.delete_database(name);
				return create_tool_response({
					success: true,
					message: `Database '${name}' deleted successfully`,
				});
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);

	server.tool(
		{
			name: 'generate_database_token',
			description: 'Generate a new token for a specific database',
			schema: GenerateDatabaseTokenSchema,
		},
		async ({ database, permission = 'full-access' }) => {
			try {
				const jwt = await organization_client.generate_database_token(
					database,
					permission,
				);
				return create_tool_response({
					success: true,
					database,
					token: { jwt, permission, database },
					message: `Token generated successfully for database '${database}' with '${permission}' permissions`,
				});
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);

	// Database tools
	server.tool(
		{
			name: 'list_tables',
			description: 'Lists all tables in a database',
			schema: DatabaseOnlySchema,
		},
		async ({ database }) => {
			try {
				const database_name = resolve_database_name(database);
				if (database) set_current_database(database);

				const tables = await database_client.list_tables(database_name);
				return create_tool_response({ database: database_name, tables });
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);

	server.tool(
		{
			name: 'execute_read_only_query',
			description: `✓ SAFE: Execute read-only SQL queries (SELECT, PRAGMA, EXPLAIN). Automatically rejects write operations.`,
			schema: ReadOnlyQuerySchema,
		},
		async ({ query, params = {}, database }) => {
			try {
				// Validate that this is a read-only query
				const normalized_query = query.trim().toLowerCase();
				if (
					!normalized_query.startsWith('select') &&
					!normalized_query.startsWith('pragma')
				) {
					throw new Error(
						'Only SELECT and PRAGMA queries are allowed with execute_read_only_query',
					);
				}

				const database_name = resolve_database_name(database);
				if (database) set_current_database(database);

				const result = await database_client.execute_query(
					database_name,
					query,
					params,
				);

				const formatted_result = format_query_result(result);
				return create_tool_response({
					database: database_name,
					query,
					result: formatted_result,
				});
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);

	server.tool(
		{
			name: 'execute_query',
			description: `⚠️ DESTRUCTIVE: Execute SQL that can modify/delete data (INSERT, UPDATE, DELETE, DROP, ALTER). Always confirm with user before destructive operations.`,
			schema: QuerySchema,
		},
		async ({ query, params = {}, database }) => {
			try {
				// Validate that this is not a read-only query
				const normalized_query = query.trim().toLowerCase();
				if (
					normalized_query.startsWith('select') ||
					normalized_query.startsWith('pragma')
				) {
					throw new Error(
						'SELECT and PRAGMA queries should use execute_read_only_query',
					);
				}

				const database_name = resolve_database_name(database);
				if (database) set_current_database(database);

				const result = await database_client.execute_query(
					database_name,
					query,
					params,
				);

				const formatted_result = format_query_result(result);
				return create_tool_response({
					database: database_name,
					query,
					result: formatted_result,
				});
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);

	server.tool(
		{
			name: 'describe_table',
			description: 'Gets schema information for a table',
			schema: DescribeTableSchema,
		},
		async ({ table, database }) => {
			try {
				const database_name = resolve_database_name(database);
				if (database) set_current_database(database);

				const columns = await database_client.describe_table(
					database_name,
					table,
				);

				return create_tool_response({
					database: database_name,
					table,
					columns: columns.map((col) => ({
						name: col.name,
						type: col.type,
						nullable: col.notnull === 0,
						default_value: col.dflt_value,
						primary_key: col.pk === 1,
					})),
				});
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);

	server.tool(
		{
			name: 'vector_search',
			description: 'Performs vector similarity search',
			schema: VectorSearchSchema,
		},
		async ({ table, vector_column, query_vector, limit = 10, database }) => {
			try {
				const database_name = resolve_database_name(database);
				if (database) set_current_database(database);

				// Construct a vector search query using SQLite's vector functions
				const vector_string = query_vector.join(',');
				const query = `
          SELECT *, vector_distance(${vector_column}, vector_from_json(?)) as distance
          FROM ${table}
          ORDER BY distance ASC
          LIMIT ?
        `;

				const params = {
					1: `[${vector_string}]`,
					2: limit,
				};

				const result = await database_client.execute_query(
					database_name,
					query,
					params,
				);

				const formatted_result = format_query_result(result);
				return create_tool_response({
					database: database_name,
					table,
					vector_column,
					query_vector,
					results: formatted_result,
				});
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);
}

/**
 * Format a query result for better readability
 * Handles BigInt serialization
 */
function format_query_result(result: ResultSet): any {
	// Convert BigInt to string to avoid serialization issues
	const lastInsertRowid =
		result.lastInsertRowid !== null &&
		typeof result.lastInsertRowid === 'bigint'
			? result.lastInsertRowid.toString()
			: result.lastInsertRowid;

	return {
		rows: result.rows,
		rowsAffected: result.rowsAffected,
		lastInsertRowid: lastInsertRowid,
		columns: result.columns,
	};
}
