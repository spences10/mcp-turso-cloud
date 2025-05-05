/**
 * Database-level tools for the Turso MCP server
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as database_client from '../clients/database.js';
import { ResultSet } from '../common/types.js';
import {
	resolve_database_name,
	set_current_database,
} from './context.js';

/**
 * Register database tools with the server
 */
export function register_database_tools(server: Server): void {
	// Register the list of available tools
	server.setRequestHandler(ListToolsRequestSchema, async () => {
		// Add database tools
		return {
			tools: [
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
					name: 'execute_read_only_query',
					description:
						'Executes a read-only SQL query against a database (e.g., SELECT, PRAGMA)',
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
					name: 'execute_query',
					description:
						'Executes a potentially destructive SQL query against a database (e.g., INSERT, UPDATE, DELETE, CREATE, DROP, ALTER)',
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
		};
	});

	// Handle tool calls
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		try {
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

			// Handle execute_read_only_query tool
			if (request.params.name === 'execute_read_only_query') {
				const {
					query,
					params = {},
					database,
				} = request.params.arguments as {
					query: string;
					params?: Record<string, any>;
					database?: string;
				};

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

			// If it's an organization tool, we'll let it fall through to the organization handler
			// The organization handler is registered after this one, so it will handle these tools

			// If we get here, it's not a recognized tool
			throw new Error(`Unknown tool: ${request.params.name}`);
		} catch (error) {
			console.error('Error executing database tool:', error);
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
 */
function format_query_result(result: ResultSet): any {
	return {
		rows: result.rows,
		rowsAffected: result.rowsAffected,
		lastInsertRowid: result.lastInsertRowid,
		columns: result.columns,
	};
}
