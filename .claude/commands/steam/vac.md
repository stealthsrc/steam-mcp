---
description: Check VAC/ban status for one or multiple Steam players at once
---

Check ban status for: $ARGUMENTS

The argument is one or more Steam identifiers separated by spaces (SteamID64 or vanity URLs).
Examples:
- `stealthylabs`
- `76561199832263296 76561197960287930`
- `player1 player2 player3`

Steps:
1. For any vanity URLs (non-numeric), use `steam_get_player_summary` to resolve names and SteamID64s
2. Collect all SteamID64s, then call `steam_get_player_bans` with the full list in one request
3. Call `steam_get_player_summary` for each ID to get display names (can batch if already resolved above)

Present the results as a clear table:

## VAC / Ban Check

| Player | SteamID | VAC Banned | VAC Bans | Game Bans | Community Ban | Economy | Days Since Ban |
|--------|---------|-----------|----------|-----------|---------------|---------|----------------|

Use clear indicators:
- No bans: "Clean"
- VAC banned: "VAC x{N}" with days since last ban
- Game banned: "Game x{N}"
- Community banned: "Community"

After the table, add Steam profile links for each player:
- **{Name}**: https://steamcommunity.com/profiles/{steamid64}

If any player has bans, add a note at the bottom summarizing the flagged accounts.
