import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from './utils/logger.js';
import {
  resolveVanityUrlSchema, handleResolveVanityUrl,
  getPlayerSummarySchema, handleGetPlayerSummary,
  getFriendListSchema, handleGetFriendList,
  getPlayerBansSchema, handleGetPlayerBans,
  getOwnedGamesSchema, handleGetOwnedGames,
  getRecentlyPlayedSchema, handleGetRecentlyPlayed,
  getAchievementsSchema, handleGetAchievements,
  getGlobalAchievementStatsSchema, handleGetGlobalAchievementStats,
  getGameSchemaSchema, handleGetGameSchema,
  searchGameSchema, handleSearchGame,
  getCurrentPlayersSchema, handleGetCurrentPlayers,
} from './tools/index.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'steam-mcp',
    version: '1.0.0',
  });

  // Player tools

  server.tool(
    'steam_resolve_vanity_url',
    'Converts a Steam vanity URL (custom profile name) to a SteamID64. ' +
    'Use this when you have a username like "gabelogannewell" and need the numeric SteamID64 ' +
    'required by most other Steam tools.',
    resolveVanityUrlSchema.shape,
    async (args) => {
      logger.info('steam_resolve_vanity_url', { vanity_url: args.vanity_url });
      const text = await handleResolveVanityUrl(args);
      return { content: [{ type: 'text', text }] };
    }
  );

  server.tool(
    'steam_get_player_summary',
    'Fetches the public profile of a Steam player. ' +
    'Accepts a SteamID64 (e.g. "76561197960287930") or a vanity URL (e.g. "gabelogannewell"). ' +
    'Returns: display name, avatar URL, online status, last online date, account creation date, ' +
    'country, currently playing game, and profile visibility. ' +
    'Returns limited data if the profile is private.',
    getPlayerSummarySchema.shape,
    async (args) => {
      logger.info('steam_get_player_summary', { steamid: args.steamid });
      const text = await handleGetPlayerSummary(args);
      return { content: [{ type: 'text', text }] };
    }
  );

  server.tool(
    'steam_get_friend_list',
    'Returns the friend list of a Steam player. ' +
    'Accepts a SteamID64 or vanity URL. Shows up to 50 most recent friends with names and the date they became friends. ' +
    'Set resolve_names=false to skip name resolution and return SteamIDs only. ' +
    'Returns an error message if the profile or friend list is set to private.',
    getFriendListSchema.shape,
    async (args) => {
      logger.info('steam_get_friend_list', { steamid: args.steamid });
      const text = await handleGetFriendList(args);
      return { content: [{ type: 'text', text }] };
    }
  );

  server.tool(
    'steam_get_player_bans',
    'Checks VAC (Valve Anti-Cheat), game ban, and community ban status for one or more Steam accounts. ' +
    'Accepts a single SteamID64 or an array of up to 100 SteamID64s. ' +
    'Returns ban counts, days since last ban, and economy ban status for each account.',
    getPlayerBansSchema.shape,
    async (args) => {
      logger.info('steam_get_player_bans');
      const text = await handleGetPlayerBans(args);
      return { content: [{ type: 'text', text }] };
    }
  );

  // Games tools

  server.tool(
    'steam_get_owned_games',
    'Returns the game library of a Steam player. ' +
    'Accepts SteamID64 or vanity URL. Supports filtering to played-only, sorting by playtime/name/last_played, ' +
    'and limiting results (default: 50, max: 500). ' +
    'Returns game names, AppIDs, and total playtime in a table. ' +
    'Returns an error if the library is set to private.',
    getOwnedGamesSchema.shape,
    async (args) => {
      logger.info('steam_get_owned_games', { steamid: args.steamid });
      const text = await handleGetOwnedGames(args);
      return { content: [{ type: 'text', text }] };
    }
  );

  server.tool(
    'steam_get_recently_played',
    'Returns games played by a Steam user in the last 2 weeks. ' +
    'Accepts SteamID64 or vanity URL. Returns up to 20 games with recent and total playtime. ' +
    'Returns an error if the profile is private.',
    getRecentlyPlayedSchema.shape,
    async (args) => {
      logger.info('steam_get_recently_played', { steamid: args.steamid });
      const text = await handleGetRecentlyPlayed(args);
      return { content: [{ type: 'text', text }] };
    }
  );

  // Achievement tools

  server.tool(
    'steam_get_achievements',
    'Returns a player\'s achievement progress for a specific game. ' +
    'Accepts SteamID64 or vanity URL, and a Steam AppID (e.g. 730 for CS2). ' +
    'Use status="locked" to see missing achievements, "unlocked" for completed ones, "all" for everything. ' +
    'Returns total progress percentage and a table of achievements. ' +
    'Requires the player\'s game stats to be public.',
    getAchievementsSchema.shape,
    async (args) => {
      logger.info('steam_get_achievements', { appid: args.appid });
      const text = await handleGetAchievements(args);
      return { content: [{ type: 'text', text }] };
    }
  );

  server.tool(
    'steam_get_global_achievement_stats',
    'Returns global completion rates for all achievements in a game. ' +
    'Accepts a Steam AppID. Shows the 10 easiest and 10 hardest achievements with their global unlock percentages. ' +
    'Useful for understanding how rare an achievement is across all players.',
    getGlobalAchievementStatsSchema.shape,
    async (args) => {
      logger.info('steam_get_global_achievement_stats', { appid: args.appid });
      const text = await handleGetGlobalAchievementStats(args);
      return { content: [{ type: 'text', text }] };
    }
  );

  server.tool(
    'steam_get_game_schema',
    'Returns the full schema of stats and achievements defined by a game. ' +
    'Accepts a Steam AppID. Returns achievement names, descriptions, hidden status, and icon URLs. ' +
    'Also returns the count of available stats. Useful before querying player-specific achievement data.',
    getGameSchemaSchema.shape,
    async (args) => {
      logger.info('steam_get_game_schema', { appid: args.appid });
      const text = await handleGetGameSchema(args);
      return { content: [{ type: 'text', text }] };
    }
  );

  // Store tools

  server.tool(
    'steam_search_game',
    'Searches for games on Steam by name. ' +
    'Returns AppID, name, current price, discount percentage, and Metacritic score. ' +
    'Use this to find a game\'s AppID before calling other tools that require it. ' +
    'Example: search "Counter-Strike" to get AppID 730.',
    searchGameSchema.shape,
    async (args) => {
      logger.info('steam_search_game', { query: args.query });
      const text = await handleSearchGame(args);
      return { content: [{ type: 'text', text }] };
    }
  );

  server.tool(
    'steam_get_current_players',
    'Returns the number of players currently in-game for a Steam app. ' +
    'Accepts a Steam AppID. Useful for checking if a game is still active/popular. ' +
    'Example: AppID 730 (CS2) typically has 500k+ concurrent players.',
    getCurrentPlayersSchema.shape,
    async (args) => {
      logger.info('steam_get_current_players', { appid: args.appid });
      const text = await handleGetCurrentPlayers(args);
      return { content: [{ type: 'text', text }] };
    }
  );

  return server;
}
