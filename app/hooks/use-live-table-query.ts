import { useEffect, useState } from "react";

import { initializeDbBridge, subscribeToTable } from "~/db/client-bridge/bridge";
import type { DbTable } from "~/db/worker/messages";
import { createLogger } from "~/lib/logger";

/** Provide scoped logs for live query lifecycle events. */
const logger = createLogger("use-live-table-query");

/**
 * Subscribe to worker table updates and keep query data fresh.
 *
 * @param table Worker table channel to subscribe to.
 * @param query Async loader invoked during initialization and updates.
 * @param initialValue Initial state returned before first successful refresh.
 * @returns Returns the latest successful query result.
 */
export function useLiveTableQuery<T>(
  table: DbTable,
  query: () => Promise<T>,
  initialValue: T,
) {
  /** Store the latest successful query result. */
  const [value, setValue] = useState<T>(initialValue);
  /** Store the latest terminal error raised by refresh/initialization. */
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    throw error;
  }

  useEffect(() => {
    let isDisposed = false;

    // Re-run the consumer query and keep the latest successful value.
    const refresh = async () => {
      logger.debug("Refresh live table query.", { table });

      try {
        const next = await query();
        if (!isDisposed) {
          setValue(next);
          setError(null);
          logger.debug("Refresh live table query success.", { table });
        }
      } catch (refreshError: unknown) {
        if (!isDisposed) {
          logger.error("Refresh live table query failed.", {
            table,
            error: refreshError instanceof Error ? refreshError.message : String(refreshError),
          });

          setError(
            refreshError instanceof Error
              ? refreshError
              : new Error(`Failed to refresh '${table}' table query.`),
          );
        }
      }
    };

    // Ensure worker + DB are ready before the first query execution.
    void initializeDbBridge()
      .then(() => {
        if (!isDisposed) {
          logger.info("Initialize live table query bridge.", { table });
          void refresh();
        }
      })
      .catch((initError: unknown) => {
        if (!isDisposed) {
          logger.error("Initialize live table query bridge failed.", {
            table,
            error: initError instanceof Error ? initError.message : String(initError),
          });

          setError(
            initError instanceof Error
              ? initError
              : new Error("Failed to initialize database bridge."),
          );
        }
      });

    // Keep this hook live by subscribing to worker table update events.
    const unsubscribe = subscribeToTable(table, () => {
      logger.debug("Receive live table update event.", { table });
      void refresh();
    });

    return () => {
      isDisposed = true;
      logger.debug("Dispose live table query subscription.", { table });
      unsubscribe();
    };
  }, [query, table]);

  return value;
}
