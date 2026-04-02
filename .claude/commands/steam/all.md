---
description: Full Steam overview for a player - profile, library, recent activity, friends, and links
---

Get a complete Steam overview for: $ARGUMENTS

Run all of these in parallel:
1. `steam_get_player_summary` - profile info
2. `steam_get_owned_games` with limit=10, sort_by="playtime" - top 10 most played games
3. `steam_get_recently_played` with count=5 - recent activity
4. `steam_get_friend_list` with resolve_names=true - friends list

Present the results in clear sections:

## Profile
(summary from steam_get_player_summary)

## Top 10 Most Played Games
(table from steam_get_owned_games - add store link for each: https://store.steampowered.com/app/{appid}/)

## Recent Activity (last 2 weeks)
(table from steam_get_recently_played)

## Friends
(table from steam_get_friend_list)

## Steam Links
- Profile: https://steamcommunity.com/profiles/{steamid64}
- Game library: https://steamcommunity.com/profiles/{steamid64}/games?tab=all
- Friends: https://steamcommunity.com/profiles/{steamid64}/friends
- Achievements: https://steamcommunity.com/profiles/{steamid64}/achievements
