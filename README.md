# steam-mcp

MCP server exposing Steam Web API tools to Claude Code, Claude Desktop and Gemini CLI.

---

## Installation

**One-liner (no clone needed)**

macOS / Linux:
```bash
curl -fsSL https://raw.githubusercontent.com/stealthsrc/steam-mcp/main/install.sh | bash
```

Windows (PowerShell):
```powershell
irm https://raw.githubusercontent.com/stealthsrc/steam-mcp/main/install.ps1 | iex
```

The installer will:
- Clone the repo and build it
- Ask for your Steam API key (get one free at https://steamcommunity.com/dev/apikey)
- Register the MCP server with Claude Code
- Install all `/steam:*` slash commands

Restart Claude Code after install to activate.

---

## Prerequisites

- Node.js 18+
- Claude Code CLI
- A Steam Web API key → https://steamcommunity.com/dev/apikey

---

## Add to Claude Desktop

Edit your Claude Desktop config file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "steam-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/steam-mcp/dist/index.js"],
      "env": {
        "STEAM_API_KEY": "YOUR_KEY_HERE"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

---

## Add to Gemini CLI

Edit `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "steam-mcp": {
      "command": "node",
      "args": ["C:/absolute/path/to/steam-mcp/dist/index.js"],
      "env": {
        "STEAM_API_KEY": "YOUR_KEY_HERE"
      }
    }
  }
}
```

---

## Slash Commands (Claude Code)

Slash commands are available after adding this project to Claude Code. They chain multiple MCP tools automatically and return formatted results with clickable Steam links.

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/steam:profile` | `<steamid\|vanity>` | Public profile + links to profile, friends, library |
| `/steam:game` | `<game name>` | Search by name - price, Metacritic, live player count |
| `/steam:trend` | `<game name>` | Health report - price, Metacritic, player count + verdict |
| `/steam:all` | `<steamid\|vanity>` | Full overview: profile + top games + recent activity + friends |
| `/steam:library` | `<steamid\|vanity>` | Deep library analysis: backlog %, total hours, gamer profile |
| `/steam:achievements` | `<steamid\|vanity> <game name>` | Achievement progress crossed with global rarity stats |
| `/steam:coop` | `<steamid1> <steamid2>` | Find games both players own - sorted by combined playtime |
| `/steam:vac` | `<steamid1> [steamid2] ...` | VAC/ban check for one or multiple players at once |

### Examples

```
/steam:profile stealthylabs
/steam:game Battlefield 6
/steam:trend Rust
/steam:all gabelogannewell
/steam:library stealthylabs
/steam:achievements stealthylabs Resident Evil Requiem
/steam:coop stealthylabs gabelogannewell
/steam:vac gabelogannewell robinwalker
```

---

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `steam_resolve_vanity_url` | Convert a vanity URL (e.g. `gabelogannewell`) to a SteamID64 |
| `steam_get_player_summary` | Public profile: name, status, avatar, country, currently playing |
| `steam_get_friend_list` | Friend list with names and dates (`resolve_names` param) |
| `steam_get_player_bans` | VAC/game/community ban status for 1-100 accounts |
| `steam_get_owned_games` | Game library with playtime, sortable and filterable |
| `steam_get_recently_played` | Games played in the last 2 weeks |
| `steam_get_achievements` | Player achievement progress - filter by `locked/unlocked/all` |
| `steam_get_global_achievement_stats` | Global unlock rates (easiest/hardest achievements) |
| `steam_get_game_schema` | Full list of achievements and stats defined by a game |
| `steam_search_game` | Search by name - returns AppID, price, Metacritic score |
| `steam_get_current_players` | Number of players currently in-game for any app |
| `steam_get_game_details` | Rich store details: price, reviews, genres, platforms, media, DLC |
| `steam_export_profile_data` | Export profile, bans, friends, library, recent activity, optional achievements |
| `steam_analyze_player` | Infer play style, backlog, favorite genres/categories, top games |
| `steam_search_any` | Broad Steam search across apps, games, DLC, software, demos with filters |
| `steam_recommend_games` | Recommend unowned games from a player's Steam library and taste profile |

---

## Example prompts

```
Look up the Steam profile for "stealthylabs"

What are my 10 most played games? (SteamID: 76561198XXXXXXXXX)

Show me the global achievement stats for Grand Theft Auto V Legacy

Which games have I bought but never launched?

Is Rust still worth buying in terms of player activity?

Export a Steam profile as JSON for analysis

Analyze what kind of games this Steam user likes: stealthylabs

Search Steam for Linux co-op games under $10

Recommend discounted games for this SteamID: 76561198XXXXXXXXX
```

---

## Local test (without Claude Code)

```bash
# Test the server responds to MCP protocol
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | STEAM_API_KEY=YOUR_KEY node dist/index.js

# Or with .env file
npm start
# then pipe JSON manually or use MCP Inspector:
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Development

```bash
npm run dev      # hot reload via tsx
npm run build    # compile TypeScript → dist/
npm run lint     # tsc type-check only
npm test         # unit tests
```
