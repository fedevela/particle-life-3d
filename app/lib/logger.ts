/** Define supported logging levels used by scoped loggers. */
type LogLevel = "debug" | "info" | "warn" | "error";

/** Enable verbose logs only during local development. */
const LOG_ENABLED = import.meta.env.DEV;

/** Write one scoped log line with optional structured context payload. */
function writeLog(scope: string, level: LogLevel, message: string, context?: unknown) {
  if (!LOG_ENABLED) {
    return;
  }

  const prefix = `${new Date().toISOString()} [particle-life:${scope}] ${message}`;

  if (context === undefined) {
    console[level](prefix);
    return;
  }

  console[level](prefix, context);
}

/** Create a scoped logger used for development-time diagnostics. */
export function createLogger(scope: string) {
  return {
    debug: (message: string, context?: unknown) => writeLog(scope, "debug", message, context),
    info: (message: string, context?: unknown) => writeLog(scope, "info", message, context),
    warn: (message: string, context?: unknown) => writeLog(scope, "warn", message, context),
    error: (message: string, context?: unknown) => writeLog(scope, "error", message, context),
  };
}
