import { useEffect, useState } from "react";

import { initializeDbBridge, subscribeToTable } from "~/db/client-bridge/bridge";
import type { DbTable } from "~/db/worker/messages";

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
  const [value, setValue] = useState<T>(initialValue);
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    throw error;
  }

  useEffect(() => {
    let isDisposed = false;

    // Re-run the consumer query and keep the latest successful value.
    const refresh = async () => {
      try {
        const next = await query();
        if (!isDisposed) {
          setValue(next);
          setError(null);
        }
      } catch (refreshError: unknown) {
        if (!isDisposed) {
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
          void refresh();
        }
      })
      .catch((initError: unknown) => {
        if (!isDisposed) {
          setError(
            initError instanceof Error
              ? initError
              : new Error("Failed to initialize database bridge."),
          );
        }
      });

    // Keep this hook live by subscribing to worker table update events.
    const unsubscribe = subscribeToTable(table, () => {
      void refresh();
    });

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, [query, table]);

  return value;
}
