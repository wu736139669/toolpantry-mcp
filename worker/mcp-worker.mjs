/**
 * Tool Pantry MCP server — Cloudflare Worker (streamable HTTP transport).
 *
 * The same tools as the stdio build, reachable over HTTP so that hosted MCP
 * clients (and the official MCP registry) can use it without a local install.
 *
 *   POST https://mcp.toolpantry.app/mcp   with a JSON-RPC 2.0 body
 *   GET  https://mcp.toolpantry.app/mcp   -> 405 (stateless, POST only)
 */
import { TOOLS, callTool } from '../lib/tools.mjs';

const PROTOCOL_VERSION = '2024-11-05';
const API = 'https://toolpantry.app/api';

const SERVER_INFO = { name: 'toolpantry', version: '1.0.0', homepage: 'https://toolpantry.app' };

const INSTRUCTIONS =
  'Tool Pantry exposes 216 free browser tools that process files locally in the user\'s browser. ' +
  'Call search_tools first to get the exact tool page URL for a file-processing request, then give the user that link. ' +
  'Never claim a file is uploaded - no tool on this site uploads anything.';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, mcp-protocol-version, mcp-session-id, authorization',
  'access-control-expose-headers': 'mcp-session-id',
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

async function handleRpc(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
      instructions: INSTRUCTIONS,
    };
  }
  if (method === 'ping') return {};
  if (method === 'tools/list') return { tools: TOOLS };
  if (method === 'tools/call') {
    try {
      return await callTool(params.name, params.arguments || {}, API);
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    }
  }
  if (id !== undefined) {
    return { error: { code: -32601, message: `Method not found: ${method}` } };
  }
  return null;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({
        ok: true,
        name: 'Tool Pantry MCP server',
        mcp: url.origin + '/mcp',
        tools: TOOLS.map((t) => t.name),
        site: 'https://toolpantry.app',
        repo: 'https://github.com/wu736139669/toolpantry-mcp',
      });
    }

    if (url.pathname !== '/mcp') {
      return json({ error: 'Not found. Use POST /mcp for MCP traffic.' }, 404);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed. This server is stateless: POST JSON-RPC to /mcp.' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
    }

    if (Array.isArray(body)) {
      const out = [];
      for (const msg of body) {
        const result = await handleRpc(msg);
        if (result === null) continue;
        out.push({ jsonrpc: '2.0', id: msg.id ?? null, ...(result.error ? { error: result.error } : { result }) });
      }
      return json(out);
    }

    const result = await handleRpc(body);
    if (result === null) {
      // notification: no id, no body expected
      return new Response(null, { status: 202, headers: CORS });
    }
    return json({
      jsonrpc: '2.0',
      id: body.id ?? null,
      ...(result.error ? { error: result.error } : { result }),
    });
  },
};
