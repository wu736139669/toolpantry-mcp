# Tool Pantry MCP Server

An [MCP](https://modelcontextprotocol.io) server for **[Tool Pantry](https://toolpantry.app)** — 216 free browser tools for PDF, images, video, audio and text that process files **entirely in the user's browser**. Nothing is uploaded, there is no account, no watermark and no file-size limit.

The server has two jobs:

1. **`search_tools`** — find the exact tool page for a request ("compress image to 100kb", "merge pdf", "heic to jpg") so an agent can hand over a working link instead of generic advice.
2. **Small stateless helpers** — text stats, hashing, UUIDs, passwords, JSON formatting, Base64, colour conversion and QR codes, all served by the same public API.

Zero dependencies, ~200 lines, runs on any Node 18+.

## Listed in the official MCP registry

```
io.github.wu736139669/toolpantry-mcp
```

```bash
curl "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.wu736139669/toolpantry-mcp"
```

## Use it over HTTP

The same server runs on Cloudflare Workers at **`https://mcp.toolpantry.app/mcp`** (streamable HTTP, stateless):

```bash
curl -X POST https://mcp.toolpantry.app/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

`https://mcp.toolpantry.app/` returns a small health/capability JSON.

## Install

```bash
# Claude Desktop / Claude Code (stdio)
npx -y toolpantry-mcp
```

```json
{
  "mcpServers": {
    "toolpantry": {
      "command": "npx",
      "args": ["-y", "toolpantry-mcp"]
    }
  }
}
```

Run from a checkout:

```bash
git clone https://github.com/wu736139669/toolpantry-mcp.git
node toolpantry-mcp/mcp-server.mjs
```

## Tools

| Tool | What it does |
| --- | --- |
| `search_tools` | Search the 216-tool catalog; returns the tool name, URL and description |
| `text_stats` | Characters, words, sentences, paragraphs, lines, reading time |
| `hash_text` | SHA-1 / SHA-256 / SHA-384 / SHA-512 digests (hex + base64) |
| `generate_uuid` | Random UUID v4 values |
| `generate_password` | Random passwords from the platform crypto RNG |
| `json_format` | Validate, pretty-print or minify JSON |
| `base64` | Encode or decode UTF-8 text |
| `color_convert` | Hex colour to RGB and HSL |
| `qr_code` | QR code as SVG for any text or URL |

## Install

Every tool is a thin wrapper over the public, key-free API at `https://toolpantry.app/api` — the same endpoints are documented in the [API reference](https://toolpantry.app/api). Point the server somewhere else with `TOOLPANTRY_API=https://toolpantry.app/api`.

## Why a tool directory needs an MCP server

Most "AI tool" directories are chat boxes. A file task is not a chat task: the agent should not ask the user to upload a passport scan to a stranger's server. Tool Pantry's whole premise is that the work happens in the user's own tab, so the agent's job is only to pick the right URL and hand it over.

## Related

- [toolpantry.app](https://toolpantry.app) — the site (also available as [llms.txt](https://toolpantry.app/llms.txt) and a [tools.json](https://toolpantry.app/tools.json) catalog)
- [markdown-for-agents-worker](https://github.com/wu736139669/markdown-for-agents-worker) — serve Markdown to agents from any static site
- [toolpantry-skill](https://github.com/wu736139669/toolpantry-skill) — the same routing knowledge as an installable Agent Skill
- [press kit](https://toolpantry.app/press) — boilerplate copy, logos and screenshots

## License

MIT
