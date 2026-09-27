#!/usr/bin/env node

import { StdioTransport } from '@tmcp/transport-stdio';
import { readFileSync as read_file_sync } from 'node:fs';
import { close_database_clients } from './clients/database.js';
import { get_config } from './config.js';
import { create_mcp_server } from './mcp-server.js';

try {
	const config = get_config();
	const { name, version } = JSON.parse(
		read_file_sync(
			new URL('../package.json', import.meta.url),
			'utf8',
		),
	);
	const server = create_mcp_server({
		name,
		version,
		description: 'MCP server for integrating Turso with LLMs',
	});
	process.once('exit', close_database_clients);
	new StdioTransport(server).listen();
	console.error(
		`Turso MCP server running on stdio for organization: ${config.TURSO_ORGANIZATION}`,
	);
} catch (error) {
	console.error('Failed to initialize server:', error);
	process.exit(1);
}
