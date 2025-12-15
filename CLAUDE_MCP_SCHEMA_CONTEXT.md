# MCP JSON Schema Compatibility Context for Claude Code

## Purpose

This document provides context for Claude Code when implementing or
modifying MCP (Model Context Protocol) servers. It explains the JSON
Schema version compatibility landscape without prescribing specific
implementations, allowing you to generate appropriate solutions for
each project's unique requirements.

---

## The Core Problem

**MCP specification does not mandate a specific JSON Schema draft
version.**

This creates an ecosystem where:

- Different MCP clients support different JSON Schema versions
- No runtime capability negotiation exists
- Server authors must make upfront compatibility decisions
- Solutions must balance compatibility vs. modern features

**This is a specification gap, not a bug in any particular
implementation.**

---

## Critical Facts About the Ecosystem

### Client Requirements (2025)

**Clients Requiring Draft-07:**

- GitHub Copilot (VS Code)
- Augment IDE
- Visual Studio 2022
- Gemini CLI
- Most strict validators

**Clients Requiring Draft 2020-12:**

- Claude Code (strict validation)

**Clients Accepting Both:**

- Claude Desktop (lenient validator)
- Cursor IDE (lenient)
- Windsurf Editor (lenient)
- Cline (VS Code extension)
- Continue.dev
- MCP Inspector (dev tool)

### The SDK Split

**TypeScript SDK (Official):**

- Generates JSON Schema Draft-07
- Uses `zod-to-json-schema` internally
- Works with: VS Code, Copilot, most clients
- Breaks with: Claude Code

**Python SDK (Official):**

- Generates JSON Schema Draft 2020-12
- Uses Pydantic's `model_json_schema()`
- Works with: Claude Code, Inspector
- Breaks with: VS Code, Copilot, Augment

**Implication:** Following official SDK documentation will make your
server incompatible with major clients.

---

## Draft-07 vs Draft 2020-12 Technical Differences

### What Draft 2020-12 Adds That Breaks Draft-07 Clients

**Features that cause rejection:**

- `$dynamicRef` / `$dynamicAnchor` - Dynamic schema references
- `prefixItems` - Tuple validation (use `items` array in Draft-07)
- `unevaluatedProperties` - Stricter property validation
- `$schema: "https://json-schema.org/draft/2020-12/schema"`

**Common error message:**

```
[warning] N tools have invalid JSON schemas and will be omitted
Error: The schema uses meta-schema features ($dynamicRef) that are not yet supported
```

### Conversion Considerations

**Draft 2020-12 → Draft-07:**

- Remove `$dynamicRef`, `$dynamicAnchor`
- Convert `prefixItems` to `items` array
- Change `$schema` URL to draft-07
- Remove `unevaluatedProperties` (or convert to
  `additionalProperties: false`)
- Most validation semantics preserved

**Draft-07 → Draft 2020-12:**

- Simple: just update `$schema` URL
- Optionally: use new features for better validation
- Fully backward compatible

---

## Decision Framework

When implementing an MCP server, consider these questions:

### 1. Client Target Analysis

**Ask the user (if not clear):**

- Which MCP clients do they use or plan to support?
- Is GitHub Copilot/VS Code support required?
- Is Claude Code support required?
- Are they targeting one client or multiple?

**If user says "all clients" or "maximum compatibility":** → Draft-07
is the safe choice (works with 90% of clients in 2025)

**If user specifically needs Claude Code:** → Must use Draft 2020-12
or provide flexibility

### 2. Technology Stack Assessment

**For TypeScript projects using official SDK:**

- Default behavior generates Draft-07
- No action needed for VS Code/Copilot compatibility
- Need custom adapter for Claude Code support

**For Python projects using official SDK:**

- Default behavior generates Draft 2020-12
- Works with Claude Code by default
- Need custom adapter for VS Code/Copilot compatibility

**For projects using tmcp or custom implementations:**

- Full control over schema version
- Check which adapter is being used
- Consider whether flexibility is needed

### 3. Architectural Philosophy

**Single Version Approach:**

- Choose one version, document limitations
- Simplest implementation
- Clear client support statement
- Recommended for most projects

**Flexible Version Approach:**

- Environment variable selection
- More complex but accommodates all clients
- Requires documentation and testing
- Consider if truly needed or premature optimization

**Future-Proof Approach:**

- Anticipate MCP spec evolution
- Structure code for easy migration
- Comment why decisions were made
- Prepare for capability negotiation

---

## Implementation Considerations (Architectural)

### Adapter Architecture Patterns

**Pattern 1: Direct Schema Generation**

```
Zod/Pydantic → JSON Schema → MCP Client
```

- Simplest approach
- Version determined by library defaults
- Limited flexibility

**Pattern 2: Adapter Layer**

```
Zod/Pydantic → JSON Schema (any version) → Adapter → Draft-07 or 2020-12 → Client
```

- Conversion layer between schema generation and output
- Can target specific version
- More maintainable than patching schemas

**Pattern 3: Factory/Registry Pattern**

