import { z } from 'zod';
import { buildApiUrl, steamFetcher } from '../steam/client.js';
import { resolveSteamId } from '../steam/resolvers.js';
import { steamIdOrVanitySchema, steamIdSchema } from '../utils/schema.js';
import type { PlayerSummary, FriendEntry, PlayerBan } from '../steam/types.js';

const PERSONA_STATES: Record<number, string> = {
  0: 'Offline', 1: 'Online', 2: 'Busy', 3: 'Away',
  4: 'Snooze', 5: 'Looking to trade', 6: 'Looking to play',
};

function formatDate(ts?: number): string {
  if (!ts) return 'Unknown';
  return new Date(ts * 1000).toISOString().split('T')[0]!;
}

function avatarUrl(hash: string, size: 'small' | 'medium' | 'full' = 'full'): string {
  const suffix = size === 'small' ? '' : size === 'medium' ? '_medium' : '_full';
  return `https://avatars.akamai.steamstatic.com/${hash}${suffix}.jpg`;
}

// steam_resolve_vanity_url

export const resolveVanityUrlSchema = z.object({
  vanity_url: z.string().min(1).describe('Steam vanity URL (e.g. "gabelogannewell")'),
});

export async function handleResolveVanityUrl(args: unknown): Promise<string> {
  const { vanity_url } = resolveVanityUrlSchema.parse(args);
  const steamid = await resolveSteamId(vanity_url);
  return `Vanity URL "${vanity_url}" resolves to SteamID64: ${steamid}`;
}

// steam_get_player_summary

export const getPlayerSummarySchema = z.object({
  steamid: steamIdOrVanitySchema.describe('SteamID64 or vanity URL (e.g. "gabelogannewell" or "76561197960287930")'),
});

interface GetPlayerSummariesResponse {
  response: { players: PlayerSummary[] };
}

export async function handleGetPlayerSummary(args: unknown): Promise<string> {
  const { steamid } = getPlayerSummarySchema.parse(args);
  const resolvedId = await resolveSteamId(steamid);

  const url = buildApiUrl('ISteamUser', 'GetPlayerSummaries', 'v0002', {
    steamids: resolvedId,
  });

  const data = await steamFetcher.fetch<GetPlayerSummariesResponse>(url, 300);
  const players = data.response.players;

  if (!players || players.length === 0) {
    return `No player found for SteamID: ${resolvedId}`;
  }

  const p = players[0]!;
  const isPublic = p.communityvisibilitystate === 3;

  return [
    `Player: ${p.personaname}`,
    `SteamID64: ${p.steamid}`,
    `Status: ${PERSONA_STATES[p.personastate] ?? 'Unknown'}`,
    `Profile visibility: ${isPublic ? 'Public' : 'Private'}`,
    `Profile URL: ${p.profileurl}`,
    `Avatar: ${avatarUrl(p.avatarfull)}`,
    p.lastlogoff ? `Last online: ${formatDate(p.lastlogoff)}` : null,
    p.timecreated ? `Account created: ${formatDate(p.timecreated)}` : null,
    p.loccountrycode ? `Country: ${p.loccountrycode}${p.locstatecode ? ` / ${p.locstatecode}` : ''}` : null,
    p.gameextrainfo ? `Currently playing: ${p.gameextrainfo} (AppID: ${p.gameid})` : null,
  ].filter(Boolean).join('\n');
}

// steam_get_friend_list

export const getFriendListSchema = z.object({
  steamid: steamIdOrVanitySchema.describe('SteamID64 or vanity URL of the player'),
  resolve_names: z.boolean().default(true).describe('Resolve SteamIDs to display names (default: true). Requires one extra API call per 100 friends.'),
});

interface GetFriendListResponse {
  friendslist?: { friends: FriendEntry[] };
}

export async function handleGetFriendList(args: unknown): Promise<string> {
  const { steamid, resolve_names } = getFriendListSchema.parse(args);
  const resolvedId = await resolveSteamId(steamid);

  const url = buildApiUrl('ISteamUser', 'GetFriendList', 'v0001', {
    steamid: resolvedId,
    relationship: 'friend',
  });

  const data = await steamFetcher.fetch<GetFriendListResponse>(url, 300);

  if (!data.friendslist) {
    return `Friend list for ${resolvedId} is private or unavailable.`;
  }

  const friends = data.friendslist.friends;
  if (friends.length === 0) {
    return `${resolvedId} has no friends on their public friend list.`;
  }

  const sorted = [...friends].sort((a, b) => b.friend_since - a.friend_since).slice(0, 50);

  // Resolve names in batches of 100
  let nameMap: Map<string, string> = new Map();
  if (resolve_names) {
    const ids = sorted.map((f) => f.steamid);
    // Batch into groups of 100
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const summaryUrl = buildApiUrl('ISteamUser', 'GetPlayerSummaries', 'v0002', {
        steamids: batch.join(','),
      });
      const summaryData = await steamFetcher.fetch<GetPlayerSummariesResponse>(summaryUrl, 300);
      for (const p of summaryData.response.players) {
        nameMap.set(p.steamid, p.personaname);
      }
    }
  }

  const header = `| # | ${resolve_names ? 'Name | ' : ''}SteamID | Friends since |`;
  const separator = `|---|${resolve_names ? '----|' : ''}---------|---------------|`;
  const rows = sorted.map((f, i) => {
    const name = resolve_names ? nameMap.get(f.steamid) ?? 'Unknown' : null;
    const nameCol = name !== null ? ` ${name} |` : '';
    return `| ${i + 1} |${nameCol} ${f.steamid} | ${formatDate(f.friend_since)} |`;
  });

  return [
    `Friend list for SteamID ${resolvedId} (showing ${sorted.length} of ${friends.length}):`,
    '',
    header,
    separator,
    ...rows,
  ].join('\n');
}

// steam_get_player_bans

export const getPlayerBansSchema = z.object({
  steamids: z
    .union([steamIdSchema, z.array(steamIdSchema).max(100)])
    .describe('One SteamID64 or an array of up to 100 SteamID64s'),
});

interface GetPlayerBansResponse {
  players: PlayerBan[];
}

export async function handleGetPlayerBans(args: unknown): Promise<string> {
  const { steamids } = getPlayerBansSchema.parse(args);
  const ids = Array.isArray(steamids) ? steamids : [steamids];

  const url = buildApiUrl('ISteamUser', 'GetPlayerBans', 'v1', {
    steamids: ids.join(','),
  });

  const data = await steamFetcher.fetch<GetPlayerBansResponse>(url, 60);

  const header = '| SteamID | VAC Banned | VAC Bans | Game Bans | Community Banned | Economy | Days Since Ban |';
  const separator = '|---------|-----------|----------|-----------|-----------------|---------|----------------|';
  const rows = data.players.map((p) => {
    const vac = p.VACBanned ? `Yes (${p.NumberOfVACBans})` : 'No';
    const game = p.NumberOfGameBans > 0 ? `Yes (${p.NumberOfGameBans})` : 'No';
    const comm = p.CommunityBanned ? 'Yes' : 'No';
    const days = p.DaysSinceLastBan > 0 ? String(p.DaysSinceLastBan) : '—';
    return `| ${p.SteamId} | ${vac} | ${p.NumberOfVACBans} | ${game} | ${comm} | ${p.EconomyBan} | ${days} |`;
  });

  return [header, separator, ...rows].join('\n');
}
