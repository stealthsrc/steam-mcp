import { LRUCache } from 'lru-cache';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { internalError, steamApiError } from '../utils/errors.js';

// Allowed hosts — whitelist to prevent SSRF
const ALLOWED_HOSTS = new Set([
  'api.steampowered.com',
  'store.steampowered.com',
  'steamcommunity.com',
]);

// LRU cache with max 500 entries, TTL managed per entry
const cache = new LRUCache<string, object>({ max: 500 });

function getCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

function setCache<T extends object>(key: string, data: T, ttlSeconds: number): void {
  cache.set(key, data, { ttl: ttlSeconds * 1000 });
}

// Sliding window rate limiter
const requestTimestamps: number[] = [];

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const windowMs = 60_000;
  const cutoff = now - windowMs;
  while (requestTimestamps.length > 0 && requestTimestamps[0]! < cutoff) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= config.rateLimitRpm) {
    const oldest = requestTimestamps[0]!;
    const waitMs = oldest + windowMs - now + 50;
    logger.warn('Rate limit reached, waiting', { waitMs });
    await new Promise((r) => setTimeout(r, waitMs));
    // Re-clean after waiting
    const cutoff2 = Date.now() - windowMs;
    while (requestTimestamps.length > 0 && requestTimestamps[0]! < cutoff2) {
      requestTimestamps.shift();
    }
  }
  requestTimestamps.push(Date.now());
}

function redactKey(msg: string): string {
  return msg.replace(config.steamApiKey, '[REDACTED]');
}

async function steamFetch<T extends object>(url: string, ttlSeconds = config.cacheTtlSeconds): Promise<T> {
  // Validate host — prevent SSRF
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw internalError('Invalid Steam API URL');
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw internalError(`Blocked request to disallowed host: ${parsed.hostname}`);
  }

  // Cache lookup using path+search without the API key
  const cacheKey = `${parsed.pathname}${parsed.search.replace(/[?&]key=[^&]+/, '')}`;
  const cached = getCache<T>(cacheKey);
  if (cached !== undefined) {
    logger.debug('Cache hit', { path: parsed.pathname });
    return cached;
  }

  await waitForRateLimit();

  logger.debug('Steam API request', { path: parsed.pathname });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    throw internalError(redactKey(`Network error reaching Steam API: ${String(err)}`));
  }
  clearTimeout(timeout);

  if (!response.ok) {
    throw steamApiError(response.status, parsed.pathname);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw internalError('Steam API returned non-JSON response');
  }

  // Steam often returns 200 OK with error payloads — inspect the body
  if (
    body !== null &&
    typeof body === 'object' &&
    'success' in body &&
    (body as Record<string, unknown>)['success'] === false
  ) {
    const errMsg = (body as Record<string, unknown>)['error'] ?? 'Unknown Steam error';
    throw internalError(`Steam API error: ${String(errMsg)}`);
  }

  setCache(cacheKey, body as T, ttlSeconds);
  return body as T;
}

// Build a Steam Web API URL safely
export function buildApiUrl(
  iface: string,
  method: string,
  version: string,
  params: Record<string, string>
): string {
  const url = new URL(`https://api.steampowered.com/${iface}/${method}/${version}/`);
  url.searchParams.set('key', config.steamApiKey);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

export function buildStoreUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`https://store.steampowered.com/${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

export const steamFetcher = { fetch: steamFetch, buildApiUrl, buildStoreUrl };
