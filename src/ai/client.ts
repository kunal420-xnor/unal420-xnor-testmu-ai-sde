import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

export type AiMode = 'live' | 'mock';

/** live if a key is present (or forced), otherwise deterministic mock. */
export function resolveMode(): AiMode {
  const forced = (process.env.AI_MODE || 'auto').toLowerCase();
  if (forced === 'mock') return 'mock';
  if (forced === 'live') return 'live';
  return process.env.ANTHROPIC_API_KEY ? 'live' : 'mock';
}

const MODEL = process.env.AI_MODEL || 'claude-3-5-haiku-latest';

export interface AskOptions {
  system?: string;
  maxTokens?: number;
  /** Deterministic output returned in mock mode (no key / AI_MODE=mock). */
  mock: string;
}

/**
 * Every LLM call in this framework funnels through here. That's deliberate:
 * one place to swap providers, add retries/caching, enforce mock mode, and
 * keep the whole suite runnable without credentials.
 */
export async function ask(prompt: string, opts: AskOptions): Promise<string> {
  if (resolveMode() === 'mock') return opts.mock;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: [{ role: 'user', content: prompt }],
  });

  return msg.content
    .map((block: any) => (block.type === 'text' ? block.text : ''))
    .join('\n')
    .trim();
}

/** Ask for JSON and parse defensively (tolerates code fences / stray prose). */
export async function askJson<T>(prompt: string, opts: AskOptions): Promise<T> {
  return parseJson<T>(await ask(prompt, opts));
}

export function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const objStart = cleaned.indexOf('{');
  const arrStart = cleaned.indexOf('[');
  const begin =
    arrStart !== -1 && (arrStart < objStart || objStart === -1) ? arrStart : objStart;
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  const slice = begin !== -1 && end !== -1 ? cleaned.slice(begin, end + 1) : cleaned;
  return JSON.parse(slice) as T;
}

export const aiMeta = () => ({ mode: resolveMode(), model: MODEL });
