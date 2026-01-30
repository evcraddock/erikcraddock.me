import { homedir } from "os";
import { join, dirname } from "path";
import { mkdir } from "node:fs/promises";
import { parse, stringify } from "yaml";
import type { Config } from "../types";

const DEFAULT_CONFIG_DIR = join(homedir(), ".config", "ec");
const DEFAULT_CONFIG_FILE = join(DEFAULT_CONFIG_DIR, "config.yaml");

/**
 * Get the config file path, checking (in order):
 * 1. Explicit override parameter
 * 2. EC_CONFIG environment variable
 * 3. Default: ~/.config/ec/config.yaml
 */
export function getConfigPath(override?: string): string {
  if (override) return override;
  if (process.env.EC_CONFIG) return process.env.EC_CONFIG;
  return DEFAULT_CONFIG_FILE;
}

export function getConfigDir(configPath?: string): string {
  const path = getConfigPath(configPath);
  return dirname(path);
}

export async function loadConfig(configPath?: string): Promise<Config> {
  try {
    const path = getConfigPath(configPath);
    const content = await Bun.file(path).text();
    return parse(content) || {};
  } catch {
    return {};
  }
}

export async function saveConfig(config: Config, configPath?: string): Promise<void> {
  const path = getConfigPath(configPath);
  const dir = dirname(path);

  // Ensure config directory exists
  await mkdir(dir, { recursive: true });

  const content = stringify(config);
  await Bun.write(path, content);
}

export async function getApiUrl(override?: string, configPath?: string): Promise<string | null> {
  if (override) return override;

  if (process.env.EC_API_URL) return process.env.EC_API_URL;

  const config = await loadConfig(configPath);
  return config.api_url || null;
}

export async function getApiKey(override?: string, configPath?: string): Promise<string | null> {
  if (override) return override;

  if (process.env.EC_API_KEY) return process.env.EC_API_KEY;

  const config = await loadConfig(configPath);
  return config.api_key || null;
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}
