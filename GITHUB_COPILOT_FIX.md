# GitHub Copilot Compatibility Fix

## Problem

The original `mcp-turso-cloud` uses `@tmcp/adapter-zod` which generates JSON Schema Draft 2020-12. GitHub Copilot's MCP validator only supports up to JSON Schema Draft-07/2019-09, causing all 9 tools to be omitted with errors about `$dynamicRef` being unsupported.

## Solution

Created a custom `Draft07JsonSchemaAdapter` that:
1. Uses Zod's built-in `toJSONSchema()` to generate the schema
2. Recursively converts Draft 2020-12 features to Draft-07 compatible format
3. Removes incompatible meta-schema features like `$dynamicRef` and `$dynamicAnchor`
4. Changes `$schema` reference to `http://json-schema.org/draft-07/schema#`

## Changes Made

### New Files
- `src/adapters/draft07-adapter.ts` - Custom adapter that converts Draft 2020-12 to Draft-07

### Modified Files
- `src/index.ts` - Now selects adapter at runtime: uses the original `ZodJsonSchemaAdapter` by default (to preserve Claude support) and `Draft07JsonSchemaAdapter` when explicitly enabled.

### How to enable GitHub Copilot compatibility

To avoid changing the project's default behavior (which the original author used to support Claude), the server now respects an environment variable to enable Draft-07 conversion.

- Set `MCP_GITHUB_COMPAT=true` or `MCP_ADAPTER=draft07` to enable the Draft-07 adapter used for GitHub Copilot.
- If neither variable is set, the server uses the original `ZodJsonSchemaAdapter` (unchanged behavior).

Examples:

```bash
# Temporarily enable compatibility for the current shell session
export MCP_GITHUB_COMPAT=true
node dist/index.js

# Or set adapter explicitly
export MCP_ADAPTER=draft07
node dist/index.js
```

## Compatibility

✅ **GitHub Copilot for VS Code** - Now fully compatible  
✅ **Claude Desktop** - Still compatible (Draft-07 is backward compatible)  
✅ **Other MCP Clients** - Should work with any client supporting Draft-07+

## Testing

### GitHub Copilot for VS Code

**Before (Draft 2020-12)**:
```
[warning] 9 tools have invalid JSON schemas and will be omitted
Error: El esquema usa características de metaesquema ($dynamicRef) que aún no son compatibles
```

**After (Draft-07 with `MCP_GITHUB_COMPAT=true`)**:
```
[info] Discovered 9 tools
✅ All tools available in GitHub Copilot
```

**Test Results**:
- ✅ Tool `list_databases` works correctly
- ✅ Can query Turso database successfully
- ✅ All 9 tools loaded without JSON Schema errors

### Claude Desktop

**Configuration (default behavior, WITHOUT `MCP_GITHUB_COMPAT`)**:
```json
{
  "mcpServers": {
    "turso-cloud": {
      "command": "/absolute/path/to/node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "TURSO_API_TOKEN": "...",
        "TURSO_ORGANIZATION": "...",
        "TURSO_DEFAULT_DATABASE": "..."
      }
    }
  }
}
```

**Test Results**:
- ✅ All 9 tools loaded successfully
- ✅ Can list databases correctly
- ✅ No JSON Schema errors
- ✅ **Backward compatibility CONFIRMED** - Default behavior works perfectly with Claude Desktop

**Important Note for Claude Desktop Users**:
- ⚠️ **Must use absolute path to node** (e.g., `/Users/username/.asdf/shims/node` or `/usr/local/bin/node`)
- ❌ Using just `"node"` will cause `spawn node ENOENT` error
- 💡 Find your node path with: `which node`

## Technical Details

The adapter works by:

1. **Generating JSON Schema**: Uses Zod v4's `toJSONSchema()` method
2. **Recursive Conversion**: Walks the schema tree and removes/converts incompatible features
3. **Preserving Validation**: Maintains all Zod validation logic - only the JSON Schema representation changes
4. **Zero Breaking Changes**: All existing tool definitions work without modification

### Schema Conversion Example

**Input (Draft 2020-12)**:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": { "type": "string" }
  },
  "$dynamicRef": "#meta"
}
```

**Output (Draft-07)**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": { "type": "string" }
  }
}
```

## Benefits

1. **GitHub Copilot Support**: All 9 tools now work in VS Code with GitHub Copilot when `MCP_GITHUB_COMPAT=true`
2. **No Breaking Changes**: Existing Claude Desktop and other MCP clients continue to work with default behavior
3. **Runtime Configurable**: Simple environment variable to enable GitHub Copilot compatibility
4. **Future Proof**: When GitHub Copilot adds Draft 2020-12 support, can easily remove the adapter
5. **Clean Implementation**: Minimal changes to existing codebase
6. **Well Tested**: Verified with both GitHub Copilot (VS Code) and Claude Desktop

## Configuration

### For GitHub Copilot (VS Code)
Set environment variable: `MCP_GITHUB_COMPAT=true`

Alternatively: `MCP_ADAPTER=draft07`

### For Claude Desktop (default)
No configuration needed - works out of the box with `ZodJsonSchemaAdapter`

**Note**: Claude Desktop requires absolute path to node executable due to PATH limitations.

## Build & Test

### Build the Project
```bash
npm run build
```

### Test with GitHub Copilot (VS Code)

1. Update `.vscode/mcp.json`:
```json
{
  "servers": {
    "turso-cloud": {
      "command": "node",
      "args": ["path/to/dist/index.js"],
      "env": {
        "TURSO_API_TOKEN": "...",
        "TURSO_ORGANIZATION": "...",
        "TURSO_DEFAULT_DATABASE": "...",
        "MCP_GITHUB_COMPAT": "true"
      }
    }
  }
}
```

2. Restart MCP server in VS Code
3. Try: `@turso-cloud List my Turso databases` in Copilot Chat

### Test with Claude Desktop

1. Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "turso-cloud": {
      "command": "/absolute/path/to/node",
      "args": ["path/to/dist/index.js"],
      "env": {
        "TURSO_API_TOKEN": "...",
        "TURSO_ORGANIZATION": "...",
        "TURSO_DEFAULT_DATABASE": "..."
      }
    }
  }
}
```

**Important**: 
- Use absolute path to node (find with `which node`)
- Do NOT set `MCP_GITHUB_COMPAT` (default behavior works with Claude)

2. Restart Claude Desktop (Cmd+Q, then reopen)
3. Ask Claude: "List my Turso databases"

## Future Improvements

- Add automated tests for schema conversion
- Add CI/CD checks for Draft-07 compatibility
- Consider making adapter selection configurable via environment variable

## Contributing

This fix is ready to be contributed back to the original repository. See [CONTRIBUTING.md](./CONTRIBUTING.md) for details on creating a PR.

---

**Author**: Josep Crespo (@josepcrespo)  
**Date**: October 30, 2025  
**Issue**: GitHub Copilot JSON Schema Draft 2020-12 incompatibility  
**Solution**: Custom Draft-07 adapter with backward compatibility
