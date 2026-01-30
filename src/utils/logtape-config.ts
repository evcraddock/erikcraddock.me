import { configure, getConsoleSink } from "@logtape/logtape";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Configure logtape to capture Fedify's internal logs.
 * Call this early in app startup.
 */
export async function configureLogtape(): Promise<void> {
  await configure({
    contextLocalStorage: new AsyncLocalStorage(),
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
