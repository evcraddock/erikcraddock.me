import { configure, getConsoleSink } from "@logtape/logtape";

/**
 * Configure logtape to capture Fedify's internal logs.
 * Call this early in app startup.
 */
export async function configureLogtape(): Promise<void> {
  await configure({
    sinks: {
      console: getConsoleSink(),
    },
    loggers: [
      {
        // Capture all Fedify logs
        category: ["fedify"],
        lowestLevel: "debug",
        sinks: ["console"],
      },
      {
        // Also capture logtape meta logs if needed
        category: ["logtape", "meta"],
        lowestLevel: "warning",
        sinks: ["console"],
      },
    ],
  });
}
