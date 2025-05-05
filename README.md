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

- Use `execute_read_only_query` for SELECT and PRAGMA queries (safe,
  read-only operations)
- Use `execute_query` for INSERT, UPDATE, DELETE, CREATE, DROP, and
  other operations that modify data

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

Parameters: None

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

Generates a new token for a specific database.

Parameters:

- `database` (string, required): Database name
- `expiration` (string, optional): Token expiration time
- `permission` (string, optional): Permission level ('full-access' or
  'read-only')

Example:

```json
{
	"database": "customer_db",
	"expiration": "30d",
	"permission": "read-only"
}
```

### Database Tools

#### list_tables

Lists all tables in a database.

Parameters:

- `database` (string, optional): Database name (uses context if not
  provided)

Example:

```json
{
	"database": "customer_db"
}
```

#### execute_read_only_query

Executes a read-only SQL query (SELECT, PRAGMA) against a database.

Parameters:

- `query` (string, required): SQL query to execute (must be SELECT or
  PRAGMA)
- `params` (object, optional): Query parameters
- `database` (string, optional): Database name (uses context if not
  provided)

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

- `query` (string, required): SQL query to execute (cannot be SELECT
  or PRAGMA)
- `params` (object, optional): Query parameters
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
- `query_vector` (number[], required): Query vector for similarity
  search
- `limit` (number, optional): Maximum number of results (default: 10)
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

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

4. Run in development mode:

```bash
npm run dev
```

### Publishing

1. Update version in package.json
2. Build the project:

```bash
npm run build
```

3. Publish to npm:

```bash
npm publish
```

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
