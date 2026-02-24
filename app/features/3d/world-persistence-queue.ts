import { persistWorldState } from "~/db/client-bridge/bridge";
import type { SpriteUpsertInput } from "~/db/types";
import { createLogger } from "~/lib/logger";

/** Define the debounce delay applied before flushing queued sprite updates. */
const SPRITE_PERSIST_DELAY_MS = 5000;
/** Define the maximum number of sprite updates persisted per worker request. */
const MAX_BATCH_SIZE = 1024;
/** Provide scoped logs for world-state queue operations. */
const logger = createLogger("world-persistence-queue");

/** Store latest queued sprite update per sprite ID. */
const queuedSpriteUpdates = new Map<string, SpriteUpsertInput>();
/** Track the active debounce timer for queue flush scheduling. */
let debouncedFlushTimer: number | null = null;
/** Track an in-flight flush so concurrent callers share one promise. */
let flushPromise: Promise<void> | null = null;

/** Define controls for a sprite action that completes across render steps. */
export type SpriteRenderActionTracker = {
  step: (nextState: SpriteUpsertInput) => void;
  complete: (nextState: SpriteUpsertInput) => void;
  cancel: () => void;
};

/** Represent a sprite upsert payload with a guaranteed UUIDv4 id. */
type SpriteUpsertWithId = SpriteUpsertInput & { id: string };

/** Ensure queued sprite state has a UUIDv4 id, generating one when missing. */
function ensureSpriteStateId(nextState: SpriteUpsertInput) {
  if (!nextState.id) {
    const initializedId = crypto.randomUUID();

    logger.info("Initialize sprite id for queued state.", {
      spriteId: initializedId,
      spriteType: nextState.type,
    });

    return {
      ...nextState,
      id: initializedId,
    } satisfies SpriteUpsertWithId;
  }

  return {
    ...nextState,
    id: nextState.id,
  } satisfies SpriteUpsertWithId;
}

/** Split a list into fixed-size batches. */
function toBatches(items: SpriteUpsertInput[], size: number) {
  const batches: SpriteUpsertInput[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

/** Schedule a debounced flush of queued sprite updates. */
function scheduleDebouncedFlush() {
  if (debouncedFlushTimer) {
    window.clearTimeout(debouncedFlushTimer);
  }

  logger.debug("Schedule debounced world-state flush.", {
    delayMs: SPRITE_PERSIST_DELAY_MS,
    queuedCount: queuedSpriteUpdates.size,
  });

  debouncedFlushTimer = window.setTimeout(() => {
    debouncedFlushTimer = null;
    logger.info("Run debounced world-state flush.", {
      queuedCount: queuedSpriteUpdates.size,
    });
    void flushQueuedWorldState();
  }, SPRITE_PERSIST_DELAY_MS);
}

/**
 * Queue created sprite state for delayed, debounced world persistence.
 *
 * If multiple updates for the same sprite are queued before flush, only the latest state is persisted.
 *
 * @param nextState Created sprite state snapshot to persist.
 * @returns Returns nothing.
 */
export function queueCreatedSpriteState(nextState: SpriteUpsertInput) {
  const normalizedState = ensureSpriteStateId(nextState);
  const spriteId = normalizedState.id;
  queuedSpriteUpdates.set(spriteId, normalizedState);
  logger.info("Queue created sprite state.", {
    spriteId,
    queuedCount: queuedSpriteUpdates.size,
  });
  scheduleDebouncedFlush();
}

/**
 * Queue updated sprite state for delayed, debounced world persistence.
 *
 * If multiple updates for the same sprite are queued before flush, only the latest state is persisted.
 *
 * @param nextState Updated sprite state snapshot to persist.
 * @returns Returns nothing.
 */
export function queueUpdatedSpriteState(nextState: SpriteUpsertInput) {
  const normalizedState = ensureSpriteStateId(nextState);
  const spriteId = normalizedState.id;
  queuedSpriteUpdates.set(spriteId, normalizedState);
  logger.debug("Queue updated sprite state.", {
    spriteId,
    queuedCount: queuedSpriteUpdates.size,
  });
  scheduleDebouncedFlush();
}

/**
 * Flush queued sprite patches to persistence immediately in batches of at most 1024 rows.
 *
 * @returns Returns a promise that resolves when the current queue flush completes.
 */
export async function flushQueuedWorldState() {
  if (flushPromise) {
    logger.debug("Reuse in-flight world-state flush promise.");
    return flushPromise;
  }

  const worldStatePatch = Array.from(queuedSpriteUpdates.values());
  if (worldStatePatch.length === 0) {
    logger.debug("Skip world-state flush because queue is empty.");
    return;
  }

  queuedSpriteUpdates.clear();
  const batches = toBatches(worldStatePatch, MAX_BATCH_SIZE);

  logger.info("Flush queued sprite world-state patch.", {
    queuedCount: worldStatePatch.length,
    batchCount: batches.length,
    maxBatchSize: MAX_BATCH_SIZE,
  });

  flushPromise = (async () => {
    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];

      logger.debug("Persist sprite batch.", {
        batchIndex: index + 1,
        batchCount: batches.length,
        batchSize: batch.length,
      });

      try {
        await persistWorldState(batch);
        logger.debug("Persist sprite batch success.", {
          batchIndex: index + 1,
          batchSize: batch.length,
        });
      } catch (error: unknown) {
        logger.error("Persist sprite batch failed; re-queue remaining updates.", {
          batchIndex: index + 1,
          batchCount: batches.length,
          error: error instanceof Error ? error.message : String(error),
        });

        for (let restoreIndex = index; restoreIndex < batches.length; restoreIndex += 1) {
          for (const nextState of batches[restoreIndex]) {
            const normalizedState = ensureSpriteStateId(nextState);
            const spriteId = normalizedState.id;
            queuedSpriteUpdates.set(spriteId, normalizedState);
          }
        }

        throw error;
      }
    }
  })()
    .then(() => undefined)
    .finally(() => {
      flushPromise = null;

      logger.info("Complete world-state flush.", {
        remainingQueuedCount: queuedSpriteUpdates.size,
      });

      if (queuedSpriteUpdates.size > 0) {
        scheduleDebouncedFlush();
      }
    });

  return flushPromise;
}

/**
 * Create a render-step tracker that queues persistence once an action finishes.
 *
 * Use this when a sprite transition spans a known number of render steps.
 *
 * @param totalRenderSteps Number of render steps required for the action.
 * @returns Returns step/complete/cancel controls for the action lifecycle.
 */
export function createSpriteRenderActionTracker(totalRenderSteps: number): SpriteRenderActionTracker {
  if (!Number.isInteger(totalRenderSteps) || totalRenderSteps <= 0) {
    throw new Error("Expected totalRenderSteps to be a positive integer.");
  }

  let completedSteps = 0;
  let isActive = true;

  /** Queue persistence once all required render steps are complete. */
  const completeIfReady = (nextState: SpriteUpsertInput) => {
    if (!isActive || completedSteps < totalRenderSteps) {
      return;
    }

    isActive = false;
    queueUpdatedSpriteState(nextState);
  };

  return {
    step: (nextState) => {
      if (!isActive) {
        return;
      }

      completedSteps += 1;
      completeIfReady(nextState);
    },
    complete: (nextState) => {
      if (!isActive) {
        return;
      }

      completedSteps = totalRenderSteps;
      completeIfReady(nextState);
    },
    cancel: () => {
      isActive = false;
    },
  };
}
