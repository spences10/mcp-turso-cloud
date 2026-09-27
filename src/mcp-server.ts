import { ZodJsonSchemaAdapter } from '@tmcp/adapter-zod';
import { McpServer } from 'tmcp';
import type { z } from 'zod';
import { register_tools } from './tools/handler.js';

export type TursoMcpServer = McpServer<z.ZodType>;

export function create_mcp_server(metadata: {
	name: string;
	version: string;
	description?: string;
}): TursoMcpServer {
	const server = new McpServer<z.ZodType>(metadata, {
		adapter: new ZodJsonSchemaAdapter(),
		capabilities: { tools: { listChanged: true } },
	});
	register_tools(server);
	return server;
}
