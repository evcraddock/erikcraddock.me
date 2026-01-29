import { loadConfig, getConfigPath, maskApiKey } from "../lib/config";
import { info } from "../lib/output";

export async function configShow(): Promise<void> {
  const config = await loadConfig();
  const configPath = getConfigPath();

  info(`Config file: ${configPath}`);
  info("");

  if (!config.api_url && !config.api_key) {
    info("No configuration found. Run 'ec login' to get started.");
    return;
  }

  if (config.api_url) {
    info(`api_url: ${config.api_url}`);
  } else {
    info("api_url: (not set)");
  }

  if (config.api_key) {
    info(`api_key: ${maskApiKey(config.api_key)}`);
  } else {
    info("api_key: (not set)");
  }
}
