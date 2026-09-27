# mcp-turso-cloud

A Model Context Protocol (MCP) server that provides integration with
Turso databases for LLMs. This server implements a two-level
authentication system to handle both organization-level and
database-level operations, making it easy to manage and query Turso
databases directly from LLMs.

<a href="https://glama.ai/mcp/servers/hnkzlqoh92">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/hnkzlqoh92/badge" alt="mcp-turso-cloud MCP server" />
</a>

## Features

### 🏢 Organization-Level Operations

- **List Databases**: View all databases in your Turso organization
- **Create Database**: Create new databases with customizable options
- **Delete Database**: Remove databases from your organization
- **Generate Database Token**: Create authentication tokens for
  specific databases

### 💾 Database-Level Operations

- **List Tables**: View all tables in a specific database
- **Execute Read-Only Query**: Run SELECT and PRAGMA queries
  (read-only operations)
- **Execute Query**: Run potentially destructive SQL queries (INSERT,
  UPDATE, DELETE, etc.)
- **Describe Table**: Get schema information for database tables
- **Vector Search**: Perform vector similarity search using SQLite
  vector extensions

## ⚠️ IMPORTANT: Query Execution Security ⚠️

This server implements a security-focused separation between read-only
and destructive database operations:

- Use `execute_read_only_query` for SELECT, read-only WITH/VALUES,
  EXPLAIN of reads, and allowlisted metadata PRAGMAs.
- Use `execute_query` for INSERT, UPDATE, DELETE, CREATE, DROP,
  mutating PRAGMAs, and other operations that modify data.

