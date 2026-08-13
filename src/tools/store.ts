import { z } from 'zod';
import { buildApiUrl, buildStoreUrl, steamFetcher } from '../steam/client.js';
import { appIdSchema, steamIdOrVanitySchema } from '../utils/schema.js';
import { formatOutput, markdownTable, type OutputFormat } from '../utils/format.js';
import { buildProfileDataset, analyzeDataset } from './profile-data.js';
import { getGameDetailsData, type GameDetails } from '../steam/store-data.js';

// steam_search_game

export const searchGameSchema = z.object({
  query: z.string().min(1).describe('Game name to search for (e.g. "Counter-Strike", "Cyberpunk")'),
  limit: z.number().int().min(1).max(20).default(5).describe('Number of results to return (default: 5, max: 20)'),
});

const formatSchema = z.enum(['markdown', 'json']).default('markdown');

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

// steam_get_game_details

export const getGameDetailsSchema = z.object({
  appid: appIdSchema.describe('Steam AppID'),
  country: z.string().length(2).default('US').describe('Two-letter country code for prices (default: US)'),
  language: z.string().min(2).max(20).default('english').describe('Steam language (default: english)'),
  format: formatSchema.describe('Output format: markdown or json'),
});

export async function handleGetGameDetails(args: unknown): Promise<string> {
  const { appid, country, language, format } = getGameDetailsSchema.parse(args);
  const details = await getGameDetailsData(appid, country, language);
  if (!details) return `No Steam appdetails found for AppID ${appid}.`;
  return formatOutput(details, format as OutputFormat, gameDetailsMarkdown(details));
}

// steam_search_any

export const searchAnySchema = z.object({
  query: z.string().min(1).describe('Steam search term'),
  limit: z.number().int().min(1).max(20).default(10),
  category: z.enum(['all', 'app', 'game', 'dlc', 'software', 'demo']).default('all'),
  country: z.string().length(2).default('US'),
  language: z.string().min(2).max(20).default('english'),
  max_price: z.number().min(0).optional().describe('Max final price in major currency units'),
  platform: z.enum(['windows', 'mac', 'linux']).optional(),
  format: formatSchema.describe('Output format: markdown or json'),
});

export async function handleSearchAny(args: unknown): Promise<string> {
  const { query, limit, category, country, language, max_price, platform, format } = searchAnySchema.parse(args);
  const url = buildStoreUrl('api/storesearch/', { term: query, l: language, cc: country });
  const data = await steamFetcher.fetch<StoreSearchResponse>(url, 300);
  const categoryNeedsDetails = !['all', 'app'].includes(category);
  const candidates = data.items.filter((item) =>
    category === 'all' || categoryNeedsDetails || item.type === category
  );
  const results: Array<StoreSearchItem & { details?: GameDetails }> = [];

  for (const item of candidates) {
    if (results.length >= limit) break;
    if (platform && item.platforms && !item.platforms[platform]) continue;
    const details = max_price !== undefined || categoryNeedsDetails
      ? await getGameDetailsData(String(item.id), country, language)
      : undefined;
    if (categoryNeedsDetails && details?.type !== category) continue;
    const final = details?.price_overview?.final ?? item.price?.final;
    if (max_price !== undefined && final !== undefined && final / 100 > max_price) continue;
    results.push({ ...item, details });
  }

  const output = { query, total: data.total, returned: results.length, results };
  return formatOutput(output, format as OutputFormat, searchAnyMarkdown(query, data.total, results));
}

// steam_recommend_games

export const recommendGamesSchema = z.object({
  steamid: steamIdOrVanitySchema.describe('SteamID64 or vanity URL'),
  limit: z.number().int().min(1).max(20).default(10),
  country: z.string().length(2).default('US'),
  language: z.string().min(2).max(20).default('english'),
  max_price: z.number().min(0).optional(),
  require_discount: z.boolean().default(false),
  min_current_players: z.number().int().min(0).optional(),
  format: formatSchema.describe('Output format: markdown or json'),
});

