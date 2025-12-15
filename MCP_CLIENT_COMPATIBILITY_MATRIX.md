# MCP Client Compatibility Matrix

## Executive Summary

The Model Context Protocol (MCP) specification does not explicitly
mandate a specific JSON Schema version for tool input schemas. This
has led to ecosystem fragmentation where different MCP clients support
different JSON Schema draft versions, creating compatibility
challenges for server authors.

**The Core Problem:**

- MCP specification references "JSON Schema" without version
  constraints
- Different clients implemented support for different JSON Schema
  drafts
- No capability negotiation mechanism exists in MCP for schema
  versions
- Servers must choose between compatibility and modern features

**Current Ecosystem State (2025):**

- Most clients support JSON Schema Draft-07 (published 2018)
- Some clients support Draft 2020-12 (latest specification)
- The MCP TypeScript SDK generates Draft-07 schemas
- The MCP Python SDK generates Draft 2020-12 schemas
- This creates a "split ecosystem" where servers must choose their
  audience

**Impact for MCP Server Authors:**

- Choosing Draft 2020-12: Works with Claude Code, breaks with VS
  Code/GitHub Copilot
- Choosing Draft-07: Works with most clients, limits modern schema
  features
- No runtime detection: Servers cannot adapt to client capabilities
- Must make upfront architectural decision

---

## Client Compatibility Matrix

| Client                 | MCP Support | JSON Schema Version | Validation | Config Method          | Production Ready | Notes                                               |
| ---------------------- | ----------- | ------------------- | ---------- | ---------------------- | ---------------- | --------------------------------------------------- |
| **Claude Desktop**     | ✅ Full     | Draft-07, 2020-12   | Lenient    | JSON config file       | ✅ Yes           | Most forgiving client, accepts both versions        |
| **Claude Code**        | ✅ Full     | Draft 2020-12       | Strict     | JSON config file       | ✅ Yes           | **Breaks with TypeScript SDK** (generates Draft-07) |
| **GitHub Copilot**     | ✅ Full     | Draft-07            | Strict     | JSON config (mcp.json) | ✅ Yes           | Rejects Draft 2020-12 features like `$dynamicRef`   |
| **VS Code**            | ✅ Full     | Draft-07            | Strict     | Via Copilot extension  | ✅ Yes           | Uses VS Code's JSON validator                       |
| **Visual Studio 2022** | ✅ Full     | Draft-07            | Unknown    | Agent Mode config      | ✅ Yes (v17.14+) | Windows only, Agent Mode feature                    |
| **Cursor IDE**         | ✅ Full     | Draft-07            | Lenient    | JSON config            | ✅ Yes           | Project and global config support                   |
| **Windsurf Editor**    | ✅ Full     | Draft-07            | Lenient    | Built-in config        | ✅ Yes           | Has plugin store for MCP servers                    |
| **Augment IDE**        | ✅ Full     | Draft-07            | Strict     | JSON config            | ✅ Yes           | Strict validator, rejects 2020-12                   |
| **Cline (VS Code)**    | ✅ Full     | Draft-07            | Lenient    | Extension settings     | ✅ Yes           | Formerly Claude Dev                                 |
| **Continue.dev**       | ✅ Full     | Draft-07            | Lenient    | JSON config            | ✅ Yes           | VS Code and JetBrains                               |
| **Zed Editor**         | ⚠️ Partial  | Unknown             | Unknown    | Settings file          | ⚠️ Prompts only  | Initial support for prompts, tools coming           |
| **Gemini CLI**         | ✅ Full     | Draft-07            | Unknown    | CLI flags              | ⚠️ Beta          | `gemini-cli` tool, not AI Studio                    |
| **ChatGPT/OpenAI**     | ⚠️ Beta     | Unknown             | Unknown    | Developer Mode         | ⚠️ Beta          | Developer Mode feature, limited availability        |
| **MCP Inspector**      | ✅ Full     | Both                | Lenient    | Dev tool               | ✅ Yes           | Official testing tool, accepts both versions        |

### Legend

- ✅ Full: Complete MCP implementation
- ⚠️ Partial: Limited or beta support
- ❌ None: No MCP support

---

## The TypeScript SDK vs Python SDK Split

### Critical Ecosystem Issue

**TypeScript SDK (Official):**

