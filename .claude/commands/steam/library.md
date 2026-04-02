---
description: Deep dive into a player's Steam library - backlog, habits, total hours, gamer profile
---

Analyse the Steam library for: $ARGUMENTS

Do the following in parallel:
1. `steam_get_owned_games` with limit=500, sort_by="playtime", include_appinfo=true
2. `steam_get_recently_played` with count=10

Then compute and present:

## Library Analysis - {Player}

**Overview:**
- Total games owned: X
- Games never launched (backlog): Y (Z%)
- Games with > 100h: N
- Total hours tracked: H

**Top 10 Most Played:**
| # | Game | AppID | Playtime |
(with store links: https://store.steampowered.com/app/{appid}/)

**Backlog highlights** (owned but 0 minutes played - show up to 10 random ones):
| Game | AppID | Store |

**Gamer profile** (AI-generated based on the data):
Write 2-3 sentences describing the player's gaming habits based on the genres/games visible in their top played list. Example: "You seem to favour long-form open-world games and competitive shooters, with a strong investment in simulation titles."

**Recent activity (last 2 weeks):**
(from steam_get_recently_played)

## Links
- Full library: https://steamcommunity.com/profiles/{steamid64}/games?tab=all
- Profile: https://steamcommunity.com/profiles/{steamid64}
