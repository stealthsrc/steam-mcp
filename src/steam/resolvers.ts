import { buildApiUrl, steamFetcher } from './client.js';
import { invalidParams } from '../utils/errors.js';

const STEAMID64_RE = /^7656119[0-9]{10}$/;

interface VanityResponse {
  response: {
    success: number;
    steamid?: string;
    message?: string;
  };
}

/**
 * Resolves a vanity URL or passes through a valid SteamID64.
 * Always returns a SteamID64 string.
 */
export async function resolveSteamId(input: string): Promise<string> {
  if (STEAMID64_RE.test(input)) {
    return input;
  }

  // Treat as vanity URL
  const url = buildApiUrl('ISteamUser', 'ResolveVanityURL', 'v0001', {
    vanityurl: input,
  });

  const data = await steamFetcher.fetch<VanityResponse>(url, 600);

  if (data.response.success !== 1 || !data.response.steamid) {
    throw invalidParams(
      `Could not resolve vanity URL "${input}": ${data.response.message ?? 'not found'}`
    );
  }

  return data.response.steamid;
}