- Uses `zod-to-json-schema` library under the hood
- Generates JSON Schema **Draft-07**
- Result: **Breaks with Claude Code** (requires 2020-12)
- Works with: VS Code, Copilot, Cursor, most clients

**Python SDK (Official):**

- Uses Pydantic's `model_json_schema()`
- Generates JSON Schema **Draft 2020-12**
- Result: **Breaks with VS Code/GitHub Copilot**
- Works with: Claude Code, Claude Desktop, Inspector

**The Paradox:** Following official SDK documentation leads to
incompatibility with major clients. This is a specification gap, not a
bug.

---

## Client Deep Dives

### GitHub Copilot (VS Code Extension)

**JSON Schema Support:** Draft-07 only

**Validation Behavior:** Strict - tools are rejected if schema is
invalid

**Common Errors:**

```
[warning] N tools have invalid JSON schemas and will be omitted
Error: The schema uses meta-schema features ($dynamicRef) that are not yet supported
```

**What Breaks:**

- `$dynamicRef` and `$dynamicAnchor` (Draft 2020-12 features)
- `$schema: "https://json-schema.org/draft/2020-12/schema"`
- Tuple validation with `prefixItems`

**Configuration:**

```json
{
	"servers": {
		"my-server": {
			"command": "node",
			"args": ["path/to/server.js"],
			"env": {
				"API_KEY": "..."
			}
		}
	}
}
```

**Related Issues:**

- VS Code Issue #251315: JSON Schema validator doesn't support Draft
  2020-12
- MCP Issue #834: Clarify JSON Schema version requirements

---

### Claude Desktop

**JSON Schema Support:** Draft-07 and Draft 2020-12 (lenient)

**Validation Behavior:** Lenient - accepts both, minimal validation

**Configuration Location:**

