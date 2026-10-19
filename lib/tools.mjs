// Shared tool definitions and API client for the Tool Pantry MCP server.
// Used by both transports: stdio (mcp-server.mjs) and HTTP (worker/mcp-worker.mjs).

const DEFAULT_API = 'https://toolpantry.app/api';

export const TOOLS = [
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

export function endpointFor(name, args) {
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

export async function callTool(name, args, apiBase = DEFAULT_API) {
  const target = endpointFor(name, args || {});
  if (!target) throw new Error(`Unknown tool: ${name}`);
  const [path, query] = target;
  const res = await fetch(`${apiBase}${path}?${query}`, {
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


export async function runTool(name, args, apiBase = DEFAULT_API) {
  const content = await callTool(name, args || {}, apiBase);
  return content;
}
