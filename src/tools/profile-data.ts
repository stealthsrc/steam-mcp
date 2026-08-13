import { z } from 'zod';
import { buildApiUrl, steamFetcher } from '../steam/client.js';
import { resolveSteamId } from '../steam/resolvers.js';
import { steamIdOrVanitySchema } from '../utils/schema.js';
import { formatDate, formatOutput, formatPlaytime, markdownTable, type OutputFormat } from '../utils/format.js';
import type { Achievement, FriendEntry, OwnedGame, PlayerBan, PlayerSummary, RecentlyPlayedGame } from '../steam/types.js';
import { getGameDetailsData } from '../steam/store-data.js';

const formatSchema = z.enum(['markdown', 'json']).default('markdown');

interface GetPlayerSummariesResponse {
  response: { players: PlayerSummary[] };
}

interface GetPlayerBansResponse {
  players: PlayerBan[];
}

interface GetFriendListResponse {
  friendslist?: { friends: FriendEntry[] };
}

interface GetOwnedGamesResponse {
  response: {
    game_count?: number;
    games?: OwnedGame[];
  };
}

interface GetRecentlyPlayedResponse {
  response: {
    total_count?: number;
    games?: RecentlyPlayedGame[];
  };
}

interface GetPlayerAchievementsResponse {
  playerstats: {
    gameName?: string;
    achievements?: Achievement[];
    success: boolean;
    error?: string;
  };
}

interface DatasetOptions {
  include_friends: boolean;
  include_games: boolean;
  include_recent: boolean;
  include_bans: boolean;
  include_achievements: boolean;
  achievement_game_limit: number;
}

export interface ProfileDataset {
  metadata: {
    steamid: string;
    generated_at: string;
    partial: boolean;
    warnings: string[];
  };
  profile?: PlayerSummary;
  bans?: PlayerBan[];
  friends?: FriendEntry[];
  owned_games?: OwnedGame[];
  recent_games?: RecentlyPlayedGame[];
  achievements?: Array<{
    appid: number;
    game_name?: string;
    unlocked: number;
    total: number;
    achievements: Achievement[];
    error?: string;
  }>;
}

