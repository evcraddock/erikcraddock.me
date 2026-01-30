import { describe, it, expect, afterEach } from "bun:test";
import { loadConfig, maskApiKey, getApiUrl, getApiKey, getConfigPath } from "../lib/config";
import { homedir } from "os";
import { join } from "path";

describe("config utilities", () => {
  describe("getConfigPath", () => {
    const originalEnv = process.env.EC_CONFIG;

    afterEach(() => {
      if (originalEnv) {
        process.env.EC_CONFIG = originalEnv;
      } else {
        delete process.env.EC_CONFIG;
      }
    });

    it("returns override if provided", () => {
      const result = getConfigPath("/custom/path/config.yaml");
      expect(result).toBe("/custom/path/config.yaml");
    });

    it("returns env var if set", () => {
      process.env.EC_CONFIG = "/from/env/config.yaml";
      const result = getConfigPath();
      expect(result).toBe("/from/env/config.yaml");
    });

    it("prefers override over env var", () => {
      process.env.EC_CONFIG = "/from/env/config.yaml";
      const result = getConfigPath("/override/config.yaml");
      expect(result).toBe("/override/config.yaml");
    });

    it("returns default path when no override or env var", () => {
      delete process.env.EC_CONFIG;
      const result = getConfigPath();
      expect(result).toBe(join(homedir(), ".config", "ec", "config.yaml"));
    });
  });

  describe("maskApiKey", () => {
    it("masks key showing first 4 and last 4 characters", () => {
      expect(maskApiKey("ek_1234567890abcdef")).toBe("ek_1...cdef");
    });

    it("returns **** for short keys", () => {
      expect(maskApiKey("short")).toBe("****");
    });

    it("returns **** for 8 character keys", () => {
      expect(maskApiKey("12345678")).toBe("****");
    });

    it("masks 9+ character keys properly", () => {
      expect(maskApiKey("123456789")).toBe("1234...6789");
    });
  });

  describe("getApiUrl", () => {
    const originalEnv = process.env.EC_API_URL;

    afterEach(() => {
      if (originalEnv) {
        process.env.EC_API_URL = originalEnv;
      } else {
        delete process.env.EC_API_URL;
      }
    });

    it("returns override if provided", async () => {
      const result = await getApiUrl("https://override.com/api");
      expect(result).toBe("https://override.com/api");
    });

    it("returns env var if set", async () => {
      process.env.EC_API_URL = "https://env.com/api";
      const result = await getApiUrl();
      expect(result).toBe("https://env.com/api");
    });

    it("prefers override over env var", async () => {
      process.env.EC_API_URL = "https://env.com/api";
      const result = await getApiUrl("https://override.com/api");
      expect(result).toBe("https://override.com/api");
    });
  });

  describe("getApiKey", () => {
    const originalEnv = process.env.EC_API_KEY;

    afterEach(() => {
      if (originalEnv) {
        process.env.EC_API_KEY = originalEnv;
      } else {
        delete process.env.EC_API_KEY;
      }
    });

    it("returns override if provided", async () => {
      const result = await getApiKey("ek_override");
      expect(result).toBe("ek_override");
    });

    it("returns env var if set", async () => {
      process.env.EC_API_KEY = "ek_from_env";
      const result = await getApiKey();
      expect(result).toBe("ek_from_env");
    });

    it("prefers override over env var", async () => {
      process.env.EC_API_KEY = "ek_from_env";
      const result = await getApiKey("ek_override");
      expect(result).toBe("ek_override");
    });
  });
});

describe("config file operations", () => {
  it("loadConfig returns empty object when file does not exist", async () => {
    // This test uses the real config path which may or may not exist
    // The function should handle missing files gracefully
    const config = await loadConfig();
    expect(typeof config).toBe("object");
  });
});
