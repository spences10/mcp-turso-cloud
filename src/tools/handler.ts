import type { TursoMcpServer } from '../mcp-server.js';
import { register_database_tools } from './database-tools.js';
import { register_organization_tools } from './organization-tools.js';
import { register_query_tools } from './query-tools.js';

export function register_tools(server: TursoMcpServer): void {
	register_organization_tools(server);
	register_query_tools(server);
	register_database_tools(server);
}
