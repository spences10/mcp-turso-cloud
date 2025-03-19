#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { SchemaTools } from './tools/schema.js';
import { QueryTools } from './tools/query.js';
import { VectorTools } from './tools/vector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
);
const { name, version } = pkg;

async function main() {
  const config = loadConfig();
  const transport = new StdioServerTransport();
  const server = new Server({
    name,
    version,
    transport,
  });

  const schemaTools = new SchemaTools(config);
  const queryTools = new QueryTools(config);
  const vectorTools = new VectorTools(config);

  // Register schema tools
  SchemaTools.getTools().forEach(tool => {
    const handler = async (request: unknown) => {
      const params = tool.inputSchema.parse(request);
      switch (tool.name) {
        case 'list_tables':
          return await schemaTools.listTables();
        case 'describe_table':
          if ('table' in params) {
            return await schemaTools.describeTable(params);
          }
          throw new Error('Missing table parameter');
        case 'list_relationships':
          return await schemaTools.listRelationships();
        default:
          throw new Error(`Unknown tool: ${tool.name}`);
      }
    };
    server.setRequestHandler(tool.inputSchema, handler);
  });

  // Register query tools
  QueryTools.getTools().forEach(tool => {
    const handler = async (request: unknown) => {
      const params = tool.inputSchema.parse(request);
      switch (tool.name) {
        case 'execute_query':
          return await queryTools.executeQuery(params);
        default:
          throw new Error(`Unknown tool: ${tool.name}`);
      }
    };
    server.setRequestHandler(tool.inputSchema, handler);
  });

  // Register vector tools
  VectorTools.getTools().forEach(tool => {
    const handler = async (request: unknown) => {
      const params = tool.inputSchema.parse(request);
      switch (tool.name) {
        case 'vector_search':
          if ('method' in params && params.method === 'vector_search') {
            return await vectorTools.vectorSearch(params);
          }
          throw new Error('Invalid vector search parameters');
        case 'hybrid_search':
          if ('method' in params && params.method === 'hybrid_search') {
            return await vectorTools.hybridSearch(params);
          }
          throw new Error('Invalid hybrid search parameters');
        default:
          throw new Error(`Unknown tool: ${tool.name}`);
      }
    };
    server.setRequestHandler(tool.inputSchema, handler);
  });

  // Start the server
  await transport.start();
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
