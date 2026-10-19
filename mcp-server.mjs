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

const API = process.env.TOOLPANTRY_API || 'https://toolpantry.app/api';
const PROTOCOL_VERSION = '2024-11-05';

const TOOLS = [
  {
    name: 'search_tools',
    description:
      'Search the Tool Pantry catalog of 216 free browser tools for PDF, images, video, audio and text. Use this first: it returns the exact tool page URL for a user request (e.g. "compress image to 100kb", "merge pdf", "heic to jpg").',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Search words, e.g. "compress pdf" or "passport photo"' },
        limit: { type: 'number', description: 'Max results (default 10, max 50)' },
      },
      required: ['q'],
    },
  },
  {
    name: 'text_stats',
    description: 'Count characters, words, sentences, paragraphs, lines and reading time for a piece of text.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Text to measure' } },
      required: ['text'],
    },
  },
  {
    name: 'hash_text',
    description: 'Hash a string with SHA-1, SHA-256, SHA-384 or SHA-512. Returns hex and base64 digests.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to hash' },
        algo: { type: 'string', enum: ['sha1', 'sha256', 'sha384', 'sha512'], description: 'Default sha256' },
      },
      required: ['text'],
    },
  },
  {
    name: 'generate_uuid',
    description: 'Generate random UUID v4 values.',
    inputSchema: {
      type: 'object',
      properties: { count: { type: 'number', description: 'How many UUIDs (1-50, default 1)' } },
    },
  },
  {
    name: 'generate_password',
    description: 'Generate random passwords using the platform crypto RNG.',
    inputSchema: {
      type: 'object',
      properties: {
        length: { type: 'number', description: 'Password length (4-128, default 20)' },
        count: { type: 'number', description: 'How many (1-20, default 1)' },
      },
    },
  },
  {
    name: 'json_format',
    description: 'Validate, pretty-print or minify a JSON string.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'JSON string' },
        mode: { type: 'string', enum: ['validate', 'pretty', 'minify'], description: 'Default pretty' },
      },
      required: ['text'],
    },
  },
  {
    name: 'base64',
    description: 'Base64 encode or decode UTF-8 text.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to encode or decode' },
        mode: { type: 'string', enum: ['encode', 'decode'], description: 'Default encode' },
      },
      required: ['text'],
    },
  },
  {
    name: 'color_convert',
    description: 'Convert a hex colour to RGB and HSL.',
    inputSchema: {
      type: 'object',
      properties: { hex: { type: 'string', description: 'Hex colour, e.g. e36d3f or #e36d3f' } },
      required: ['hex'],
    },
  },
  {
    name: 'qr_code',
    description: 'Generate a QR code for any text or URL. Returns SVG markup (or JSON with the SVG string).',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text or URL to encode' },
        size: { type: 'number', description: 'Pixel size (default 256)' },
        format: { type: 'string', enum: ['svg', 'json'], description: 'Default svg' },
      },
      required: ['text'],
    },
  },
];

function endpointFor(name, args) {
  const q = new URLSearchParams();
  switch (name) {
    case 'search_tools':
      q.set('q', args.q ?? '');
      if (args.limit) q.set('limit', String(args.limit));
      return ['/tools', q];
    case 'text_stats': q.set('text', args.text ?? ''); return ['/stats', q];
    case 'hash_text': q.set('text', args.text ?? ''); q.set('algo', args.algo || 'sha256'); return ['/hash', q];
    case 'generate_uuid': q.set('count', String(args.count ?? 1)); return ['/uuid', q];
    case 'generate_password':
      q.set('length', String(args.length ?? 20));
      q.set('count', String(args.count ?? 1));
      return ['/password', q];
    case 'json_format': q.set('text', args.text ?? ''); q.set('mode', args.mode || 'pretty'); return ['/json', q];
    case 'base64': q.set('text', args.text ?? ''); q.set('mode', args.mode || 'encode'); return ['/base64', q];
    case 'color_convert': q.set('hex', args.hex ?? ''); return ['/color', q];
    case 'qr_code':
      q.set('text', args.text ?? '');
      if (args.size) q.set('size', String(args.size));
      q.set('format', args.format || 'svg');
      return ['/qr', q];
    default: return null;
  }
}

async function callTool(name, args) {
  const target = endpointFor(name, args || {});
  if (!target) throw new Error(`Unknown tool: ${name}`);
  const [path, query] = target;
  const res = await fetch(`${API}${path}?${query}`, {
    headers: { accept: 'application/json, text/plain' },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Tool Pantry API ${res.status}: ${body.slice(0, 300)}`);
  if (name === 'qr_code' && (args.format || 'svg') === 'svg') {
    return { content: [{ type: 'text', text: body.slice(0, 4000) }] };
  }
  try {
    return { content: [{ type: 'text', text: JSON.stringify(JSON.parse(body), null, 2) }] };
  } catch {
    return { content: [{ type: 'text', text: body }] };
  }
}

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
      serverInfo: { name: 'toolpantry', version: '1.0.0', homepage: 'https://toolpantry.app' },
      instructions:
        'Tool Pantry exposes 216 free browser tools that process files locally in the user\'s browser. ' +
        'Call search_tools first to get the exact tool page URL for a file-processing request, then give the user that link. ' +
        'Never claim a file is uploaded - no tool on this site uploads anything.',
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
      const result = await callTool(params.name, params.arguments || {});
      reply(id, result);
    } catch (error) {
      reply(id, { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true });
    }
    return;
  }
  if (id !== undefined) replyError(id, -32601, `Method not found: ${method}`);
});
