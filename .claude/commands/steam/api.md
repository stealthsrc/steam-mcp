---
description: Register steam-mcp with your Steam API key. Usage: /steam:api YOUR_KEY
---

Register the steam-mcp MCP server using the provided key: $ARGUMENTS

## Step 1 — Validate the argument

Check if `$ARGUMENTS` is empty, blank, or literally "YOUR_KEY".

If so, display this message **exactly** (do not paraphrase):

```
No API key provided.

Get your free Steam API key at:
  https://steamcommunity.com/dev/apikey

Then run:
  /steam:api YOUR_KEY

Example (this is what a real key looks like):
  /steam:api A1B2C3D4E5F67890A1B2C3D4E5F67890
```

Stop here. Do not continue.

## Step 2 — Detect the project path

Use the Bash tool to run `pwd` and capture the output as `PROJECT_DIR`.

The node entry point is: `<PROJECT_DIR>/dist/index.js`

On Windows, convert backslashes to forward slashes if needed.

## Step 3 — Register the MCP server

Use the Bash tool to run:

```bash
claude mcp add steam-mcp -e STEAM_API_KEY=$ARGUMENTS -- node "<PROJECT_DIR>/dist/index.js"
```

- If the command succeeds: tell the user `steam-mcp registered. Restart Claude Code to activate the /steam:* commands.`
- If it fails with "already exists": run `claude mcp remove steam-mcp` then retry the add command, then report success.
- If it fails for any other reason: show the raw error so the user can diagnose it.

Do NOT show the API key back to the user in any output.
