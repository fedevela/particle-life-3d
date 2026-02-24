import type { CameraState, SpriteRecord, SpriteUpsertInput } from "~/db/types";
import type {
  ContractScope,
  DbTable,
  WorkerEvent,
  WorkerRequest,
  WorkerResponse,
} from "~/db/worker/messages";
import { createLogger } from "~/lib/logger";
import { assertUuidV4 } from "~/lib/uuid";

/** Track a request Promise pair waiting for worker completion. */
type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: unknown) => void;
  requestType: WorkerRequest["type"];
};

/** Provide scoped logs for DB bridge activity. */
const logger = createLogger("db-bridge");

/** Hold the singleton database worker instance for this browser tab. */
let workerInstance: Worker | null = null;
/** Cache bridge initialization so callers can share one startup request. */
let initPromise: Promise<void> | null = null;

/** Map request IDs to pending promise handlers. */
const pendingRequests = new Map<string, PendingRequest>();
/** Track per-table listeners for worker table update events. */
const tableListeners = new Map<DbTable, Set<() => void>>();
/** Define the localStorage key that holds the default UI project id. */
const UI_PROJECT_ID_STORAGE_KEY = "particle-life:ui-project-id";

/** Convert unknown failures into Error objects with a fallback message. */
function toError(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

/** Reject and clear all in-flight requests when the worker becomes unhealthy. */
function rejectAllPendingRequests(error: Error) {
  logger.error("Reject all pending worker requests.", {
    pendingCount: pendingRequests.size,
    error: error.message,
  });
  pendingRequests.forEach((pending) => {
    pending.reject(error);
  });
  pendingRequests.clear();
}

/** Ensure this module is only used in the browser runtime. */
function assertBrowser() {
  if (typeof window === "undefined") {
    throw new Error("Database bridge is only available in the browser.");
  }
}

/** Normalize optional projectId input and fail when empty. */
function normalizeProjectId(projectId: string, context: string) {
  const normalized = projectId.trim();
  if (normalized.length === 0) {
    throw new Error(`Expected non-empty ${context}.`);
  }

  return normalized;
}

/** Resolve project scope from explicit input or URL query parameter. */
function resolveProjectId(projectId?: string) {
  if (typeof projectId === "string") {
    return normalizeProjectId(projectId, "projectId");
  }

  assertBrowser();

  const candidateProjectId = new URLSearchParams(window.location.search).get("projectId");
  if (candidateProjectId) {
    return normalizeProjectId(candidateProjectId, "projectId query parameter");
  }

  const candidateStoredProjectId = window.localStorage.getItem(UI_PROJECT_ID_STORAGE_KEY);
  if (candidateStoredProjectId) {
    return normalizeProjectId(candidateStoredProjectId, "localStorage projectId");
  }

  throw new Error("Missing required projectId. Provide projectId in URL query params or API arguments.");
}

/** Narrow worker responses to event messages. */
function isWorkerEvent(message: WorkerResponse): message is WorkerEvent {
  return message.type === "TABLE_UPDATED";
}

/** Create or return the singleton worker instance and wire message handlers. */
function getWorker() {
  assertBrowser();

  if (workerInstance) {
    return workerInstance;
  }

  logger.info("Create database worker instance.");

  const worker = new Worker(new URL("../worker/worker.ts", import.meta.url), {
    type: "module",
  });

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;

    if (isWorkerEvent(message)) {
      const listeners = tableListeners.get(message.table);
      logger.debug("Receive table update event.", {
        table: message.table,
        listenerCount: listeners?.size ?? 0,
      });
      listeners?.forEach((listener) => {
        listener();
      });
      return;
    }

    // Resolve/reject the Promise created for this specific requestId.
    const pending = pendingRequests.get(message.requestId);
    if (!pending) {
      logger.error("Receive worker response with no pending request.", {
        requestId: message.requestId,
      });
      throw new Error(`No pending request found for worker response '${message.requestId}'.`);
    }

    pendingRequests.delete(message.requestId);

    if (message.ok) {
      logger.debug("Resolve worker request.", {
        requestId: message.requestId,
        requestType: pending.requestType,
      });
      pending.resolve(message.data);
      return;
    }

    logger.warn("Reject worker request with worker error.", {
      requestId: message.requestId,
      requestType: pending.requestType,
      error: message.error,
    });

    pending.reject(new Error(message.error));
  };

  worker.onerror = (event: ErrorEvent) => {
    const error = toError(event.error, event.message || "Database worker execution failed.");
    logger.error("Receive worker runtime error.", { error: error.message });
    rejectAllPendingRequests(error);
  };

  worker.onmessageerror = () => {
    logger.error("Receive unreadable message from worker.");
    rejectAllPendingRequests(new Error("Database worker sent an unreadable message."));
  };

  workerInstance = worker;
  return worker;
}

