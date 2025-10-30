#!/usr/bin/env node

import { McpServer } from 'tmcp';
import { Draft07JsonSchemaAdapter } from './adapters/draft07-adapter.js';
import { StdioTransport } from '@tmcp/transport-stdio';
import { z } from 'zod';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { get_config } from './config.js';
import { register_tools } from './tools/handler.js';

// Get package info for server metadata
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(
	readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
);
const { name, version } = pkg;

/**
 * Main class for the Turso MCP server
 */
class TursoServer {
	private server: McpServer;

	constructor() {
		// Initialize the server with metadata
		// Use Draft07JsonSchemaAdapter for GitHub Copilot compatibility
		const adapter = new Draft07JsonSchemaAdapter();
		this.server = new McpServer(
			{
				name,
				version,
				description: 'MCP server for integrating Turso with LLMs',
			},
			{
				adapter,
				capabilities: {
					tools: { listChanged: true },
				},
			},
		);

		// Handle process termination
		process.on('SIGINT', async () => {
			process.exit(0);
		});

		process.on('SIGTERM', async () => {
			process.exit(0);
		});
	}

	/**
	 * Initialize the server
	 */
	private async initialize(): Promise<void> {
		try {
			// Load configuration
			const config = get_config();
			console.error(
				`Turso MCP server initialized for organization: ${config.TURSO_ORGANIZATION}`,
			);

			// Register all tools using the unified handler
			register_tools(this.server);

			console.error('All tools registered');
		} catch (error) {
			console.error('Failed to initialize server:', error);
			process.exit(1);
		}
	}

	/**
	 * Run the server
	 */
	public async run(): Promise<void> {
		try {
			// Initialize the server
			await this.initialize();

			// Connect to the transport
			const transport = new StdioTransport(this.server);
			transport.listen();

			console.error('Turso MCP server running on stdio');
		} catch (error) {
			console.error('Failed to start server:', error);
			process.exit(1);
		}
	}
}

// Create and run the server
const server = new TursoServer();
server.run().catch((error) => {
	console.error('Unhandled error:', error);
	process.exit(1);
});
