---
description: Show a player's achievement progress on a game, crossed with global rarity stats
---

Show achievement progress for: $ARGUMENTS

The argument is in the format `<steamid_or_vanity> <game_name>`.
Extract the first word/token as the steamid or vanity URL, and the rest as the game name query.

Do the following steps in order:
1. Use `steam_search_game` with the game name part to find the AppID (limit: 3)
2. In parallel, use the top AppID result to call:
   - `steam_get_achievements` with the player steamid, the AppID, language="english", status="all"
   - `steam_get_global_achievement_stats` with the AppID

Then present the results:

## Achievements - {Game Name} - {Player}

**Progress:** X/Y (Z%)

Cross-reference each unlocked achievement with its global unlock rate from `steam_get_global_achievement_stats`.
Highlight the rarest unlocked achievements (lowest global %) with a note like "rare - only X% of players".

Show two tables:

### Unlocked
| Achievement | Unlocked on | Global % | Rarity |
(sorted by global % ascending - rarest first)

### Still locked
| Achievement | Global % |
(sorted by global % descending - easiest first, so the player knows what to do next)

At the end, add a link to the achievements page:
- https://steamcommunity.com/profiles/{steamid64}/stats/{appid}/achievements
