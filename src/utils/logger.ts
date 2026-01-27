type LogLevel = "debug" | "info" | "warn" | "error";

interface LogData {
  [key: string]: unknown;
}

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ANSI color codes for TTY output
const colors = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

const levelColors: Record<LogLevel, string> = {
  debug: colors.gray,
  info: colors.blue,
  warn: colors.yellow,
  error: colors.red,
};

const levelLabels: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
};

function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level && level in levels) {
    return level as LogLevel;
  }
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return levels[level] >= levels[getLogLevel()];
}

function formatTimestamp(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  const ms = now.getMilliseconds().toString().padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

function formatData(data?: LogData): string {
  if (!data || Object.keys(data).length === 0) {
    return "";
  }
  return " " + JSON.stringify(data);
}

function isTTY(): boolean {
  return process.stdout.isTTY ?? false;
}

function log(level: LogLevel, category: string, message: string, data?: LogData): void {
  if (!shouldLog(level)) {
    return;
  }

  const timestamp = formatTimestamp();
  const dataStr = formatData(data);

  if (isTTY()) {
    // Colored output for terminal
    const levelColor = levelColors[level];
    const label = levelLabels[level];
    console.log(
      `${colors.gray}[${timestamp}]${colors.reset} ${levelColor}${label}${colors.reset} ${colors.cyan}${category}${colors.reset} ${message}${colors.gray}${dataStr}${colors.reset}`
    );
  } else {
    // Plain output for non-TTY (log files, piped output)
    const label = levelLabels[level].trim();
    console.log(`[${timestamp}] ${label} ${category} ${message}${dataStr}`);
  }
}

/**
 * Structured logger with support for debug, info, warn, and error levels.
 *
 * Usage:
 *   logger.info("request", "GET /posts/1", { status: 200, duration: "12ms" });
 *   logger.debug("db", "SELECT * FROM posts", { rows: 3 });
 *   logger.error("auth", "Token expired", { userId: 123 });
 *
 * Configure with LOG_LEVEL env var: debug | info | warn | error
 */
export const logger = {
  debug: (category: string, message: string, data?: LogData): void => {
    log("debug", category, message, data);
  },

  info: (category: string, message: string, data?: LogData): void => {
    log("info", category, message, data);
  },

  warn: (category: string, message: string, data?: LogData): void => {
    log("warn", category, message, data);
  },

  error: (category: string, message: string, data?: LogData): void => {
    log("error", category, message, data);
  },
};

// Export for testing
export { getLogLevel, shouldLog, formatTimestamp, formatData, isTTY };
