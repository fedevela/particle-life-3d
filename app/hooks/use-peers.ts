import { useCallback } from "react";

import { fetchSprites } from "~/db/client-bridge/bridge";
import type { JsonRecord, SpriteEntity } from "~/db/types";
import { createLogger } from "~/lib/logger";

import { useLiveTableQuery } from "./use-live-table-query";

/** List supported peer (sprite) types currently handled by the scene renderer. */
const VALID_PEER_TYPES = new Set(["sphere"]);
/** Provide scoped logs for peer query and mapping lifecycle. */
const logger = createLogger("use-peers");

/** Normalize unknown failures into Error instances. */
function toError(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

/** Parse and validate peer metadata JSON as an object payload. */
function parseMetadata(raw: string, peerId: string): JsonRecord {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON metadata for peer '${peerId}'.`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Metadata for peer '${peerId}' must be a JSON object.`);
  }

  return parsed as JsonRecord;
}

/** Convert unknown numeric input into a finite number. */
function toFiniteNumber(value: unknown, context: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected finite numeric ${context}.`);
  }

  return parsed;
}

/** Convert unknown input into a required non-empty string. */
function toRequiredString(value: unknown, context: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Expected non-empty string ${context}.`);
  }

  return value;
}

/**
 * Fetch and validate peers (autonomous agents) for 3D scene rendering.
 *
 * @returns Returns a live list of validated peer entities.
 */
export function usePeers(projectId: string) {
  const queryPeers = useCallback(async () => {
    try {
      const rows = await fetchSprites(projectId);
      logger.debug("Map fetched peer rows.", { rowCount: rows.length });

      // Convert persistence rows into strictly validated scene entities.
      return rows.map<SpriteEntity>((row) => {
        const id = toRequiredString(row.id, "peer id");
        const type = toRequiredString(row.type, `peer '${id}' type`);
        if (!VALID_PEER_TYPES.has(type)) {
          throw new Error(`Unsupported peer type '${type}' for peer '${id}'.`);
        }

        const metadata = parseMetadata(toRequiredString(row.metadata, `peer '${id}' metadata`), id);

        return {
          id,
          type,
          position: [
            toFiniteNumber(row.pos_x, `x coordinate for peer '${id}'`),
            toFiniteNumber(row.pos_y, `y coordinate for peer '${id}'`),
            toFiniteNumber(row.pos_z, `z coordinate for peer '${id}'`),
          ],
          metadata,
        };
      });
    } catch (error: unknown) {
      logger.error("Load peers failed.", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw toError(error, "Failed to load peers.");
    }
  }, [projectId]);

  return useLiveTableQuery("sprites", queryPeers, [] as SpriteEntity[]);
}
