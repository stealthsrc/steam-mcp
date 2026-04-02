---
description: Health check for a game - price, Metacritic score, and live player count
---

Get the health report for the game: $ARGUMENTS

Steps:
1. Use `steam_search_game` with the query (limit: 3)
2. Take the top result's AppID and call `steam_get_current_players` with it in parallel with step 1 if possible, or right after

Present a concise health report:

## Game Health Report - {Game Name}

| Field | Value |
|-------|-------|
| AppID | {appid} |
| Price | {price} |
| Metacritic | {score} /100 |
| Players right now | {count} |
| Verdict | (see below) |

**Verdict** - based on the player count, give a short assessment:
- > 100,000 players: "Very active - thriving community"
- 10,000-100,000: "Healthy - good population"
- 1,000-10,000: "Moderate - playable but niche"
- 100-1,000: "Low - may struggle to find matches"
- < 100: "Near dead - expect long queue times or empty servers"

If multiple results were found, list the others briefly below with their store links.

**Store link:** https://store.steampowered.com/app/{appid}/
