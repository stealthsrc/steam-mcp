// Steam Web API response types
// SteamIDs are always strings to avoid JS number precision loss

export interface PlayerSummary {
  steamid: string;
  communityvisibilitystate: number; // 1=private, 3=public
  profilestate: number;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  personastate: number; // 0=offline, 1=online, 2=busy, 3=away, 4=snooze, 5=looking to trade, 6=looking to play
  lastlogoff?: number;
  timecreated?: number;
  loccountrycode?: string;
  locstatecode?: string;
  gameextrainfo?: string;
  gameid?: string;
}

export interface FriendEntry {
  steamid: string;
  relationship: string;
  friend_since: number;
}

export interface PlayerBan {
  SteamId: string;
  CommunityBanned: boolean;
  VACBanned: boolean;
  NumberOfVACBans: number;
  DaysSinceLastBan: number;
  NumberOfGameBans: number;
  EconomyBan: string;
}

export interface OwnedGame {
  appid: number;
  name?: string;
  playtime_forever: number; // minutes
  playtime_2weeks?: number;
  img_icon_url?: string;
  rtime_last_played?: number;
}

export interface RecentlyPlayedGame {
  appid: number;
  name: string;
  playtime_2weeks: number;
  playtime_forever: number;
  img_icon_url: string;
}

export interface Achievement {
  apiname: string;
  achieved: 0 | 1;
  unlocktime: number;
  name?: string;
  description?: string;
}

export interface GlobalAchievementStat {
  name: string;
  percent: number;
}

export interface GameStat {
  name: string;
  value: number;
}

export interface GameSchemaAchievement {
  name: string;
  defaultvalue: number;
  displayName: string;
  hidden: number;
  description?: string;
  icon: string;
  icongray: string;
}

export interface GameSchemaStat {
  name: string;
  defaultvalue: number;
  displayName: string;
}

export interface GameSchema {
  gameName: string;
  gameVersion: string;
  availableGameStats?: {
    achievements?: GameSchemaAchievement[];
    stats?: GameSchemaStat[];
  };
}
