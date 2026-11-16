import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { AGENT_LIMITS, AGENT_PROTOCOL_VERSION, AGENT_REFRESH_MESSAGE, agentAvailability, canonicalAgentCase } from '../../../lib/operations-agent';
import { AgentRunError, runInvestigation } from '../../../lib/operations-agent-runner';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
// A per-worker concurrency guard, not a global rate limit or account-wide spending cap.
let busy = false;
export function GET() { return NextResponse.json(agentAvailability(process.env), { headers }); }
export async function POST(request: Request) {
  if (!agentAvailability(process.env).enabled) return NextResponse.json({ error: 'Live investigation is not enabled in this environment.', code: 'disabled' }, { status: 403, headers });
  if (request.headers.get('origin') !== new URL(request.url).origin || !request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'Use this workspace to start an investigation.', code: 'invalid_origin' }, { status: 403, headers });
  if (request.headers.get('x-lighthouse-agent-protocol') !== AGENT_PROTOCOL_VERSION) return NextResponse.json({ error: AGENT_REFRESH_MESSAGE, code: 'outdated_page' }, { status: 409, headers });
  if (busy) return NextResponse.json({ error: 'An investigation is already running on this worker. Try again after it finishes.', code: 'busy' }, { status: 429, headers });
  let raw = '';
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error('body');
    let bytes = 0; const decoder = new TextDecoder();
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > AGENT_LIMITS.bodyBytes) { await reader.cancel(); return NextResponse.json({ error: 'Case evidence is too large.', code: 'body_limit' }, { status: 413, headers }); }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
  } catch { return NextResponse.json({ error: 'The case could not be read.', code: 'invalid_body' }, { status: 400, headers }); }
  let input;
  try { input = canonicalAgentCase(JSON.parse(raw).case); } catch { /* handled below */ }
  if (!input) return NextResponse.json({ error: 'The case evidence is invalid. Restore the sample or correct its fields.', code: 'invalid_case' }, { status: 400, headers });
  if (busy) return NextResponse.json({ error: 'An investigation is already running on this worker. Try again after it finishes.', code: 'busy' }, { status: 429, headers });
  // Construct only after access, origin, body, and case validation. No browser receives the provider key.
  busy = true;
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), AGENT_LIMITS.timeoutMs);
  const cancel = () => abort.abort();
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) abort.abort();
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, maxRetries: 0, timeout: AGENT_LIMITS.timeoutMs });
    const run = await runInvestigation(input, (params, signal) => client.messages.create(params, { signal }), abort.signal);
    return NextResponse.json({ run }, { headers });
  } catch (err) {
    if (err instanceof AgentRunError) return NextResponse.json({ error: err.message, code: err.code, trace: err.trace, usage: err.usage }, { status: err.code === 'cancelled' ? 504 : 502, headers });
    return NextResponse.json({ error: 'The investigation could not be completed. No AI drafts were applied.', code: 'internal' }, { status: 500, headers });
  } finally { busy = false; clearTimeout(timeout); request.signal.removeEventListener('abort', cancel); }
}
