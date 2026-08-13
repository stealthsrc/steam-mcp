import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env['STEAM_API_KEY'] = 'test-key';

type StoreItem = {
  id: number;
  name: string;
  type: string;
  price?: { currency: string; initial: number; final: number; discount_percent: number; final_formatted: string };
  platforms?: { windows: boolean; mac: boolean; linux: boolean };
};

let handlers: typeof import('../src/tools/index.js');

const steamid = '76561197960287930';

const details = (appid: number, name: string, genre = 'Action') => ({
  steam_appid: appid,
  name,
  type: 'game',
  short_description: `${name} description`,
  developers: ['Dev'],
  publishers: ['Pub'],
  price_overview: {
    currency: 'USD',
    initial: 2999,
    final: appid === 2000 ? 999 : 1999,
    discount_percent: appid === 2000 ? 50 : 0,
    final_formatted: appid === 2000 ? '$9.99' : '$19.99',
  },
  genres: [{ id: '1', description: genre }],
  categories: [
    { id: 2, description: 'Single-player' },
    { id: 38, description: 'Online Co-op' },
  ],
  platforms: { windows: true, mac: false, linux: true },
  recommendations: { total: 50000 },
  release_date: { coming_soon: false, date: 'Jan 1, 2024' },
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeAll(async () => {
  handlers = await import('../src/tools/index.js');
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    const path = url.pathname;

    if (url.hostname === 'store.steampowered.com' && path.endsWith('/api/appdetails/')) {
      const appid = Number(url.searchParams.get('appids'));
      return json({ [appid]: { success: true, data: details(appid, appid === 2000 ? 'Recommended Game' : 'Owned Game') } });
    }

    if (url.hostname === 'store.steampowered.com' && path.endsWith('/api/storesearch/')) {
      const term = url.searchParams.get('term');
      const items: StoreItem[] = term === 'Action'
        ? [{ id: 2000, name: 'Recommended Game', type: 'app', platforms: { windows: true, mac: false, linux: true } }]
        : [{ id: 2000, name: 'Recommended Game', type: 'app', platforms: { windows: true, mac: false, linux: true } }];
      return json({ total: items.length, items });
    }

    if (path.includes('/ISteamUser/GetPlayerSummaries/')) {
      return json({
        response: {
          players: [{
            steamid,
            communityvisibilitystate: 3,
            profilestate: 1,
            personaname: 'Tester',
            profileurl: 'https://steamcommunity.com/id/tester/',
            avatar: 'a',
            avatarmedium: 'b',
            avatarfull: 'c',
            personastate: 1,
          }],
        },
      });
    }

    if (path.includes('/ISteamUser/GetPlayerBans/')) {
      return json({ players: [{ SteamId: steamid, CommunityBanned: false, VACBanned: false, NumberOfVACBans: 0, DaysSinceLastBan: 0, NumberOfGameBans: 0, EconomyBan: 'none' }] });
    }

    if (path.includes('/ISteamUser/GetFriendList/')) {
      return json({ friendslist: { friends: [{ steamid: '76561197960287931', relationship: 'friend', friend_since: 1700000000 }] } });
    }

    if (path.includes('/IPlayerService/GetOwnedGames/')) {
      return json({
        response: {
          game_count: 2,
          games: [
            { appid: 1000, name: 'Owned Game', playtime_forever: 600, rtime_last_played: 1700000000 },
            { appid: 3000, name: 'Backlog Game', playtime_forever: 0 },
          ],
        },
      });
    }

    if (path.includes('/IPlayerService/GetRecentlyPlayedGames/')) {
      return json({ response: { total_count: 1, games: [{ appid: 1000, name: 'Owned Game', playtime_2weeks: 120, playtime_forever: 600, img_icon_url: 'icon' }] } });
    }

    if (path.includes('/ISteamUserStats/GetNumberOfCurrentPlayers/')) {
      return json({ response: { result: 1, player_count: 12345 } });
    }

    return json({});
  }));
});

describe('expanded Steam tools', () => {
  it('returns rich appdetails as JSON', async () => {
    const text = await handlers.handleGetGameDetails({ appid: 1000, format: 'json' });
    const body = JSON.parse(text);
    expect(body.name).toBe('Owned Game');
    expect(body.genres[0].description).toBe('Action');
  });

  it('exports a profile dataset', async () => {
    const text = await handlers.handleExportProfileData({ steamid, format: 'json' });
    const body = JSON.parse(text);
    expect(body.profile.personaname).toBe('Tester');
    expect(body.owned_games).toHaveLength(2);
    expect(body.friends).toHaveLength(1);
  });

  it('analyzes player backlog and genres', async () => {
    const text = await handlers.handleAnalyzePlayer({ steamid, format: 'json' });
    const body = JSON.parse(text);
    expect(body.totals.backlog_percent).toBe(50);
    expect(body.favorite_genres[0].name).toBe('Action');
  });

  it('searches Steam broadly with filters', async () => {
    const text = await handlers.handleSearchAny({ query: 'co', category: 'game', max_price: 10, platform: 'linux', format: 'json' });
    const body = JSON.parse(text);
    expect(body.results[0].name).toBe('Recommended Game');
  });

  it('recommends unowned games from player taste', async () => {
    const text = await handlers.handleRecommendGames({ steamid, limit: 5, format: 'json' });
    const body = JSON.parse(text);
    expect(body.recommendations[0].appid).toBe(2000);
    expect(body.recommendations[0].reasons[0]).toContain('Action');
  });
});
