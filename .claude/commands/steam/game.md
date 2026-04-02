---
description: Search for a Steam game by name and get store info + live player count
---

Search for the Steam game: $ARGUMENTS

Do the following in parallel:
1. Use `steam_search_game` with the query to find matching games (limit: 5)
2. If the argument looks like a number (an AppID), also call `steam_get_current_players` with that AppID

Display the search results table, then for each result include a direct Steam store link:
- Store page: `https://store.steampowered.com/app/{appid}/`

If you ran `steam_get_current_players`, show the live player count next to the matching game.

After the table, list the clickable Steam store links for each result:
- **{Game Name}**: https://store.steampowered.com/app/{appid}/