/** Send a typed request to the worker and await its response. */
function sendRequest<TResponse>(request: WorkerRequest): Promise<TResponse> {
  const worker = getWorker();

  return new Promise<TResponse>((resolve, reject) => {
    if ("requestId" in request) {
      pendingRequests.set(request.requestId, {
        resolve,
        reject,
        requestType: request.type,
      });

      logger.debug("Send worker request.", {
        requestId: request.requestId,
        requestType: request.type,
      });
    } else {
      logger.debug("Send worker request without requestId.", {
        requestType: request.type,
      });
    }

    worker.postMessage(request);
  });
}

/**
 * Initialize the SQLite worker bridge once per browser session.
 *
 * @returns Returns a promise that resolves when the worker reports DB readiness.
 */
export function initializeDbBridge() {
  assertBrowser();

  if (initPromise) {
    logger.debug("Reuse cached database bridge initialization promise.");
    return initPromise;
  }

  logger.info("Initialize database bridge.");

  // Cache initialization so consumers can safely call this in parallel.
  initPromise = sendRequest<null>({
    type: "INIT",
    requestId: crypto.randomUUID(),
  }).then(() => undefined);

  return initPromise;
}

/**
 * Fetch all persisted sprites from the worker-backed repository.
 *
 * @returns Returns all persisted sprites.
 */
export async function fetchSprites(projectId?: string) {
  const resolvedProjectId = resolveProjectId(projectId);
  logger.debug("Fetch sprites from worker.");
  await initializeDbBridge();
  return sendRequest<SpriteRecord[]>({
    type: "GET_SPRITES",
    requestId: crypto.randomUUID(),
    projectId: resolvedProjectId,
  });
}

/**
 * Load persisted camera state for scene restoration.
 *
 * @returns Returns persisted camera state when present; otherwise `null`.
 */
export async function loadCameraState(projectId?: string) {
  const resolvedProjectId = resolveProjectId(projectId);
  logger.debug("Load camera state from worker.");
  await initializeDbBridge();
  return sendRequest<CameraState | null>({
    type: "GET_CAMERA_STATE",
    requestId: crypto.randomUUID(),
    projectId: resolvedProjectId,
  });
}

/**
 * Persist a sprite record by inserting or updating it.
 *
 * @param nextSprite Sprite payload to persist.
 * @returns Returns the persisted sprite record.
 */
export async function persistSprite(nextSprite: SpriteUpsertInput, projectId?: string) {
  const resolvedProjectId = resolveProjectId(projectId);

  if (nextSprite.id) {
    assertUuidV4(nextSprite.id, "sprite id");
  }

  logger.info("Persist single sprite update.", {
    spriteId: nextSprite.id ?? null,
    spriteType: nextSprite.type,
  });
  await initializeDbBridge();
  return sendRequest<SpriteRecord>({
    type: "upsert_sprite",
    requestId: crypto.randomUUID(),
    projectId: resolvedProjectId,
    payload: nextSprite,
  });
}

/**
 * Persist a world-state patch by upserting only provided sprite rows.
 *
 * @param worldStatePatch Sprite updates to persist.
 * @returns Returns persisted sprite records for the provided patch.
 */
