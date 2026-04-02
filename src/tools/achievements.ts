import { z } from 'zod';
import { buildApiUrl, steamFetcher } from '../steam/client.js';
import { resolveSteamId } from '../steam/resolvers.js';
import { steamIdOrVanitySchema, appIdSchema, languageSchema } from '../utils/schema.js';
import type { Achievement, GlobalAchievementStat, GameSchema } from '../steam/types.js';

// steam_get_achievements

export const getAchievementsSchema = z.object({
  steamid: steamIdOrVanitySchema.describe('SteamID64 or vanity URL'),
  appid: appIdSchema.describe('Steam AppID (e.g. 730 for CS2)'),
  language: languageSchema.describe('Language for achievement names (default: english)'),
  status: z.enum(['unlocked', 'locked', 'all']).default('unlocked').describe('Filter achievements by status: unlocked, locked, or all (default: unlocked)'),
});

interface GetPlayerAchievementsResponse {
  playerstats: {
    steamID: string;
    gameName: string;
    achievements?: Achievement[];
    success: boolean;
    error?: string;
  };
}

export async function handleGetAchievements(args: unknown): Promise<string> {
  const { steamid, appid, language, status } = getAchievementsSchema.parse(args);
  const resolvedId = await resolveSteamId(steamid);

  const url = buildApiUrl('ISteamUserStats', 'GetPlayerAchievements', 'v0001', {
    steamid: resolvedId,
    appid,
    l: language,
  });

  const data = await steamFetcher.fetch<GetPlayerAchievementsResponse>(url, 60);
  const { playerstats } = data;

  if (!playerstats.success || !playerstats.achievements) {
    return `Could not fetch achievements for ${playerstats.gameName ?? `AppID ${appid}`}: ${playerstats.error ?? 'Profile may be private or game has no achievements.'}`;
  }

  const all = playerstats.achievements;
  const achieved = all.filter((a) => a.achieved === 1);
  const locked = all.filter((a) => a.achieved === 0);
  const total = all.length;
  const pct = total > 0 ? ((achieved.length / total) * 100).toFixed(1) : '0';

  const toShow = status === 'unlocked' ? achieved : status === 'locked' ? locked : all;
  const displayList = status === 'unlocked'
    ? [...toShow].sort((a, b) => b.unlocktime - a.unlocktime).slice(0, 20)
    : toShow.slice(0, 30);

  const header = status === 'unlocked'
    ? '| Achievement | Unlocked on |'
    : '| Achievement | Status |';
  const separator = status === 'unlocked'
    ? '|-------------|-------------|'
    : '|-------------|--------|';

  const rows = displayList.map((a) => {
    const name = a.name ?? a.apiname;
    if (status === 'all') {
      const s = a.achieved === 1 ? `✓ ${new Date(a.unlocktime * 1000).toISOString().split('T')[0]}` : '✗ Locked';
      return `| ${name} | ${s} |`;
    }
    if (status === 'unlocked') {
      const date = new Date(a.unlocktime * 1000).toISOString().split('T')[0]!;
      return `| ${name} | ${date} |`;
    }
    return `| ${name} | ✗ Locked |`;
  });

  const shownLabel = displayList.length < toShow.length
    ? ` (showing ${displayList.length} of ${toShow.length})`
    : '';

  return [
    `Achievements for ${playerstats.gameName} (AppID ${appid}) — SteamID ${resolvedId}`,
    `Progress: ${achieved.length}/${total} (${pct}%) — ${locked.length} locked`,
    `Filter: ${status}${shownLabel}`,
    '',
    header,
    separator,
    ...rows,
  ].join('\n');
}

// steam_get_global_achievement_stats

export const getGlobalAchievementStatsSchema = z.object({
  appid: appIdSchema.describe('Steam AppID'),
});

interface GetGlobalAchievementStatsResponse {
  achievementpercentages?: {
    achievements: GlobalAchievementStat[];
  };
}

export async function handleGetGlobalAchievementStats(args: unknown): Promise<string> {
  const { appid } = getGlobalAchievementStatsSchema.parse(args);

  const url = buildApiUrl('ISteamUserStats', 'GetGlobalAchievementPercentagesForApp', 'v0002', {
    gameid: appid,
  });

  const data = await steamFetcher.fetch<GetGlobalAchievementStatsResponse>(url, 3600);

  if (!data.achievementpercentages?.achievements?.length) {
    return `No global achievement stats available for AppID ${appid}.`;
  }

  const stats = data.achievementpercentages.achievements;
  const sorted = [...stats].sort((a, b) => Number(b.percent) - Number(a.percent));

  const easiest = sorted.slice(0, 10);
  const hardest = sorted.slice(-10).reverse();

  const header = '| Achievement | Global % |';
  const separator = '|-------------|----------|';
  const easyRows = easiest.map((a) => `| ${a.name} | ${Number(a.percent).toFixed(1)}% |`);
  const hardRows = hardest.map((a) => `| ${a.name} | ${Number(a.percent).toFixed(1)}% |`);

  return [
    `Global achievement stats for AppID ${appid} (${stats.length} total achievements):`,
    '',
    '**Easiest** (most players have these):',
    header,
    separator,
    ...easyRows,
    '',
    '**Hardest** (fewest players have these):',
    header,
    separator,
    ...hardRows,
  ].join('\n');
}

// steam_get_game_schema

export const getGameSchemaSchema = z.object({
  appid: appIdSchema.describe('Steam AppID'),
  language: languageSchema.describe('Language for names (default: english)'),
});

interface GetSchemaForGameResponse {
  game: GameSchema;
}

export async function handleGetGameSchema(args: unknown): Promise<string> {
  const { appid, language } = getGameSchemaSchema.parse(args);

  const url = buildApiUrl('ISteamUserStats', 'GetSchemaForGame', 'v2', {
    appid,
    l: language,
  });

  const data = await steamFetcher.fetch<GetSchemaForGameResponse>(url, 3600);
  const { game } = data;

  if (!game.gameName) {
    return `No schema found for AppID ${appid}. The game may not have stats/achievements via the API.`;
  }

  const achievements = game.availableGameStats?.achievements ?? [];
  const stats = game.availableGameStats?.stats ?? [];

  const header = '| Achievement | Hidden | Description |';
  const separator = '|-------------|--------|-------------|';
  const achRows = achievements.slice(0, 20).map((a) =>
    `| ${a.displayName} | ${a.hidden ? 'Yes' : 'No'} | ${a.description ?? '—'} |`
  );

  return [
    `Game schema for ${game.gameName} (AppID ${appid}):`,
    `Version: ${game.gameVersion} | Achievements: ${achievements.length} | Stats: ${stats.length}`,
    '',
    achievements.length > 0 ? `First ${Math.min(20, achievements.length)} achievements:` : 'No achievements.',
    ...(achievements.length > 0 ? [header, separator, ...achRows] : []),
  ].join('\n');
}