```
Config → Select Adapter → Generate Schema → Client
```

- Runtime adapter selection
- Environment variable driven
- Most flexible but most complex

**Pattern 4: Multi-Version Generation** (Not Currently Viable)

```
Generate Both Versions → Client Selects
```

- Ideal but not supported by MCP protocol
- Would require spec changes
- Keep in mind for future

### Type System Considerations

**TypeScript:**

- `JSONSchema7` type from `@types/json-schema`
- Return types may be baked into adapters
- Consider type compatibility when creating custom adapters
- Generic types may need adjustment

**Python:**

- `dict[str, Any]` typically used for schemas
- Less type constraint than TypeScript
- Easier to implement custom converters

### Configuration Management

**Environment Variables:**

- `MCP_JSON_SCHEMA_VERSION` or similar
- Document in README
- Provide sensible default (Draft-07 for max compatibility)

**Config Files:**

- Could use package.json, pyproject.toml, or dedicated config
- More complex but more discoverable
- Consider whether complexity is justified

**Runtime Detection:** (Currently Not Possible)

- MCP doesn't expose client info to adapters
- Can't detect at runtime which client connected
- Future: watch for MCP spec updates

---

## Testing Guidance

### Validation Before Implementation

**Always test schema compatibility with target clients:**

1. **MCP Inspector** (lenient, good for initial testing):

   ```bash
   npx @modelcontextprotocol/inspector node path/to/server.js
   ```

2. **Target client testing:**

   - Configure in actual client (VS Code, Claude Desktop, etc.)
   - Verify tools appear and are not rejected
   - Test tool execution

3. **Schema validation:**
   - https://www.jsonschemavalidator.net/
   - Test against both Draft-07 and 2020-12 validators
   - Ensure `$schema` field matches

### Common Error Patterns

**"$dynamicRef is not supported"** → Client requires Draft-07, server
sent Draft 2020-12

**"N tools have invalid JSON schemas and will be omitted"** → Batch
rejection, check schema version mismatch

**"spawn node ENOENT"** → Not a schema issue, client can't find
Node.js (use absolute path)

---

## Recommendations for Different Scenarios

### Scenario: New TypeScript MCP Server

**Analysis:**

- TypeScript SDK generates Draft-07 by default
- Works with most clients (VS Code, Copilot, Cursor, etc.)
- Breaks with Claude Code

**Recommendation:**

- Use default TypeScript SDK behavior (Draft-07)
- Document: "Compatible with GitHub Copilot, VS Code, Claude Desktop,
  and most MCP clients"
- Note: "Claude Code support requires schema version configuration"
- Keep implementation simple unless user specifically needs Claude
  Code

### Scenario: New Python MCP Server

**Analysis:**

- Python SDK generates Draft 2020-12 by default
- Works with Claude Code
- Breaks with VS Code, GitHub Copilot, Augment

**Recommendation:**

- Consider whether target users are more likely to use VS Code (most
  common) or Claude Code
- If VS Code support important: implement Draft-07 adapter
- If Claude Code focus: keep default behavior
- Document compatibility clearly

### Scenario: Server Must Support Both VS Code and Claude Code

**Analysis:**

- Strict version conflict
- No single version works for both
- Need flexibility mechanism

**Recommendation:**

- Implement environment variable selection
- Default to Draft-07 (broader compatibility)
- Document how to enable Draft 2020-12 for Claude Code users
- Consider whether this complexity is truly needed (can users just
  choose different server?)

### Scenario: Existing Server with Compatibility Issues

**Analysis:**

- Users reporting tools not appearing
- Check which clients having issues
- Determine current schema version

**Steps:**

1. Identify current schema version being generated
2. Check which clients users need to support
3. Determine if single version can satisfy requirements
4. Implement conversion adapter if needed
5. Add tests for target clients

### Scenario: Maximum Compatibility Required

**Recommendation:**

- Use JSON Schema Draft-07
- Test with multiple clients
- Document tested clients in README
- Avoid Draft 2020-12 specific features

**Why Draft-07:**

- Works with 90%+ of MCP clients (2025)
- Industry standard for tools/APIs
- Proven compatibility
- Easy to upgrade later when ecosystem matures

---

## Code Generation Guidelines

### When Generating Schema Conversion Code

**If creating a Draft-07 adapter:**

- Must remove: `$dynamicRef`, `$dynamicAnchor`
- Must update: `$schema` URL to draft-07
- Consider: `prefixItems` → `items` array conversion
- Consider: `unevaluatedProperties` handling
- Test: Validate output against Draft-07 spec

**If creating a Draft 2020-12 adapter:**

- Simpler: mostly just ensure `$schema` URL is correct
- Can add: modern features if beneficial
- Test: Validate output against 2020-12 spec

### Avoid Hardcoding Assumptions

**Bad:**

```typescript
// Hardcoded without explanation
const adapter = new Draft07Adapter();
```

**Good:**

