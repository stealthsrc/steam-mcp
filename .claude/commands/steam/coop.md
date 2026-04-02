---
description: Find games two players share in their Steam libraries — answer "what should we play tonight?"
---

Find common games between: $ARGUMENTS

The argument contains two Steam identifiers separated by a space (SteamID64 or vanity URLs).
Example: `stealthylabs gabelogannewell` or `76561199832263296 76561197960287930`

Do the following in parallel:
1. `steam_get_owned_games` for the first player (limit: 500, include_appinfo: true, sort_by: "playtime")
2. `steam_get_owned_games` for the second player (limit: 500, include_appinfo: true, sort_by: "playtime")

Then compute the intersection: games where the AppID exists in both libraries.

Present the results:

## Games in common — {Player1} & {Player2}

**{X} games in common** out of {Y} and {Z} total games.

Show a table of shared games sorted by combined playtime (player1 + player2):

| Game | AppID | {Player1} playtime | {Player2} playtime | Combined |
|------|-------|-------------------|-------------------|---------|

Limit to the top 20 results.

After the table, add store links for the top 5:
- **{Game Name}**: https://store.steampowered.com/app/{appid}/

If one or both libraries are private, explain which player's library could not be accessed.
