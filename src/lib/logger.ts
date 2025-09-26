export type LogLevel = "info" | "error";

export type LogContext = Record<string, unknown>;

const log = (level: LogLevel, message: string, context?: LogContext) => {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context } : {})
  };

  if (level === "error") {
    console.error(payload);
  } else {
    console.info(payload);
  }
};

export const logger = {
  info: (message: string, context?: LogContext) => log("info", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context)
};

export default logger;
