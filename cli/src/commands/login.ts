import { loadConfig, saveConfig } from "../lib/config";
import { verifyApiKey } from "../lib/api";
import { success, error, info } from "../lib/output";
import type { GlobalOptions } from "../types";

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;

  let command: string[];
  if (platform === "darwin") {
    command = ["open", url];
  } else if (platform === "win32") {
    command = ["cmd", "/c", "start", url];
  } else {
    command = ["xdg-open", url];
  }

  const proc = Bun.spawn(command, {
    stdout: "ignore",
    stderr: "ignore",
  });
  await proc.exited;
}

async function prompt(message: string): Promise<string> {
  process.stdout.write(message);

  const reader = Bun.stdin.stream().getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);

    // Check if we have a newline
    const text = Buffer.concat(chunks).toString();
    if (text.includes("\n")) {
      reader.releaseLock();
      return text.trim();
    }
  }

  reader.releaseLock();
  return Buffer.concat(chunks).toString().trim();
}

export async function login(options: GlobalOptions): Promise<void> {
  // Get or prompt for API URL
  let apiUrl = options.apiUrl;

  if (!apiUrl) {
    const config = await loadConfig();
    apiUrl = config.api_url || process.env.EC_API_URL;
  }

  if (!apiUrl) {
    apiUrl = await prompt("API URL (e.g., https://erikcraddock.me/api): ");
  }

  if (!apiUrl) {
    error("API URL is required");
    process.exit(2);
  }

  // Normalize URL
  apiUrl = apiUrl.replace(/\/$/, "");

  // Build auth URL
  const authUrl = apiUrl.replace(/\/api$/, "") + "/cli/auth";

  info("Opening browser to authenticate...");
  info("");
  info(`  ${authUrl}`);
  info("");

  await openBrowser(authUrl);

  info("After logging in, copy the API key and paste it here.");
  info("");

  const apiKey = await prompt("API Key: ");

  if (!apiKey) {
    error("API key is required");
    process.exit(1);
  }

  // Verify the key
  info("");
  info("Verifying API key...");

  const result = await verifyApiKey(apiUrl, apiKey);

  if (!result.success) {
    error(`Authentication failed: ${result.error}`);
    process.exit(1);
  }

  // Save to config
  await saveConfig({
    api_url: apiUrl,
    api_key: apiKey,
  });

  info("");
  success(`Logged in as ${result.email}`);
  info("  API key stored in ~/.config/ec/config.yaml");
}