export async function handleRecommendGames(args: unknown): Promise<string> {
  const { steamid, limit, country, language, max_price, require_discount, min_current_players, format } = recommendGamesSchema.parse(args);
  const dataset = await buildProfileDataset(steamid, {
    include_friends: false,
    include_games: true,
    include_recent: true,
    include_bans: false,
    include_achievements: false,
    achievement_game_limit: 0,
  });
  const analysis = await analyzeDataset(dataset, false);
  const owned = new Set((dataset.owned_games ?? []).map((g) => g.appid));
  const seeds = analysis.favorite_genres.length > 0
    ? analysis.favorite_genres.slice(0, 3).map((g) => g.name)
    : analysis.top_games.slice(0, 3).map((g) => g.name ?? String(g.appid));
  const candidates = new Map<number, StoreSearchItem>();

  for (const seed of seeds) {
    const url = buildStoreUrl('api/storesearch/', { term: seed, l: language, cc: country });
    const data = await steamFetcher.fetch<StoreSearchResponse>(url, 300);
    for (const item of data.items) {
      if (item.type === 'app' && !owned.has(item.id)) candidates.set(item.id, item);
    }
  }

  const scored: Array<{
    appid: number;
    name: string;
    score: number;
    price?: string;
    discount_percent?: number;
    current_players?: number;
    reasons: string[];
  }> = [];

  for (const item of candidates.values()) {
    const details = await getGameDetailsData(String(item.id), country, language);
    if (!details || details.type !== 'game') continue;
    const price = details.price_overview;
    if (max_price !== undefined && price && price.final / 100 > max_price) continue;
    if (require_discount && (!price || price.discount_percent <= 0)) continue;

    let currentPlayers: number | undefined;
    if (min_current_players !== undefined) {
      currentPlayers = await getCurrentPlayersCount(String(item.id));
      if ((currentPlayers ?? 0) < min_current_players) continue;
    }

    let score = 0;
    const reasons: string[] = [];
    for (const genre of analysis.favorite_genres) {
      if (details.genres?.some((g) => g.description === genre.name)) {
        score += 10 + genre.score;
        reasons.push(`matches ${genre.name}`);
      }
    }
    if (price?.discount_percent) {
      score += price.discount_percent / 5;
      reasons.push(`${price.discount_percent}% discount`);
    }
    if (details.recommendations?.total) score += Math.min(20, details.recommendations.total / 10000);
    if (currentPlayers) {
      score += Math.min(20, currentPlayers / 10000);
      reasons.push(`${currentPlayers.toLocaleString('en-US')} current players`);
    }
    if (score > 0) {
      scored.push({
        appid: item.id,
        name: details.name,
        score: Math.round(score),
        price: price?.final_formatted,
        discount_percent: price?.discount_percent,
        current_players: currentPlayers,
        reasons: reasons.slice(0, 3),
      });
    }
    if (scored.length >= limit * 3) break;
  }

  const recommendations = scored.sort((a, b) => b.score - a.score).slice(0, limit);
  const output = { steamid: dataset.metadata.steamid, based_on: analysis.favorite_genres, recommendations };
  return formatOutput(output, format as OutputFormat, recommendationsMarkdown(recommendations));
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

async function getCurrentPlayersCount(appid: string): Promise<number | undefined> {
  const url = buildApiUrl('ISteamUserStats', 'GetNumberOfCurrentPlayers', 'v1', { appid });
  const data = await steamFetcher.fetch<GetCurrentPlayersResponse>(url, 60);
  return data.response.result === 1 ? data.response.player_count : undefined;
}

function gameDetailsMarkdown(details: GameDetails): string {
  const price = details.price_overview?.final_formatted ?? (details.is_free ? 'Free' : 'N/A');
  const platforms = details.platforms
    ? Object.entries(details.platforms).filter(([, ok]) => ok).map(([name]) => name).join(', ')
    : 'Unknown';
  return [
    `${details.name} (AppID ${details.steam_appid})`,
    `Type: ${details.type}`,
    `Release: ${details.release_date?.date ?? 'Unknown'}`,
    `Price: ${price}${details.price_overview?.discount_percent ? ` (${details.price_overview.discount_percent}% off)` : ''}`,
    `Developers: ${details.developers?.join(', ') ?? 'Unknown'}`,
    `Publishers: ${details.publishers?.join(', ') ?? 'Unknown'}`,
    `Genres: ${details.genres?.map((g) => g.description).join(', ') ?? 'Unknown'}`,
    `Categories: ${details.categories?.map((c) => c.description).join(', ') ?? 'Unknown'}`,
    `Platforms: ${platforms}`,
    details.recommendations ? `Recommendations: ${details.recommendations.total.toLocaleString('en-US')}` : null,
    details.metacritic ? `Metacritic: ${details.metacritic.score}` : null,
    `Store: https://store.steampowered.com/app/${details.steam_appid}`,
    '',
    details.short_description ?? '',
  ].filter((line): line is string => line !== null).join('\n');
}

function searchAnyMarkdown(query: string, total: number, results: Array<StoreSearchItem & { details?: GameDetails }>): string {
  if (results.length === 0) return `No Steam results found for "${query}".`;
  return [
    `Steam search for "${query}" (${total} total matches, showing ${results.length}):`,
    '',
    ...markdownTable(['AppID', 'Type', 'Name', 'Price', 'Platforms'], results.map((item) => [
      item.id,
      item.details?.type ?? item.type,
      item.name,
      item.details?.price_overview?.final_formatted ?? item.price?.final_formatted ?? 'Free / N/A',
      item.platforms
        ? Object.entries(item.platforms).filter(([, ok]) => ok).map(([name]) => name).join(', ')
        : 'Unknown',
    ])),
  ].join('\n');
}

function recommendationsMarkdown(recommendations: Array<{ appid: number; name: string; score: number; price?: string; reasons: string[] }>): string {
  if (recommendations.length === 0) return 'No recommendations found with the requested filters.';
  return [
    'Recommended Steam games:',
    '',
    ...markdownTable(['Score', 'AppID', 'Game', 'Price', 'Why'], recommendations.map((item) => [
      item.score,
      item.appid,
      item.name,
      item.price ?? 'N/A',
      item.reasons.join(', ') || 'similar to played games',
    ])),
  ].join('\n');
}