Read tools always request read-only Turso credentials, including when
full-access clients are already cached. The token endpoint receives
[`authorization=read-only`](https://docs.turso.tech/api-reference/databases/create-token)
as a query parameter. Read failures never fall back to full access.
Tokens and clients are cached separately by permission and refreshed
when tokens expire.

Local SQL validation rejects multiple statements, mutating PRAGMAs on
the read path, and file/extension functions. It is a conservative
routing check, not a complete SQL parser or a substitute for Turso's
server-side authorization. Unknown or quoted PRAGMA names require the
write tool. Compound statements containing internal semicolons (such
as trigger definitions) are not supported. Identifiers in generated
SQL are quoted; data values use bindings.

This separation allows for different permission levels and approval
requirements:

- Read-only operations can be auto-approved in many contexts
- Destructive operations can require explicit approval for safety

**ALWAYS CAREFULLY READ AND REVIEW SQL QUERIES BEFORE APPROVING
THEM!** This is especially critical for destructive operations that
can modify or delete data. Take time to understand what each query
does before allowing it to execute.

## Two-Level Authentication System

The server implements a sophisticated authentication system:

1. **Organization-Level Authentication**

   - Uses a Turso Platform API token
   - Manages databases and organization-level operations
   - Obtained through the Turso dashboard

2. **Database-Level Authentication**
   - Uses database-specific tokens
   - Generated automatically using the organization token
   - Cached for performance and rotated as needed

## Configuration

This server requires configuration through your MCP client. Here are
examples for different environments:

### Cline/Claude Desktop Configuration

Add this to your Cline/Claude Desktop MCP settings:

```json
{
	"mcpServers": {
		"mcp-turso-cloud": {
			"command": "npx",
			"args": ["-y", "mcp-turso-cloud"],
			"env": {
				"TURSO_API_TOKEN": "your-turso-api-token",
				"TURSO_ORGANIZATION": "your-organization-name",
				"TURSO_DEFAULT_DATABASE": "optional-default-database"
			}
		}
	}
}
```

### Claude Desktop with WSL Configuration

For WSL environments, add this to your Claude Desktop configuration:

```json
{
	"mcpServers": {
		"mcp-turso-cloud": {
			"command": "wsl.exe",
			"args": [
				"bash",
				"-c",
				"TURSO_API_TOKEN=your-token TURSO_ORGANIZATION=your-org node /path/to/mcp-turso-cloud/dist/index.js"
			]
		}
	}
}
```

### Environment Variables

The server requires the following environment variables:

- `TURSO_API_TOKEN`: Your Turso Platform API token (required)
- `TURSO_ORGANIZATION`: Your Turso organization name (required)
- `TURSO_DEFAULT_DATABASE`: Default database to use when none is
  specified (optional)
- `TOKEN_EXPIRATION`: Expiration time for generated database tokens
  (optional, default: '7d')
- `TOKEN_PERMISSION`: Permission level for generated tokens (optional,
  default: 'full-access')

## API

The server implements MCP Tools organized by category:

### Organization Tools

#### list_databases

Lists all databases in your Turso organization.

Parameters:

- `limit` (integer, optional): Maximum results, default 1000, maximum
  10000
- `offset` (integer, optional): Results to skip, default 0, maximum
  1000000

Responses include `pagination` with `returned_count`, `has_more`, and
`next_offset`.

Example response:

```json
{
	"databases": [
		{
			"name": "customer_db",
			"id": "abc123",
			"region": "us-east",
			"created_at": "2023-01-15T12:00:00Z"
		},
		{
			"name": "product_db",
			"id": "def456",
			"region": "eu-west",
			"created_at": "2023-02-20T15:30:00Z"
		}
	]
}
```

#### create_database

Creates a new database in your organization.

Parameters:

- `name` (string, required): Name for the new database
- `group` (string, optional): Group to assign the database to
- `regions` (string[], optional): Regions to deploy the database to

Example:

```json
{
	"name": "analytics_db",
	"group": "production",
	"regions": ["us-east", "eu-west"]
}
```

#### delete_database

Deletes a database from your organization.

Parameters:

- `name` (string, required): Name of the database to delete

Example:

```json
{
	"name": "test_db"
}
```

#### generate_database_token

Generates a new token for a specific database. Expiration is
configured through `TOKEN_EXPIRATION`; the returned JWT is a secret.

Parameters:

- `database` (string, required): Database name
- `permission` (string, optional): Permission level ('full-access' or
  'read-only')

Example:

```json
{
	"database": "customer_db",
	"permission": "read-only"
}
```

### Database Tools

Database names are limited to 1–64 letters, digits, underscores, or
hyphens. Table/column identifiers accept 1–64 characters, excluding
null bytes; punctuation and quotes are safely escaped. A supplied
database becomes the current context only after its operation
succeeds.

#### list_tables

Lists all tables in a database, with pagination metadata.

Parameters:

- `database` (string, optional): Database name (uses context if not
  provided)
- `limit` (integer, optional): Maximum results, default 1000, maximum
  10000
- `offset` (integer, optional): Results to skip, default 0, maximum
  1000000

Example:

```json
{
	"database": "customer_db"
}
```

#### execute_read_only_query

Executes one SELECT, read-only WITH/VALUES query, EXPLAIN of a read,
or allowlisted metadata PRAGMA against a database.

Parameters:

- `query` (string, required): One SQL statement, maximum 10000
  characters
- `params` (object, optional): Named parameters or contiguous
  positional keys starting at `"1"`; values must be strings, finite
  numbers, booleans, or null
- `database` (string, optional): Database name (uses context if not
  provided)
- `limit` (integer, optional): Maximum rows, default 1000, maximum
  10000
- `offset` (integer, optional): Rows to skip, default 0, maximum
  1000000

SELECT-style queries are wrapped with an outer limit/offset,
preserving any limit already present in your SQL. Metadata PRAGMA and
EXPLAIN results are sliced after fetching. Use a stable `ORDER BY`
when paging. Responses retain `result.rows` and add `pagination`
metadata.

Query result rows and column names have a 512 KiB JSON budget. If a
row cannot fit, select fewer/smaller columns (for example, `substr`).
`result.truncated` and `truncation_reason` explain omitted results;
`next_offset` is null when no row fits. BigInts are decimal strings
and blobs are `{ "type": "blob", "base64": "..." }`.

Example:

```json
{
	"query": "SELECT * FROM users WHERE age > ?",
	"params": { "1": 21 },
	"database": "customer_db"
}
```

#### execute_query

Executes a potentially destructive SQL query (INSERT, UPDATE, DELETE,
CREATE, etc.) against a database.

Parameters:

- `query` (string, required): One write statement, maximum 10000
  characters; includes mutating PRAGMAs and WITH-prefixed writes
- `params` (object, optional): Same parameter types as the read tool
- `database` (string, optional): Database name (uses context if not
  provided)

Example:

```json
{
	"query": "INSERT INTO users (name, age) VALUES (?, ?)",
	"params": { "1": "Alice", "2": 30 },
	"database": "customer_db"
}
```

Write result rows (such as `RETURNING`) are capped at 1000 rows and
the same byte budget. `rowsAffected` remains intact. Truncation does
not undo the write: do not rerun a write to fetch omitted rows.

#### describe_table

Gets schema information for a table.

Parameters:

- `table` (string, required): Table name
- `database` (string, optional): Database name (uses context if not
  provided)

Example:

```json
{
	"table": "users",
	"database": "customer_db"
}
```

#### vector_search

Performs vector similarity search using SQLite vector extensions.

Parameters:

- `table` (string, required): Table name
- `vector_column` (string, required): Column containing vectors
- `query_vector` (number[], required): 1–4096 finite numbers
- `limit` (integer, optional): Maximum results, default 10, maximum
  1000
- `database` (string, optional): Database name (uses context if not
  provided)

Example:

```json
{
	"table": "embeddings",
	"vector_column": "embedding",
	"query_vector": [0.1, 0.2, 0.3, 0.4],
	"limit": 5,
	"database": "vector_db"
}
```

## Development

### Setup

Use Node.js 24.15.0 or newer and pnpm 12.5.1 (pinned in
`package.json`). `.node-version` selects the development runtime.

```bash
pnpm install
pnpm check
pnpm test
```

Vite+ provides the build, formatting, linting, type checking, and test
runner through `vite.config.ts`:

- `pnpm build` — bundle the executable and declarations into `dist/`
- `pnpm start` — run the built server with your Turso configuration
- `pnpm dev` — rebuild on source changes
- `pnpm inspect` — open the MCP inspector against the built server
- `pnpm check` — check formatting, lint, and types
- `pnpm check:fix` — apply formatting and safe lint fixes
- `pnpm format` / `pnpm format:check` — format or check formatting
- `pnpm test` — build and run offline SQL, permission, token, MCP
  handler, and CLI tests; no Turso credentials or live database access
  needed. SQL execution tests use an isolated in-memory libSQL
  database.

Dependency versions live in the `pnpm-workspace.yaml` catalog. New
releases must be at least two days old before installation.

### Editors

Install the **Oxc** extension in Zed or the **Vite Plus Extension
Pack** in VS Code. Checked-in `.zed/settings.json` and
`.vscode/settings.json` use Oxfmt with the shared `vite.config.ts`
formatting settings. Prettier configuration is no longer used.

### Publishing

```bash
pnpm changeset
pnpm version
pnpm check
pnpm test
pnpm release
```

`pnpm release` builds and publishes through Changesets. `pnpm pack`
can verify the package locally without publishing.

## Troubleshooting

### API Token Issues

If you encounter authentication errors:

1. Verify your Turso API token is valid and has the necessary
   permissions
2. Check that your organization name is correct
3. Ensure your token hasn't expired

### Database Connection Issues

If you have trouble connecting to databases:

1. Verify the database exists in your organization
2. Check that your API token has access to the database
3. Ensure the database name is spelled correctly

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

Built on:

- [Model Context Protocol](https://github.com/modelcontextprotocol)
- [Turso Database](https://turso.tech)
- [libSQL](https://github.com/libsql/libsql)
