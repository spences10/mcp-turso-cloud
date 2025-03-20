#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getConfig } from './config.js';
import { handleError } from './common/errors.js';
import { registerOrganizationTools } from './tools/organization.js';

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
  private server: Server;

  constructor() {
    // Initialize the server with metadata
    this.server = new Server(
      {
        name,
        version,
      },
      {
        capabilities: {
          resources: {},
          tools: {
            list_databases: {
              description: 'List all databases in your Turso organization'
            }
          },
        },
      }
    );

    // Set up error handling
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    // Handle process termination
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Initialize the server
   */
  private async initialize(): Promise<void> {
    try {
      // Load configuration
      const config = getConfig();
      console.error(`Turso MCP server initialized for organization: ${config.TURSO_ORGANIZATION}`);
      
      // Register organization tools
      registerOrganizationTools(this.server);
      
      console.error('Organization tools registered');
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
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
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
