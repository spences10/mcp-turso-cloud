import * as database_client from '../clients/database.js';
import {
	create_tool_error_response,
	create_tool_response,
	format_query_result,
} from '../common/responses.js';
import type { TursoMcpServer } from '../mcp-server.js';
import {
	resolve_database_name,
	set_current_database,
} from './context.js';
import { query_schema, read_query_schema } from './schemas.js';

export function register_query_tools(server: TursoMcpServer): void {
	server.tool(
		{
			name: 'execute_read_only_query',
			description:
				'Execute one read-only SELECT, WITH, EXPLAIN of a read, or metadata PRAGMA using read-only credentials. Results are bounded and paginated.',
			schema: read_query_schema,
		},
		async ({
			query,
			params = {},
			database,
			limit = 1000,
			offset = 0,
		}) => {
			try {
				const database_name = resolve_database_name(database);
				const result = await database_client.execute_read_only_query(
					database_name,
					query,
					params,
					limit,
					offset,
				);
				if (database) set_current_database(database);
				const formatted = format_query_result(result, limit);
				return create_tool_response({
					database: database_name,
					query,
					result: formatted,
					pagination: {
						limit,
						offset,
						returned_count: formatted.returned_count,
						has_more: formatted.truncated,
						next_offset:
							formatted.truncated && formatted.returned_count > 0
								? offset + formatted.returned_count
								: null,
					},
				});
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);
	server.tool(
		{
			name: 'execute_query',
			description:
				'DESTRUCTIVE: Execute one data/schema write or mutating PRAGMA using full-access credentials. Confirm with the user first. Returned rows are bounded; truncation does not undo writes.',
			schema: query_schema,
		},
		async ({ query, params = {}, database }) => {
			try {
				const database_name = resolve_database_name(database);
				const result = await database_client.execute_query(
					database_name,
					query,
					params,
				);
				if (database) set_current_database(database);
				return create_tool_response({
					database: database_name,
					query,
					result: format_query_result(result),
				});
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);
}
