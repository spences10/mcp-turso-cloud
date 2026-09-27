import { z } from 'zod';
import * as organization_client from '../clients/organization.js';
import {
	create_tool_error_response,
	create_tool_response,
} from '../common/responses.js';
import type { TursoMcpServer } from '../mcp-server.js';
import { database_name_schema, list_schema } from './schemas.js';

export function register_organization_tools(
	server: TursoMcpServer,
): void {
	server.tool(
		{
			name: 'list_databases',
			description:
				'List databases in your Turso organization with pagination.',
			schema: list_schema,
		},
		async ({ limit = 1000, offset = 0 }) => {
			try {
				const databases = await organization_client.list_databases();
				const page = databases.slice(offset, offset + limit);
				const has_more = offset + page.length < databases.length;
				return create_tool_response({
					databases: page,
					pagination: {
						limit,
						offset,
						returned_count: page.length,
						has_more,
						next_offset: has_more ? offset + page.length : null,
					},
				});
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);
	server.tool(
		{
			name: 'create_database',
			description:
				'Create a Turso database. This changes organization resources and may incur costs.',
			schema: z.object({
				name: database_name_schema,
				group: database_name_schema.optional(),
				regions: z
					.array(z.string().min(1).max(64))
					.max(32)
					.optional(),
			}),
		},
		async ({ name, group, regions }) => {
			try {
				return create_tool_response({
					database: await organization_client.create_database(name, {
						group,
						regions,
					}),
				});
			} catch (error) {
				return create_tool_error_response(error);
			}
		},
	);
	server.tool(
		{
			name: 'delete_database',
			description:
				'DESTRUCTIVE: Permanently delete a database and all data. Obtain explicit user confirmation first.',
			schema: z.object({ name: database_name_schema }),
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
			description:
				'Issue a database credential. Treat the returned token as secret; obtain approval for the requested permissions.',
			schema: z.object({
				database: database_name_schema,
				permission: z
					.enum(['full-access', 'read-only'])
					.default('full-access'),
			}),
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
}
