import type { CameraState, SpriteRecord, SpriteUpsertInput } from "~/db/types";
import type { DbTable, WorkerEvent, WorkerRequest, WorkerResponse } from "~/db/worker/messages";

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: unknown) => void;
};

let workerInstance: Worker | null = null;
let initPromise: Promise<void> | null = null;

const pendingRequests = new Map<string, PendingRequest>();
const tableListeners = new Map<DbTable, Set<() => void>>();

function toError(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

function rejectAllPendingRequests(error: Error) {
  pendingRequests.forEach((pending) => {
    pending.reject(error);
  });
  pendingRequests.clear();
}

function assertBrowser() {
  if (typeof window === "undefined") {
    throw new Error("Database bridge is only available in the browser.");
  }
}

function isWorkerEvent(message: WorkerResponse): message is WorkerEvent {
  return message.type === "TABLE_UPDATED";
}

function getWorker() {
  assertBrowser();

  if (workerInstance) {
    return workerInstance;
  }

  const worker = new Worker(new URL("../worker/worker.ts", import.meta.url), {
    type: "module",
  });

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;

    if (isWorkerEvent(message)) {
      const listeners = tableListeners.get(message.table);
      listeners?.forEach((listener) => {
        listener();
      });
      return;
    }

    const pending = pendingRequests.get(message.requestId);
    if (!pending) {
      throw new Error(`No pending request found for worker response '${message.requestId}'.`);
    }

    pendingRequests.delete(message.requestId);

    if (message.ok) {
      pending.resolve(message.data);
      return;
    }

    pending.reject(new Error(message.error));
  };

  worker.onerror = (event: ErrorEvent) => {
    const error = toError(event.error, event.message || "Database worker execution failed.");
    rejectAllPendingRequests(error);
  };

  worker.onmessageerror = () => {
    rejectAllPendingRequests(new Error("Database worker sent an unreadable message."));
  };

  workerInstance = worker;
  return worker;
}

function sendRequest<TResponse>(request: WorkerRequest): Promise<TResponse> {
  const worker = getWorker();

  return new Promise<TResponse>((resolve, reject) => {
    if ("requestId" in request) {
      pendingRequests.set(request.requestId, { resolve, reject });
    }

    worker.postMessage(request);
  });
}

export function initializeDbBridge() {
  assertBrowser();

  if (initPromise) {
    return initPromise;
  }

  initPromise = sendRequest<null>({
    type: "INIT",
    requestId: crypto.randomUUID(),
  }).then(() => undefined);

  return initPromise;
}

export async function fetchSprites() {
  await initializeDbBridge();
  return sendRequest<SpriteRecord[]>({
    type: "GET_SPRITES",
    requestId: crypto.randomUUID(),
  });
}

export async function loadCameraState() {
  await initializeDbBridge();
  return sendRequest<CameraState | null>({
    type: "GET_CAMERA_STATE",
    requestId: crypto.randomUUID(),
  });
}

export async function persistSprite(nextSprite: SpriteUpsertInput) {
  await initializeDbBridge();
  return sendRequest<SpriteRecord>({
    type: "UPSERT_SPRITE",
    requestId: crypto.randomUUID(),
    payload: nextSprite,
  });
}

export async function persistCameraState(nextState: CameraState) {
  await initializeDbBridge();
  return sendRequest<null>({
    type: "SAVE_CAMERA_STATE",
    requestId: crypto.randomUUID(),
    payload: nextState,
  });
}

export function subscribeToTable(table: DbTable, listener: () => void) {
  const worker = getWorker();
  const existing = tableListeners.get(table);
  const listeners = existing ?? new Set<() => void>();
  const shouldSubscribe = listeners.size === 0;

  listeners.add(listener);
  tableListeners.set(table, listeners);

  if (shouldSubscribe) {
    worker.postMessage({ type: "SUBSCRIBE_TABLE", table } satisfies WorkerRequest);
  }

  return () => {
    const currentListeners = tableListeners.get(table);
    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (currentListeners.size === 0) {
      tableListeners.delete(table);
      worker.postMessage({ type: "UNSUBSCRIBE_TABLE", table } satisfies WorkerRequest);
    }
  };
}