- macOS:
  `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:**

```json
{
	"mcpServers": {
		"my-server": {
			"command": "/absolute/path/to/node",
			"args": ["path/to/server.js"],
			"env": {
				"API_KEY": "..."
			}
		}
	}
}
```

**Important Notes:**

- Requires absolute path to Node.js executable
- Using just "node" causes `spawn node ENOENT` error
- Find node path: `which node` (macOS/Linux) or `where node` (Windows)

---

### Claude Code

**JSON Schema Support:** Draft 2020-12 (strict)

**Validation Behavior:** Strict - validates against Draft 2020-12 spec

**Critical Issue:**

- **Breaks with TypeScript SDK** because it generates Draft-07
- Servers must use custom adapters or Python SDK
- This affects most TypeScript MCP servers in the ecosystem

**What Works:**

- Python SDK servers (generate 2020-12)
- Custom TypeScript adapters that convert to 2020-12
- Manually crafted schemas with
  `$schema: "https://json-schema.org/draft/2020-12/schema"`

**Configuration:** Same as Claude Desktop

---

### Cursor IDE

**JSON Schema Support:** Draft-07 (lenient)

**Validation Behavior:** Lenient - works with most schemas

**Configuration Locations:**

- Project: `.cursor/mcp.json`
- Global: User settings

**Configuration:**

```json
{
	"mcpServers": {
		"my-server": {
			"command": "node",
			"args": ["path/to/server.js"]
		}
	}
}
```

**Notes:**

- Very forgiving validator
- Good for development/testing
- Supports both project and global MCP servers

---

### Windsurf Editor

**JSON Schema Support:** Draft-07 (lenient)

**Validation Behavior:** Lenient

**Features:**

- Built-in MCP server plugin store
- Easy discovery and installation
- Native MCP integration

**Configuration:** Built-in UI for MCP server management

---

### Augment IDE

**JSON Schema Support:** Draft-07 only

**Validation Behavior:** Strict - similar to VS Code

**Common Issues:**

- Same Draft 2020-12 rejection as GitHub Copilot
- Requires Draft-07 compatible schemas

**Configuration:** JSON config file (similar to VS Code)

---

### Cline (VS Code Extension)

**JSON Schema Support:** Draft-07 (lenient)

**Validation Behavior:** Lenient

**Configuration:** Via VS Code extension settings

**Notes:**

- Formerly known as Claude Dev
- Popular VS Code extension for Claude integration
- Works with most schemas

---

### Continue.dev

**JSON Schema Support:** Draft-07

**Validation Behavior:** Lenient

**Platforms:**

- VS Code extension
- JetBrains IDEs

**Configuration:** JSON config file

**Notes:**

- Cross-IDE support
- Active development
- Good documentation

---

### Gemini CLI

**JSON Schema Support:** Draft-07

**Validation Behavior:** Unknown (limited reports)

**Status:** Beta/experimental

**Important Distinction:**

- `gemini-cli` tool has MCP support
- Google AI Studio (web) roadmap unclear
- Not the same as Gemini API

**Configuration:** Command-line flags

---

### Visual Studio 2022

**JSON Schema Support:** Draft-07

**Validation Behavior:** Unknown

**Requirements:**

- Visual Studio 2022 version 17.14 or later
- Windows only
- Agent Mode feature

**Configuration:** Via Agent Mode settings

**Notes:**

- Newer addition to MCP ecosystem
- Documentation still evolving

---

### MCP Inspector (Dev Tool)

**JSON Schema Support:** Both Draft-07 and 2020-12

**Validation Behavior:** Lenient - good for testing

**Purpose:** Official MCP development/debugging tool

**Usage:**

```bash
npx @modelcontextprotocol/inspector node path/to/server.js
```

**Features:**

- Interactive testing UI
- View tool schemas
- Test tool execution
- Debug MCP communication

**Notes:**

- Essential for MCP development
- Most lenient validator (accepts both versions)
- Good for initial testing, but test with target clients too

---

## Common Error Patterns

### Error: "$dynamicRef is not supported"

**Cause:** Client only supports Draft-07, server sent Draft 2020-12
schema

**Affected Clients:**

- GitHub Copilot / VS Code
- Augment IDE
- Gemini CLI

**Solution Options:**

1. Convert schemas to Draft-07
2. Use TypeScript SDK (generates Draft-07)
3. Create custom adapter to strip Draft 2020-12 features

---

### Error: "spawn node ENOENT"

**Cause:** Client cannot find Node.js executable

**Affected Clients:**

- Claude Desktop (most common)
- Any client with limited PATH

**Solution:** Use absolute path in configuration:

```json
{
	"command": "/Users/username/.nvm/versions/node/v20.0.0/bin/node"
}
```

Find path: `which node` or `where node`

---

### Error: "Tool schemas failed validation"

**Cause:** Schema is malformed or uses unsupported features

**Debug Steps:**

1. Test with MCP Inspector first
2. Validate schema at https://www.jsonschemavalidator.net/
3. Check `$schema` field matches client requirements
4. Remove Draft 2020-12 specific keywords if using Draft-07

---

### Error: "N tools have invalid JSON schemas and will be omitted"

**Cause:** Batch rejection by strict validator (VS Code/Copilot)

**Indicates:**

- All tools rejected, likely schema version mismatch
- Check for `$dynamicRef`, `$dynamicAnchor`, `prefixItems`

**Solution:** Convert to Draft-07 or test each tool schema
individually

---

## JSON Schema Draft Differences

### Draft-07 (2018) - Maximum Compatibility

**Key Features:**

- `$schema`: `http://json-schema.org/draft-07/schema#`
- Basic validation: `type`, `properties`, `required`, `enum`
- Array validation: `items`, `minItems`, `maxItems`
- String validation: `pattern`, `minLength`, `maxLength`
- Numeric validation: `minimum`, `maximum`, `multipleOf`

**What's Missing:**

- No `$dynamicRef` / `$dynamicAnchor`
- No `prefixItems` (use `items` array instead)
- No `unevaluatedProperties`
- Limited conditional schemas

**Compatibility:** Works with all MCP clients (2025)

---

### Draft 2020-12 (Latest) - Modern Features

**Key Features:**

- `$schema`: `https://json-schema.org/draft/2020-12/schema`
- All Draft-07 features plus:
- `$dynamicRef` / `$dynamicAnchor` for dynamic schema references
- `prefixItems` for tuple validation
- `unevaluatedProperties` for stricter validation
- Better `$ref` resolution

**What's Better:**

- More expressive validation
- Better composition with `allOf`, `anyOf`, `oneOf`
- Clearer semantics

**Compatibility:** Claude Code, Inspector, some Python clients

---

## Testing Strategy

### Multi-Client Testing Approach

