/**
 * Organization-level tools for the Turso MCP server
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as organization_client from '../clients/organization.js';

/**
 * Register organization tools with the server
 */
export function register_organization_tools(server: Server): void {
	// Register the list of available tools
	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: [
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
		],
	}));

	// Register the tool handler
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		try {
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
