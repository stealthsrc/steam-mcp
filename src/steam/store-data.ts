import { buildStoreUrl, steamFetcher } from './client.js';

interface StoreAppDetailsResponse {
  [appid: string]: {
    success: boolean;
    data?: GameDetails;
  };
}

export interface GameDetails {
  steam_appid: number;
  name: string;
  type: string;
  is_free?: boolean;
  short_description?: string;
  supported_languages?: string;
  header_image?: string;
  website?: string;
  developers?: string[];
  publishers?: string[];
  price_overview?: {
    currency: string;
    initial: number;
    final: number;
    discount_percent: number;
    final_formatted: string;
  };
  metacritic?: { score: number; url: string };
  categories?: Array<{ id: number; description: string }>;
  genres?: Array<{ id: string; description: string }>;
  screenshots?: Array<{ id: number; path_thumbnail: string; path_full: string }>;
  movies?: Array<{ id: number; name: string; thumbnail: string; webm?: { max?: string } }>;
  recommendations?: { total: number };
  release_date?: { coming_soon: boolean; date: string };
  platforms?: { windows: boolean; mac: boolean; linux: boolean };
  dlc?: number[];
}

export async function getGameDetailsData(appid: string, country: string, language: string): Promise<GameDetails | undefined> {
  const url = buildStoreUrl('api/appdetails/', {
    appids: appid,
    cc: country,
    l: language,
  });
  const data = await steamFetcher.fetch<StoreAppDetailsResponse>(url, 300);
  const item = data[appid];
  return item?.success ? item.data : undefined;
}