**Phase 1: Local Validation**

1. Validate schemas at https://www.jsonschemavalidator.net/
2. Test both Draft-07 and 2020-12 validators
3. Ensure `$schema` field is correct

**Phase 2: MCP Inspector**

```bash
npx @modelcontextprotocol/inspector node path/to/server.js
```

- Verify tools load
- Check schema rendering
- Test tool execution

**Phase 3: Target Client Testing**

Test with actual clients you want to support:

**For VS Code/Copilot:**

```json
// .vscode/mcp.json
{
	"servers": {
		"test-server": {
			"command": "node",
			"args": ["./dist/index.js"]
		}
	}
}
```

**For Claude Desktop:** Add to `claude_desktop_config.json` and
restart

**For Cursor:** Add to `.cursor/mcp.json`

**Phase 4: Error Pattern Recognition**

Document errors by client:

- Which clients reject schemas?
- What specific errors occur?
- Are tools omitted or does connection fail?

---

## Decision Framework for Server Authors

### Question 1: Which clients must you support?

**If GitHub Copilot/VS Code is required:** → Must use Draft-07

**If Claude Code is required:** → Must use Draft 2020-12 OR provide
both versions

**If only Claude Desktop:** → Either version works (most lenient)

**If multiple strict clients:** → Need version flexibility strategy

---

### Question 2: What's your technology stack?

**TypeScript + Official SDK:** → Generates Draft-07 by default → Works
with most clients except Claude Code

**Python + Official SDK:** → Generates Draft 2020-12 by default →
Works with Claude Code, breaks VS Code/Copilot

**Custom implementation:** → Full control over schema version → More
maintenance burden

---

### Question 3: How important is flexibility?

**Maximum compatibility now:** → Use Draft-07, works everywhere today

**Future-proofing:** → Plan for version detection/negotiation →
Environment variable configuration → Multi-version support

**Minimal maintenance:** → Pick one version and document limitations →
Let users file issues for other clients

---

## Architectural Patterns (Conceptual)

### Pattern 1: Single Version Strategy

**Approach:** Choose one JSON Schema version and stick with it

**Draft-07 Variant:**

- Maximum compatibility (2025)
- Works with all clients except Claude Code
- Limits modern schema features

**Draft 2020-12 Variant:**

- Works with Claude Code
- Breaks with VS Code/Copilot/Augment
- Uses modern features

**Pros:**

- Simple implementation
- Clear documentation
- Minimal maintenance

**Cons:**

- Excludes some clients
- No flexibility for users
- May need to migrate later

**Best For:**

- Single-client focused servers
- MVP/prototype servers
- When client support is clear

---

### Pattern 2: Environment Variable Selection

**Approach:** Allow users to choose schema version via configuration

**Example:**

```bash
MCP_JSON_SCHEMA_VERSION=draft-07  # or draft-2020-12
```

**Pros:**

- User can match their client
- Single codebase supports both
- Documentation explains tradeoffs

**Cons:**

- Users must know their client requirements
- More configuration burden
- Testing both variants needed

**Best For:**

- Servers with diverse client base
- When you can't predict user's environment
- Educational/example servers

---

### Pattern 3: Client Detection (Future)

**Approach:** Detect client capabilities and adapt schema version

**Requirements:**

- MCP protocol would need to expose client info to schema adapters
- Clients would need to advertise JSON Schema support
- **Currently not possible** - MCP spec doesn't support this

**If it existed:**

```typescript
function getSchemaVersion(clientInfo) {
	if (clientInfo.name.includes('VS Code')) return 'draft-07';
	if (clientInfo.name.includes('Claude Code')) return 'draft-2020-12';
	return 'draft-07'; // safe default
}
```

**Pros:**

- Best user experience
- No configuration needed
- Automatic compatibility

**Cons:**

- Requires MCP spec changes
- Fragile (name-based detection)
- Maintenance as clients evolve

**Best For:**

- Future consideration
- When MCP adds capability negotiation

---

### Pattern 4: Multi-Version Parallel Support

**Approach:** Generate both versions and let client pick

**Theoretical:**

```json
{
  "tools": [
    {
      "name": "my_tool",
      "schemas": {
        "draft-07": { ... },
        "draft-2020-12": { ... }
      }
    }
  ]
}
```

