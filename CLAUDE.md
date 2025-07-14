# CLAUDE.md

## Unbreakable rules

- you must never read .env files even when explicitly asked to
- when defining function and variable names they must be in snake case
- you must not ask to run pnpm dev this adds no value to the user

## Project Overview

This file provides guidance to Claude Code (claude.ai/code) when
working with code in this repository.

This is an MCP (Model Context Protocol) server that provides
integration between Turso databases and LLMs. It implements a
two-level authentication system for organization-level and
database-level operations.

## Development Commands

**Build & Development:**

- `pnpm build` - Compile TypeScript and make executable
- `pnpm start` - Run the compiled server
- `pnpm dev` - Development mode with MCP inspector
- `pnpm changeset` - Version management
- `pnpm release` - Build and publish to npm

**Package Manager:** Uses pnpm exclusively

## Architecture & Key Concepts

**Two-Level Authentication:**

1. Organization-level: Uses `TURSO_API_TOKEN` for platform operations
2. Database-level: Auto-generated tokens cached for performance

**Security Model:**

- `execute_read_only_query` - SELECT/PRAGMA only (safe operations)
- `execute_query` - Destructive operations (INSERT/UPDATE/DELETE/etc.)
- This separation allows different approval requirements

**Core Modules:**

- `/src/tools/` - MCP tool implementations
- `/src/clients/` - Database and organization API clients
- `/src/common/` - Shared types and error handling
- `/src/config.ts` - Zod-validated configuration

**Key Dependencies:**

- `@modelcontextprotocol/sdk` - MCP framework
- `@libsql/client` - Turso/libSQL client
- `zod` - Runtime validation

## Configuration

**Required Environment Variables:**

- `TURSO_API_TOKEN` - Turso Platform API token
- `TURSO_ORGANIZATION` - Organization name

**Optional Variables:**

- `TURSO_DEFAULT_DATABASE` - Default database context
- `TOKEN_EXPIRATION` - Token expiration (default: '7d')
- `TOKEN_PERMISSION` - Default permission level

## Testing & Quality

**Current State:** No test framework configured. Uses TypeScript
strict mode and comprehensive error handling.

**Adding Tests:** Would need to establish testing framework
(Jest/Vitest recommended for Node.js/TypeScript projects).

## Code Patterns

**Error Handling:** All functions use proper MCP error codes and
descriptive messages

**Type Safety:** Full TypeScript with Zod runtime validation

**Async Patterns:** Uses modern async/await throughout

**Security:** Never logs sensitive tokens, proper separation of
read/write operations