export async function persistWorldState(worldStatePatch: SpriteUpsertInput[], projectId?: string) {
  const resolvedProjectId = resolveProjectId(projectId);

  for (const nextSprite of worldStatePatch) {
    if (nextSprite.id) {
      assertUuidV4(nextSprite.id, "sprite id");
    }
  }

  logger.info("Persist world-state patch.", {
    patchSize: worldStatePatch.length,
  });
  await initializeDbBridge();
  return sendRequest<SpriteRecord[]>({
    type: "upsert_sprites",
    requestId: crypto.randomUUID(),
    projectId: resolvedProjectId,
    payload: worldStatePatch,
  });
}

/**
 * Persist camera state used by scene controls restoration.
 *
 * @param nextState Camera position/target snapshot.
 * @returns Returns a promise that resolves when persistence completes.
 */
export async function persistCameraState(nextState: CameraState, projectId?: string) {
  const resolvedProjectId = resolveProjectId(projectId);

  logger.debug("Persist camera state snapshot.", {
    position: nextState.position,
    target: nextState.target,
  });
  await initializeDbBridge();
  return sendRequest<null>({
    type: "SAVE_CAMERA_STATE",
    requestId: crypto.randomUUID(),
    projectId: resolvedProjectId,
    payload: nextState,
  });
}

/**
 * Read raw DB contract text for a project.
 *
 * @param projectId Optional project scope override.
 * @param scope Optional section filter.
 * @returns Returns repository contract text exactly as returned by the worker.
 */
export async function getProjectContractText(projectId?: string, scope?: ContractScope) {
  const resolvedProjectId = resolveProjectId(projectId);
  logger.debug("Fetch project contract text from worker.", {
    projectId: resolvedProjectId,
    scope: scope ?? "all",
  });
  await initializeDbBridge();
  return sendRequest<string>({
    type: "GET_PROJECT_CONTRACT_TEXT",
    requestId: crypto.randomUUID(),
    projectId: resolvedProjectId,
    scope,
  });
}

/**
 * Delete all persisted records for a project scope.
 *
 * @param projectId Optional project scope override.
 * @returns Returns a promise that resolves when delete completes.
 */
export async function deleteProjectData(projectId?: string) {
  const resolvedProjectId = resolveProjectId(projectId);
  logger.info("Delete project data in worker.", { projectId: resolvedProjectId });
  await initializeDbBridge();
  return sendRequest<null>({
    type: "DELETE_PROJECT_DATA",
    requestId: crypto.randomUUID(),
    projectId: resolvedProjectId,
  });
}

/**
 * Subscribe to worker-side updates for a table.
 *
 * @param table Table name to observe.
 * @param listener Callback invoked on worker update events.
 * @returns Returns an unsubscribe function.
 */
export function subscribeToTable(table: DbTable, listener: () => void) {
  const worker = getWorker();
  const existing = tableListeners.get(table);
  const listeners = existing ?? new Set<() => void>();
  const shouldSubscribe = listeners.size === 0;

  listeners.add(listener);
  tableListeners.set(table, listeners);

  logger.debug("Register table listener.", {
    table,
    listenerCount: listeners.size,
  });

  // Tell the worker to emit update events only while this table has listeners.
  if (shouldSubscribe) {
    logger.info("Subscribe worker to table updates.", { table });
    worker.postMessage({ type: "SUBSCRIBE_TABLE", table } satisfies WorkerRequest);
  }

  return () => {
    const currentListeners = tableListeners.get(table);
    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    logger.debug("Unregister table listener.", {
      table,
      listenerCount: currentListeners.size,
    });

    if (currentListeners.size === 0) {
      tableListeners.delete(table);
      logger.info("Unsubscribe worker from table updates.", { table });
      worker.postMessage({ type: "UNSUBSCRIBE_TABLE", table } satisfies WorkerRequest);
    }
  };
}
