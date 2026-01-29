import { homedir } from "os";
import { join } from "path";
import { parse, stringify } from "yaml";
import type { Config } from "../types";

const CONFIG_DIR = join(homedir(), ".config", "ec");
const CONFIG_FILE = join(CONFIG_DIR, "config.yaml");

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export async function loadConfig(): Promise<Config> {
  try {
    const content = await Bun.file(CONFIG_FILE).text();
    return parse(content) || {};
  } catch {
    return {};
  }
}

export async function saveConfig(config: Config): Promise<void> {
  // Ensure config directory exists
  await Bun.write(join(CONFIG_DIR, ".keep"), "");

  const content = stringify(config);
  await Bun.write(CONFIG_FILE, content);
}

export async function getApiUrl(override?: string): Promise<string | null> {
  if (override) return override;

  if (process.env.EC_API_URL) return process.env.EC_API_URL;

  const config = await loadConfig();
  return config.api_url || null;
}

export async function getApiKey(override?: string): Promise<string | null> {
  if (override) return override;

  if (process.env.EC_API_KEY) return process.env.EC_API_KEY;

  const config = await loadConfig();
  return config.api_key || null;
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}