**Problems:**

- Not supported by MCP protocol
- Would require spec changes
- Doubles schema size

**Status:** Not currently viable

---

## MCP Specification Evolution

### Current State (2025)

**Official Position:**

- Specification mentions "JSON Schema" without version
- Documentation references Draft 2020-12 in some places
- SDK implementations differ (TypeScript = Draft-07, Python = 2020-12)

**Active Discussions:**

- MCP Issue #834: Proposes formalizing Draft 2020-12 as standard
- PR #881: Attempts to clarify schema version requirements
- Community debate: Compatibility vs. modern features

---

### Potential Future Changes

**Option A: Formalize Draft 2020-12**

- Pro: Modern features, clear standard
- Con: Breaks existing VS Code/Copilot integration
- Likelihood: Medium (requires VS Code updates first)

**Option B: Formalize Draft-07**

- Pro: Universal compatibility today
- Con: Limits schema expressiveness
- Likelihood: Low (seen as stepping backward)

**Option C: Add Capability Negotiation**

- Pro: Best long-term solution
- Con: Requires protocol changes, client updates
- Likelihood: Medium-High (aligns with protocol design)

**Option D: Multiple Version Support**

- Pro: Supports all clients
- Con: Complex implementation
- Likelihood: Low (too much overhead)

---

### When Will This Be Resolved?

**Short Term (2025):**

- Status quo likely continues
- VS Code may add Draft 2020-12 support (timeline unknown)
- Server authors must handle fragmentation

**Medium Term (2026):**

- MCP spec may formalize version requirement
- More clients may add Draft 2020-12 support
- Ecosystem may converge on single version

**Long Term:**

- Capability negotiation most likely solution
- Backward compatibility maintained via negotiation
- Similar to HTTP content negotiation

---

## Recommendations Summary

### For Maximum Compatibility (2025)

**Use JSON Schema Draft-07**

**Works with:**

- ✅ GitHub Copilot / VS Code
- ✅ Augment IDE
- ✅ Gemini CLI
- ✅ Visual Studio 2022
- ✅ Cursor IDE
- ✅ Windsurf Editor
- ✅ Cline
- ✅ Continue.dev
- ✅ Claude Desktop
- ❌ Claude Code (requires 2020-12)

**Implementation:**

- TypeScript: Official SDK works as-is
- Python: Need custom adapter or downgrade
- Custom: Ensure `$schema` points to draft-07

---

### For Claude Code Compatibility

**Use JSON Schema Draft 2020-12**

**Works with:**

- ✅ Claude Code
- ✅ Claude Desktop
- ✅ MCP Inspector
- ❌ GitHub Copilot / VS Code
- ❌ Augment IDE
- ❌ Most other clients

**Implementation:**

- Python: Official SDK works as-is
- TypeScript: Need custom adapter
- Accept limited client support

---

### For Flexibility

**Provide Environment Variable Selection**

**Allow users to choose:**

```bash
MCP_JSON_SCHEMA_VERSION=draft-07  # or draft-2020-12
```

**Document clearly:**

- Which version for which client
- How to configure
- Known limitations of each

---

## Resources

### Official Documentation

- MCP Specification: https://spec.modelcontextprotocol.io/
- MCP TypeScript SDK:
  https://github.com/modelcontextprotocol/typescript-sdk
- MCP Python SDK: https://github.com/modelcontextprotocol/python-sdk

### JSON Schema Resources

- Draft-07 Spec:
  https://json-schema.org/draft-07/json-schema-release-notes.html
- Draft 2020-12 Spec:
  https://json-schema.org/draft/2020-12/release-notes.html
- Validator: https://www.jsonschemavalidator.net/

### Key Issues

- MCP Issue #834:
  https://github.com/modelcontextprotocol/modelcontextprotocol/issues/834
- VS Code Issue #251315:
  https://github.com/microsoft/vscode/issues/251315

---

## Changelog

**2025-01-15:** Initial version based on ecosystem research

- Documented 12+ MCP client implementations
- Identified TypeScript SDK vs Python SDK split
- Created compatibility matrix
- Established testing recommendations

---

**Document Status:** Living document, updated as ecosystem evolves

**Contributions:** Please submit corrections or updates via pull
request

**License:** CC0 1.0 Universal (Public Domain)
