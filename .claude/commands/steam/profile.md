---
description: Look up a Steam player profile by SteamID64 or vanity URL
---

Look up the Steam profile for: $ARGUMENTS

Use the `steam_get_player_summary` tool with the provided argument.

Then display the result clearly, and at the end include these direct Steam links:
- Profile page: `https://steamcommunity.com/profiles/{steamid64}` (use the SteamID64 from the result)
- Friends list: `https://steamcommunity.com/profiles/{steamid64}/friends`
- Game library: `https://steamcommunity.com/profiles/{steamid64}/games?tab=all`

If the argument looks like a vanity URL (not 17 digits), also link `https://steamcommunity.com/id/{vanity_url}` as an alternative.
