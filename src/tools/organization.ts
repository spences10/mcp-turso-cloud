/**
 * Organization-level tools for the Turso MCP server
 */
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { handleError } from '../common/errors.js';
import * as organizationClient from '../clients/organization.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Register organization tools with the server
 */
export function registerOrganizationTools(server: Server): void {
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
    ],
  }));

  // Register the tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      // Handle list_databases tool
      if (request.params.name === 'list_databases') {
        const databases = await organizationClient.listDatabases();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ databases }, null, 2),
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