async function safe<T>(warnings: string[], label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    warnings.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

export async function buildProfileDataset(steamid: string, options: DatasetOptions): Promise<ProfileDataset> {
  const resolvedId = await resolveSteamId(steamid);
  const warnings: string[] = [];

  const summary = await safe(warnings, 'profile', async () => {
    const url = buildApiUrl('ISteamUser', 'GetPlayerSummaries', 'v0002', { steamids: resolvedId });
    const data = await steamFetcher.fetch<GetPlayerSummariesResponse>(url, 300);
    return data.response.players[0];
  });

  const bans = options.include_bans
    ? await safe(warnings, 'bans', async () => {
      const url = buildApiUrl('ISteamUser', 'GetPlayerBans', 'v1', { steamids: resolvedId });
      const data = await steamFetcher.fetch<GetPlayerBansResponse>(url, 60);
      return data.players;
    })
    : undefined;

  const friends = options.include_friends
    ? await safe(warnings, 'friends', async () => {
      const url = buildApiUrl('ISteamUser', 'GetFriendList', 'v0001', {
        steamid: resolvedId,
        relationship: 'friend',
      });
      const data = await steamFetcher.fetch<GetFriendListResponse>(url, 300);
      return data.friendslist?.friends ?? [];
    })
    : undefined;

  const ownedGames = options.include_games
    ? await safe(warnings, 'owned_games', async () => {
      const url = buildApiUrl('IPlayerService', 'GetOwnedGames', 'v0001', {
        steamid: resolvedId,
        include_appinfo: '1',
        include_played_free_games: '1',
      });
      const data = await steamFetcher.fetch<GetOwnedGamesResponse>(url, 600);
      return data.response.games ?? [];
    })
    : undefined;

  const recentGames = options.include_recent
    ? await safe(warnings, 'recent_games', async () => {
      const url = buildApiUrl('IPlayerService', 'GetRecentlyPlayedGames', 'v0001', {
        steamid: resolvedId,
        count: '20',
      });
      const data = await steamFetcher.fetch<GetRecentlyPlayedResponse>(url, 60);
      return data.response.games ?? [];
    })
    : undefined;

  const achievements: ProfileDataset['achievements'] = [];
  if (options.include_achievements && ownedGames) {
    const games = [...ownedGames]
      .filter((g) => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, options.achievement_game_limit);

    for (const game of games) {
      const result = await safe(warnings, `achievements:${game.appid}`, async () => {
        const url = buildApiUrl('ISteamUserStats', 'GetPlayerAchievements', 'v0001', {
          steamid: resolvedId,
          appid: String(game.appid),
          l: 'english',
        });
        const data = await steamFetcher.fetch<GetPlayerAchievementsResponse>(url, 60);
        const list = data.playerstats.achievements ?? [];
        return {
          appid: game.appid,
          game_name: data.playerstats.gameName ?? game.name,
          unlocked: list.filter((a) => a.achieved === 1).length,
          total: list.length,
          achievements: list,
          error: data.playerstats.success ? undefined : data.playerstats.error,
        };
      });
      if (result) achievements.push(result);
    }
  }

  return {
    metadata: {
      steamid: resolvedId,
      generated_at: new Date().toISOString(),
      partial: warnings.length > 0,
      warnings,
    },
    profile: summary,
    bans,
    friends,
    owned_games: ownedGames,
    recent_games: recentGames,
    achievements: options.include_achievements ? achievements : undefined,
  };
}

export const exportProfileDataSchema = z.object({
  steamid: steamIdOrVanitySchema.describe('SteamID64 or vanity URL'),
  format: formatSchema.describe('Output format: markdown or json'),
  include_friends: z.boolean().default(true),
  include_games: z.boolean().default(true),
  include_recent: z.boolean().default(true),
  include_bans: z.boolean().default(true),
  include_achievements: z.boolean().default(false),
  achievement_game_limit: z.number().int().min(1).max(25).default(10),
});

export async function handleExportProfileData(args: unknown): Promise<string> {
  const parsed = exportProfileDataSchema.parse(args);
  const dataset = await buildProfileDataset(parsed.steamid, parsed);
  return formatOutput(dataset, parsed.format as OutputFormat, profileDatasetMarkdown(dataset));
}

export const analyzePlayerSchema = z.object({
  steamid: steamIdOrVanitySchema.describe('SteamID64 or vanity URL'),
  detail_level: z.enum(['summary', 'full']).default('summary'),
  format: formatSchema.describe('Output format: markdown or json'),
});

export async function handleAnalyzePlayer(args: unknown): Promise<string> {
  const { steamid, detail_level, format } = analyzePlayerSchema.parse(args);
  const dataset = await buildProfileDataset(steamid, {
    include_friends: false,
    include_games: true,
    include_recent: true,
    include_bans: true,
    include_achievements: false,
    achievement_game_limit: 0,
  });
  const analysis = await analyzeDataset(dataset, detail_level === 'full');
  return formatOutput(analysis, format as OutputFormat, playerAnalysisMarkdown(analysis));
}

export interface PlayerAnalysis {
  steamid: string;
  player_name?: string;
  visibility?: string;
  totals: {
    games: number;
    played_games: number;
    never_played_games: number;
    total_hours: number;
    backlog_percent: number;
  };
  top_games: Array<{ appid: number; name?: string; hours: number; last_played?: string }>;
  recent_games: Array<{ appid: number; name: string; recent_hours: number; total_hours: number }>;
  favorite_genres: Array<{ name: string; score: number }>;
  favorite_categories: Array<{ name: string; score: number }>;
  tendencies: string[];
  warnings: string[];
}

export async function analyzeDataset(dataset: ProfileDataset, full: boolean): Promise<PlayerAnalysis> {
  const games = dataset.owned_games ?? [];
  const played = games.filter((g) => g.playtime_forever > 0);
  const neverPlayed = games.length - played.length;
  const topGames = [...played].sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, full ? 20 : 10);
  const genreScores = new Map<string, number>();
  const categoryScores = new Map<string, number>();

  for (const game of topGames.slice(0, 8)) {
    const details = await safe(dataset.metadata.warnings, `details:${game.appid}`, () =>
      getGameDetailsData(String(game.appid), 'US', 'english')
    );
    const weight = Math.max(1, Math.round(game.playtime_forever / 60));
    for (const genre of details?.genres ?? []) {
      genreScores.set(genre.description, (genreScores.get(genre.description) ?? 0) + weight);
    }
    for (const category of details?.categories ?? []) {
      categoryScores.set(category.description, (categoryScores.get(category.description) ?? 0) + weight);
    }
  }

  const totalMinutes = played.reduce((sum, game) => sum + game.playtime_forever, 0);
  const tendencies: string[] = [];
  const cats = [...categoryScores.keys()].map((c) => c.toLowerCase());
  if (cats.some((c) => c.includes('multi-player') || c.includes('co-op'))) tendencies.push('Multiplayer/co-op leaning');
  if (cats.some((c) => c.includes('single-player'))) tendencies.push('Single-player leaning');
  if (neverPlayed > games.length * 0.4) tendencies.push('Large backlog');
  if ((dataset.recent_games?.length ?? 0) > 0) tendencies.push('Recently active');

  return {
    steamid: dataset.metadata.steamid,
    player_name: dataset.profile?.personaname,
    visibility: dataset.profile?.communityvisibilitystate === 3 ? 'Public' : 'Private or limited',
    totals: {
      games: games.length,
      played_games: played.length,
      never_played_games: neverPlayed,
      total_hours: Math.round(totalMinutes / 60),
      backlog_percent: games.length > 0 ? Math.round((neverPlayed / games.length) * 100) : 0,
    },
    top_games: topGames.map((g) => ({
      appid: g.appid,
      name: g.name,
      hours: Math.round(g.playtime_forever / 60),
      last_played: g.rtime_last_played ? formatDate(g.rtime_last_played) : undefined,
    })),
    recent_games: (dataset.recent_games ?? []).map((g) => ({
      appid: g.appid,
      name: g.name,
      recent_hours: Math.round(g.playtime_2weeks / 60),
      total_hours: Math.round(g.playtime_forever / 60),
    })),
    favorite_genres: ranked(genreScores),
    favorite_categories: ranked(categoryScores),
    tendencies,
    warnings: dataset.metadata.warnings,
  };
}

