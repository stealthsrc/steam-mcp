import { z } from 'zod';
import { buildApiUrl, steamFetcher } from '../steam/client.js';
import { resolveSteamId } from '../steam/resolvers.js';
import { steamIdOrVanitySchema } from '../utils/schema.js';
import type { OwnedGame, RecentlyPlayedGame } from '../steam/types.js';

function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// steam_get_owned_games

export const getOwnedGamesSchema = z.object({
  steamid: steamIdOrVanitySchema.describe('SteamID64 or vanity URL'),
  include_appinfo: z.boolean().default(true).describe('Include game names and icons (default: true)'),
  limit: z.number().int().min(1).max(500).default(50).describe('Max games to return (default: 50, max: 500)'),
  sort_by: z.enum(['playtime', 'name', 'last_played']).default('playtime').describe('Sort order (default: playtime)'),
  played_only: z.boolean().default(false).describe('Only return games with at least 1 minute of playtime'),
});

interface GetOwnedGamesResponse {
  response: {
    game_count?: number;
    games?: OwnedGame[];
  };
}

export async function handleGetOwnedGames(args: unknown): Promise<string> {
  const { steamid, include_appinfo, limit, sort_by, played_only } = getOwnedGamesSchema.parse(args);
  const resolvedId = await resolveSteamId(steamid);

  const url = buildApiUrl('IPlayerService', 'GetOwnedGames', 'v0001', {
    steamid: resolvedId,
    include_appinfo: include_appinfo ? '1' : '0',
    include_played_free_games: '1',
  });

  const data = await steamFetcher.fetch<GetOwnedGamesResponse>(url, 600);
  const { game_count, games } = data.response;

  if (!games || games.length === 0) {
    return `No games found for SteamID ${resolvedId}. The library may be private.`;
  }

  let filtered = played_only ? games.filter((g) => g.playtime_forever > 0) : games;

  filtered = filtered.sort((a, b) => {
    if (sort_by === 'playtime') return b.playtime_forever - a.playtime_forever;
    if (sort_by === 'last_played') return (b.rtime_last_played ?? 0) - (a.rtime_last_played ?? 0);
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  const shown = filtered.slice(0, limit);
  const neverPlayed = games.filter((g) => g.playtime_forever === 0).length;

  const header = '| # | Game | AppID | Playtime |';
  const separator = '|---|------|-------|----------|';
  const rows = shown.map((g, i) => {
    const name = g.name ?? `AppID ${g.appid}`;
    return `| ${i + 1} | ${name} | ${g.appid} | ${formatPlaytime(g.playtime_forever)} |`;
  });

  return [
    `Library for SteamID ${resolvedId}: ${game_count ?? games.length} total games (${neverPlayed} never played)`,
    `Showing ${shown.length} of ${filtered.length} (sorted by ${sort_by}):`,
    '',
    header,
    separator,
    ...rows,
  ].join('\n');
}

// steam_get_recently_played

export const getRecentlyPlayedSchema = z.object({
  steamid: steamIdOrVanitySchema.describe('SteamID64 or vanity URL'),
  count: z.number().int().min(1).max(20).default(10).describe('Number of games to return (default: 10, max: 20)'),
});

interface GetRecentlyPlayedResponse {
  response: {
    total_count?: number;
    games?: RecentlyPlayedGame[];
  };
}

export async function handleGetRecentlyPlayed(args: unknown): Promise<string> {
  const { steamid, count } = getRecentlyPlayedSchema.parse(args);
  const resolvedId = await resolveSteamId(steamid);

  const url = buildApiUrl('IPlayerService', 'GetRecentlyPlayedGames', 'v0001', {
    steamid: resolvedId,
    count: String(count),
  });

  const data = await steamFetcher.fetch<GetRecentlyPlayedResponse>(url, 60);
  const { games, total_count } = data.response;

  if (!games || games.length === 0) {
    return `No recently played games found for SteamID ${resolvedId}. The profile may be private.`;
  }

  const header = '| # | Game | AppID | Last 2 weeks | Total playtime |';
  const separator = '|---|------|-------|--------------|----------------|';
  const rows = games.map((g, i) => {
    const recent = g.playtime_2weeks ? formatPlaytime(g.playtime_2weeks) : '—';
    return `| ${i + 1} | ${g.name} | ${g.appid} | ${recent} | ${formatPlaytime(g.playtime_forever)} |`;
  });

  return [
    `Recently played (last 2 weeks) — SteamID ${resolvedId} (${total_count ?? games.length} total):`,
    '',
    header,
    separator,
    ...rows,
  ].join('\n');
}
