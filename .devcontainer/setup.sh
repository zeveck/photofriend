#!/usr/bin/env bash
set -euo pipefail

# Update npm to latest.
echo "🔄 Updating npm..."
npm install -g npm@11.6.0

# Install Claude Code CLI.
echo "🤖 Installing Claude Code..."
npm install -g @anthropic-ai/claude-code@latest

# Install GPT-5 Codex CLI.
echo "🧠 Installing GPT5 Codex..."
npm install -g @openai/codex@latest

# Install Gemini CLI.
echo "✨ Installing Gemini CLI..."
npm install -g @google/gemini-cli@latest

# Install PlayWright + Chrome.
echo "🎭 Installing Playwright core..."
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npx -y playwright@latest install --with-deps chrome

# Remove all MCP servers.
echo "🧹 Removing any old MCP entries..."
rm -f .mcp.json
rm -f .playwright-mcp.json

# Install Playwright MCP with config.
echo "📝 Writing Playwright MCP config (explicit executablePath, headless)..."
cat > .playwright-mcp.json <<JSON
{
  "browser": {
    "browserName": "chromium",
    "isolated": true,
    "launchOptions": {
      "channel": "chrome",
      "headless": true,
      "args": ["--no-sandbox"]
    }
  }
}
JSON

echo "🔌 Registering MCP server (ensure same env at runtime)..."
claude mcp add playwright --scope project -- \
  npx @playwright/mcp@latest --config ./.playwright-mcp.json

# Done.
echo "✅ Setup complete."
