/**
 * Unified tool handler for the Turso MCP server
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as database_client from '../clients/database.js';
import * as organization_client from '../clients/organization.js';
import { ResultSet } from '../common/types.js';
import {
	resolve_database_name,
	set_current_database,
} from './context.js';

/**
 * Register all tools with the server
 */
export function register_tools(server: Server): void {
	// Register the list of available tools
	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: [
			// Organization tools
			{
				name: 'list_databases',
				description: 'List all databases in your Turso organization',
				inputSchema: {
					type: 'object',
					properties: {},
					required: [],
				},
			},
			{
				name: 'create_database',
				description:
					'Create a new database in your Turso organization',
				inputSchema: {
					type: 'object',
					properties: {
						name: {
							type: 'string',
							description: 'Name of the database to create',
						},
						group: {
							type: 'string',
							description: 'Optional group name for the database',
						},
						regions: {
							type: 'array',
							items: {
								type: 'string',
							},
							description:
								'Optional list of regions to deploy the database to',
						},
					},
					required: ['name'],
				},
			},
			{
				name: 'delete_database',
				description: 'Delete a database from your Turso organization',
				inputSchema: {
					type: 'object',
					properties: {
						name: {
							type: 'string',
							description: 'Name of the database to delete',
						},
					},
					required: ['name'],
				},
			},
			{
				name: 'generate_database_token',
				description: 'Generate a new token for a specific database',
				inputSchema: {
					type: 'object',
					properties: {
						database: {
							type: 'string',
							description:
								'Name of the database to generate a token for',
						},
						permission: {
							type: 'string',
							enum: ['full-access', 'read-only'],
							description: 'Permission level for the token',
						},
					},
					required: ['database'],
				},
			},

			// Database tools
			{
				name: 'list_tables',
				description: 'Lists all tables in a database',
				inputSchema: {
					type: 'object',
					properties: {
						database: {
							type: 'string',
							description:
								'Database name (optional, uses context if not provided)',
						},
					},
					required: [],
				},
			},
			{
				name: 'execute_query',
				description: 'Executes a SQL query against a database',
				inputSchema: {
					type: 'object',
					properties: {
						query: {
							type: 'string',
							description: 'SQL query to execute',
						},
						params: {
							type: 'object',
							description: 'Query parameters (optional)',
						},
						database: {
							type: 'string',
							description:
								'Database name (optional, uses context if not provided)',
						},
					},
					required: ['query'],
				},
			},
			{
				name: 'describe_table',
				description: 'Gets schema information for a table',
				inputSchema: {
					type: 'object',
					properties: {
						table: {
							type: 'string',
							description: 'Table name',
						},
						database: {
							type: 'string',
							description:
								'Database name (optional, uses context if not provided)',
						},
					},
					required: ['table'],
				},
			},
			{
				name: 'vector_search',
				description: 'Performs vector similarity search',
				inputSchema: {
					type: 'object',
					properties: {
						table: {
							type: 'string',
							description: 'Table name',
						},
						vector_column: {
							type: 'string',
							description: 'Column containing vectors',
						},
						query_vector: {
							type: 'array',
							items: {
								type: 'number',
							},
							description: 'Query vector for similarity search',
						},
						limit: {
							type: 'number',
							description:
								'Maximum number of results (optional, default 10)',
						},
						database: {
							type: 'string',
							description:
								'Database name (optional, uses context if not provided)',
						},
					},
					required: ['table', 'vector_column', 'query_vector'],
				},
			},
		],
	}));

	// Register the unified tool handler
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		try {
			// Organization tools

			// Handle list_databases tool
			if (request.params.name === 'list_databases') {
				const databases = await organization_client.list_databases();

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ databases }, null, 2),
						},
					],
				};
			}

			// Handle create_database tool
			if (request.params.name === 'create_database') {
				const { name, group, regions } = request.params.arguments as {
					name: string;
					group?: string;
					regions?: string[];
				};

				const database = await organization_client.create_database(
					name,
					{
						group,
						regions,
					},
				);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ database }, null, 2),
						},
					],
				};
			}

			// Handle delete_database tool
			if (request.params.name === 'delete_database') {
				const { name } = request.params.arguments as { name: string };

				await organization_client.delete_database(name);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									success: true,
									message: `Database '${name}' deleted successfully`,
								},
								null,
								2,
							),
						},
					],
				};
			}

			// Handle generate_database_token tool
			if (request.params.name === 'generate_database_token') {
				const { database, permission = 'full-access' } = request
					.params.arguments as {
					database: string;
					permission?: 'full-access' | 'read-only';
				};

				const jwt = await organization_client.generate_database_token(
					database,
					permission,
				);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									success: true,
									database,
									token: {
										jwt,
										permission,
										database,
									},
									message: `Token generated successfully for database '${database}' with '${permission}' permissions`,
								},
								null,
								2,
							),
						},
					],
				};
			}

			// Database tools

			// Handle list_tables tool
			if (request.params.name === 'list_tables') {
				const { database } = request.params.arguments as {
					database?: string;
				};

				const database_name = resolve_database_name(database);

				// Update context if database is explicitly provided
				if (database) {
					set_current_database(database);
				}

				const tables = await database_client.list_tables(
					database_name,
				);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									database: database_name,
									tables,
								},
								null,
								2,
							),
						},
					],
				};
			}

			// Handle execute_query tool
			if (request.params.name === 'execute_query') {
				const {
					query,
					params = {},
					database,
				} = request.params.arguments as {
					query: string;
					params?: Record<string, any>;
					database?: string;
				};

				const database_name = resolve_database_name(database);

				// Update context if database is explicitly provided
				if (database) {
					set_current_database(database);
				}

				const result = await database_client.execute_query(
					database_name,
					query,
					params,
				);

				// Format the result for better readability
				const formatted_result = format_query_result(result);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									database: database_name,
									query,
									result: formatted_result,
								},
								null,
								2,
							),
						},
					],
				};
			}

			// Handle describe_table tool
			if (request.params.name === 'describe_table') {
				const { table, database } = request.params.arguments as {
					table: string;
					database?: string;
				};

				const database_name = resolve_database_name(database);

				// Update context if database is explicitly provided
				if (database) {
					set_current_database(database);
				}

				const columns = await database_client.describe_table(
					database_name,
					table,
				);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									database: database_name,
									table,
									columns: columns.map((col) => ({
										name: col.name,
										type: col.type,
										nullable: col.notnull === 0,
										default_value: col.dflt_value,
										primary_key: col.pk === 1,
									})),
								},
								null,
								2,
							),
						},
					],
				};
			}

			// Handle vector_search tool
			if (request.params.name === 'vector_search') {
				const {
					table,
					vector_column,
					query_vector,
					limit = 10,
					database,
				} = request.params.arguments as {
					table: string;
					vector_column: string;
					query_vector: number[];
					limit?: number;
					database?: string;
				};

				const database_name = resolve_database_name(database);

				// Update context if database is explicitly provided
				if (database) {
					set_current_database(database);
				}

				// Construct a vector search query using SQLite's vector functions
				// This assumes the vector column is stored in a format compatible with SQLite's vector1 extension
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

				// Format the result for better readability
				const formatted_result = format_query_result(result);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									database: database_name,
									table,
									vector_column,
									query_vector,
									results: formatted_result,
								},
								null,
								2,
							),
						},
					],
				};
			}

			// If we get here, it's not a recognized tool
			throw new Error(`Unknown tool: ${request.params.name}`);
		} catch (error) {
			console.error('Error executing tool:', error);
			return {
				content: [
					{
						type: 'text',
						text: `Error: ${(error as Error).message}`,
					},
				],
				isError: true,
			};
		}
	});
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
