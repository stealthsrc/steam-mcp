import { z } from 'zod';
import { buildApiUrl, buildStoreUrl, steamFetcher } from '../steam/client.js';
import { appIdSchema } from '../utils/schema.js';

// steam_search_game

export const searchGameSchema = z.object({
  query: z.string().min(1).describe('Game name to search for (e.g. "Counter-Strike", "Cyberpunk")'),
  limit: z.number().int().min(1).max(20).default(5).describe('Number of results to return (default: 5, max: 20)'),
});

interface StoreSearchItem {
  id: number;
  name: string;
  type: string;
  tiny_image?: string;
  price?: {
    currency: string;
    initial: number;
    final: number;
    discount_percent: number;
    final_formatted: string;
  };
  metascore?: string;
  platforms?: { windows: boolean; mac: boolean; linux: boolean };
}

interface StoreSearchResponse {
  total: number;
  items: StoreSearchItem[];
}

export async function handleSearchGame(args: unknown): Promise<string> {
  const { query, limit } = searchGameSchema.parse(args);

  const url = buildStoreUrl('api/storesearch/', {
    term: query,
    l: 'english',
    cc: 'US',
  });

  const data = await steamFetcher.fetch<StoreSearchResponse>(url, 300);

  if (!data.items || data.items.length === 0) {
    return `No games found for query "${query}".`;
  }

  const results = data.items.filter((i) => i.type === 'app').slice(0, limit);

  if (results.length === 0) {
    return `No app results found for query "${query}" (found ${data.items.length} non-app items).`;
  }

  const header = '| AppID | Name | Price | Discount | Metascore |';
  const separator = '|-------|------|-------|----------|-----------|';
  const rows = results.map((item) => {
    const priceObj = item.price as Record<string, unknown> | undefined;
    const finalCents = priceObj?.['final'];
    const currency = priceObj?.['currency'] ?? 'USD';
    const price = finalCents != null ? `${currency} ${(Number(finalCents) / 100).toFixed(2)}` : 'Free / N/A';
    const discountVal = priceObj?.['discount_percent'];
    const discount = discountVal && Number(discountVal) > 0 ? `-${discountVal}%` : '—';
    const meta = item.metascore ?? '—';
    return `| ${item.id} | ${item.name} | ${price} | ${discount} | ${meta} |`;
  });

  return [
    `Search results for "${query}" (${data.total} total matches, showing ${results.length}):`,
    '',
    header,
    separator,
    ...rows,
    '',
    'Tip: Use the AppID with other steam tools (e.g. steam_get_achievements, steam_get_game_schema).',
  ].join('\n');
}

// steam_get_current_players

export const getCurrentPlayersSchema = z.object({
  appid: appIdSchema.describe('Steam AppID (e.g. 730 for CS2)'),
});

interface GetCurrentPlayersResponse {
  response: {
    player_count?: number;
    result: number;
  };
}

export async function handleGetCurrentPlayers(args: unknown): Promise<string> {
  const { appid } = getCurrentPlayersSchema.parse(args);

  const url = buildApiUrl('ISteamUserStats', 'GetNumberOfCurrentPlayers', 'v1', {
    appid,
  });

  const data = await steamFetcher.fetch<GetCurrentPlayersResponse>(url, 60);

  if (data.response.result !== 1 || data.response.player_count === undefined) {
    return `Could not retrieve current player count for AppID ${appid}. The game may not exist or have public stats.`;
  }

  const count = data.response.player_count.toLocaleString('en-US');
  return `AppID ${appid} currently has **${count}** players in-game.`;
}
