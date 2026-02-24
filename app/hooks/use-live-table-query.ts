import { useEffect, useState } from "react";

import { initializeDbBridge, subscribeToTable } from "~/db/client-bridge/bridge";
import type { DbTable } from "~/db/worker/messages";

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