```typescript
// Use Draft-07 for maximum compatibility with MCP clients (2025)
// GitHub Copilot, VS Code, Augment IDE, and most clients require Draft-07
// See: MCP_CLIENT_COMPATIBILITY_MATRIX.md for details
const adapter = new Draft07Adapter();
```

### Document Architectural Decisions

**Always explain why schema version was chosen:**

- Which clients were prioritized
- Why flexibility was or wasn't implemented
- How to change version if needed
- Links to compatibility documentation

---

## Future MCP Evolution

### What to Watch For

**MCP Specification Updates:**

- Issue #834: Proposes formalizing Draft 2020-12
- PR #881: Attempts to clarify schema requirements
- May introduce capability negotiation in future versions

**Client Updates:**

- VS Code may add Draft 2020-12 support (timeline unclear)
- More clients may adopt 2020-12 as standard
- Ecosystem may converge over time

**When Implementing:**

- Structure code for easy version updates
- Use adapter patterns that can be swapped
- Comment assumptions about client support
- Prepare for eventual migration

### Migration Path Thinking

**If spec formalizes Draft 2020-12:**

- Servers will need to upgrade or maintain legacy version
- Clients will need to update validators
- Transition period will be messy
- Version flexibility will be valuable

**If capability negotiation is added:**

- Servers could detect client requirements
- Ideal solution but requires protocol changes
- Current code should be structured to accommodate this

---

## Anti-Patterns to Avoid

### ❌ Don't: Copy-paste schema conversion code without understanding it

**Why:** Each project has different requirements, type systems, and
constraints. Generic code may not fit.

**Instead:** Understand the conversion needs and generate appropriate
solution for the specific context.

### ❌ Don't: Implement flexibility without clear user need

**Why:** Premature optimization. Most projects target specific
clients.

**Instead:** Ask user about their target clients and implement
accordingly.

### ❌ Don't: Assume MCP Inspector success means universal compatibility

**Why:** Inspector is lenient and accepts both versions. Strict
clients will reject schemas that Inspector accepts.

**Instead:** Test with actual target clients (VS Code, Claude Code,
etc.)

### ❌ Don't: Ignore the `$schema` field

**Why:** Many validators use this to determine validation rules. Wrong
or missing field causes issues.

**Instead:** Always set `$schema` explicitly to match the draft
version you're generating.

### ❌ Don't: Mix Draft-07 and Draft 2020-12 features

**Why:** Creates invalid schemas that may pass lenient validators but
fail strict ones.

**Instead:** Choose one version and use only its features
consistently.

---

## Key Takeaways for Implementation

1. **Ask about target clients first** - Don't assume
2. **Draft-07 is the safe default** for maximum compatibility (2025)
3. **TypeScript SDK generates Draft-07**, Python SDK generates 2020-12
4. **No one-size-fits-all solution** exists due to spec gap
5. **Document your choice clearly** in README
6. **Test with target clients**, not just Inspector
7. **Structure for future evolution** of MCP spec
8. **Keep it simple** unless flexibility is clearly needed

---

## When User Asks About JSON Schema Versions

### Response Template

"I need to understand your MCP client requirements to choose the right
JSON Schema version:

**For maximum compatibility** (GitHub Copilot, VS Code, most clients):
→ Use JSON Schema Draft-07

**For Claude Code specifically**: → Use JSON Schema Draft 2020-12

**For both**: → Need environment variable flexibility (more complex)

Which MCP clients do you plan to use or support?"

---

## Quick Reference

| Requirement            | Schema Version | Works With                | Breaks With               |
| ---------------------- | -------------- | ------------------------- | ------------------------- |
| VS Code/Copilot        | Draft-07       | Most clients              | Claude Code               |
| Claude Code            | Draft 2020-12  | Claude Desktop, Inspector | VS Code, Copilot, Augment |
| Maximum compatibility  | Draft-07       | 90% of clients            | Claude Code only          |
| TypeScript SDK default | Draft-07       | Most clients              | Claude Code               |
| Python SDK default     | Draft 2020-12  | Claude Code               | VS Code, Copilot          |

---

## Additional Resources

**Full compatibility matrix:** See
`MCP_CLIENT_COMPATIBILITY_MATRIX.md` for comprehensive
client-by-client breakdown

**MCP Specification:** https://spec.modelcontextprotocol.io/

**JSON Schema Specs:**

- Draft-07:
  https://json-schema.org/draft-07/json-schema-release-notes.html
- Draft 2020-12:
  https://json-schema.org/draft/2020-12/release-notes.html

**Key Issues:**

- MCP Issue #834: Schema version discussion
- VS Code Issue #251315: Draft 2020-12 support request

---

## Document Purpose Reminder

This document provides **context and decision-making frameworks**, not
prescriptive code.

**When implementing:**

- Analyze the specific project's needs
- Consider the technology stack
- Generate appropriate solutions for that context
- Avoid copy-pasting generic implementations
- Document why decisions were made

**The goal:** Enable informed architectural decisions that balance
compatibility, maintainability, and user needs.

---

**Version:** 1.0.0 **Date:** 2025-01-15 **Status:** Living document
for MCP ecosystem (2025)