function ranked(scores: Map<string, number>): Array<{ name: string; score: number }> {
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, score]) => ({ name, score }));
}

function profileDatasetMarkdown(dataset: ProfileDataset): string {
  const games = dataset.owned_games ?? [];
  const topGames = [...games].sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 10);
  const lines = [
    `Steam profile export for ${dataset.profile?.personaname ?? dataset.metadata.steamid}`,
    `SteamID64: ${dataset.metadata.steamid}`,
    `Generated: ${dataset.metadata.generated_at}`,
    '',
    `Games: ${games.length}`,
    `Friends: ${dataset.friends?.length ?? 'not included/unavailable'}`,
    `Recent games: ${dataset.recent_games?.length ?? 'not included/unavailable'}`,
    `Bans: ${dataset.bans?.length ? 'included' : 'not included/unavailable'}`,
  ];

  if (topGames.length > 0) {
    lines.push('', 'Top games by playtime:', ...markdownTable(
      ['Game', 'AppID', 'Playtime'],
      topGames.map((g) => [g.name ?? `AppID ${g.appid}`, g.appid, formatPlaytime(g.playtime_forever)])
    ));
  }
  if (dataset.metadata.warnings.length > 0) {
    lines.push('', 'Warnings:', ...dataset.metadata.warnings.map((w) => `- ${w}`));
  }
  return lines.join('\n');
}

function playerAnalysisMarkdown(analysis: PlayerAnalysis): string {
  return [
    `Steam player analysis for ${analysis.player_name ?? analysis.steamid}`,
    `Visibility: ${analysis.visibility ?? 'Unknown'}`,
    '',
    `Games: ${analysis.totals.games} (${analysis.totals.played_games} played, ${analysis.totals.never_played_games} never played)`,
    `Total playtime: ${analysis.totals.total_hours}h`,
    `Backlog: ${analysis.totals.backlog_percent}%`,
    analysis.tendencies.length > 0 ? `Tendencies: ${analysis.tendencies.join(', ')}` : null,
    '',
    'Top games:',
    ...markdownTable(['Game', 'AppID', 'Hours', 'Last played'], analysis.top_games.map((g) => [
      g.name ?? `AppID ${g.appid}`,
      g.appid,
      g.hours,
      g.last_played ?? 'Unknown',
    ])),
    analysis.favorite_genres.length > 0 ? '\nFavorite genres:' : null,
    ...analysis.favorite_genres.map((g) => `- ${g.name} (${g.score})`),
    analysis.warnings.length > 0 ? '\nWarnings:' : null,
    ...analysis.warnings.map((w) => `- ${w}`),
  ].filter((line): line is string => line !== null).join('\n');
}
