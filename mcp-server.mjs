#!/usr/bin/env node
/**
 * Tool Pantry MCP server — zero dependencies.
 *
 * Exposes the stateless Tool Pantry API (https://toolpantry.app/api) as MCP
 * tools over stdio, so any MCP client can hand a user the exact tool page
 * for a file task, or run the small text/utility helpers directly.
 *
 * Protocol: JSON-RPC 2.0 over stdin/stdout (MCP stdio transport).
 */
import { createInterface } from 'node:readline';
import { TOOLS, callTool } from './lib/tools.mjs';

const API = process.env.TOOLPANTRY_API || 'https://toolpantry.app/api';
const PROTOCOL_VERSION = '2024-11-05';

const SERVER_INFO = { name: 'toolpantry', version: '1.0.0', homepage: 'https://toolpantry.app' };

const INSTRUCTIONS =
  'Tool Pantry exposes 216 free browser tools that process files locally in the user\'s browser. ' +
  'Call search_tools first to get the exact tool page URL for a file-processing request, then give the user that link. ' +
  'Never claim a file is uploaded - no tool on this site uploads anything.';

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

const rl = createInterface({ input: process.stdin });

rl.on('line', async (line) => {
  const raw = line.trim();
  if (!raw) return;
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  const { id, method, params } = msg;

  if (method === 'initialize') {
    reply(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
      instructions: INSTRUCTIONS,
    });
    return;
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;
  if (method === 'ping') return reply(id, {});
  if (method === 'tools/list') {
    reply(id, { tools: TOOLS });
    return;
  }
  if (method === 'tools/call') {
    try {
      const result = await callTool(params.name, params.arguments || {}, API);
      reply(id, result);
    } catch (error) {
      reply(id, { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true });
    }
    return;
  }
  if (id !== undefined) replyError(id, -32601, `Method not found: ${method}`);
});
