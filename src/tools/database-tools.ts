import * as database_client from '../clients/database.js';
import {
	create_tool_error_response,
	create_tool_response,
	format_query_result,
} from '../common/responses.js';
import { quote_identifier } from '../common/sql.js';
import type { TursoMcpServer } from '../mcp-server.js';
import {
	resolve_database_name,
	set_current_database,
} from './context.js';
import {
	database_list_schema,
	describe_table_schema,
	vector_search_schema,
} from './schemas.js';

export function register_database_tools(
	server: TursoMcpServer,
): void {
	server.tool(
		{
			name: 'list_tables',
			description: 'List tables in a database with pagination.',
			schema: database_list_schema,
		},
		async ({ database, limit = 1000, offset = 0 }) => {
			try {
				const database_name = resolve_database_name(database);
				const tables = await database_client.list_tables(
					database_name,
					limit,
					offset,
				);
				if (database) set_current_database(database);
				const has_more = tables.length > limit;
				return create_tool_response({
					database: database_name,
					tables: tables.slice(0, limit),
					pagination: {
						limit,
						offset,
						returned_count: Math.min(tables.length, limit),
						has_more,
						next_offset: has_more ? offset + limit : null,
					},
				});
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);
	server.tool(
		{
			name: 'describe_table',
			description:
				'Get column metadata for a table using read-only credentials.',
			schema: describe_table_schema,
		},
		async ({ table, database }) => {
			try {
				const database_name = resolve_database_name(database);
				const columns = await database_client.describe_table(
					database_name,
					table,
				);
				if (database) set_current_database(database);
				return create_tool_response({
					database: database_name,
					table,
					columns: columns.map((column) => ({
						name: column.name,
						type: column.type,
						nullable: column.notnull === 0,
						default_value: column.dflt_value,
						primary_key: column.pk === 1,
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
			description:
				'Search vector similarity with quoted identifiers, bound values, and read-only credentials.',
			schema: vector_search_schema,
		},
		async ({
			table,
			vector_column,
			query_vector,
			limit = 10,
			database,
		}) => {
			try {
				const database_name = resolve_database_name(database);
				const query = `SELECT *, vector_distance(${quote_identifier(vector_column)}, vector_from_json(?)) AS distance FROM ${quote_identifier(table)} ORDER BY distance ASC LIMIT ?`;
				const result = await database_client.execute_read_only_query(
					database_name,
					query,
					{ 1: JSON.stringify(query_vector), 2: limit },
					limit,
				);
				if (database) set_current_database(database);
				return create_tool_response({
					database: database_name,
					table,
					vector_column,
					query_vector,
					results: format_query_result(result, limit),
				});
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);
}
