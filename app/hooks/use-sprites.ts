import { useCallback } from "react";

import { fetchSprites } from "~/db/client-bridge/bridge";
import type { JsonRecord, SpriteEntity } from "~/db/types";
import { createLogger } from "~/lib/logger";

import { useLiveTableQuery } from "./use-live-table-query";

/** List supported sprite types currently handled by the scene renderer. */
const VALID_SPRITE_TYPES = new Set(["sphere"]);
/** Provide scoped logs for sprite query and mapping lifecycle. */
const logger = createLogger("use-sprites");

/** Normalize unknown failures into Error instances. */
function toError(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

/** Parse and validate sprite metadata JSON as an object payload. */
function parseMetadata(raw: string, spriteId: string): JsonRecord {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON metadata for sprite '${spriteId}'.`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Metadata for sprite '${spriteId}' must be a JSON object.`);
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

/** Validate that a sprite identifier is a canonical UUIDv4 string. */
/**
 * Fetch and validate sprite entities for 3D scene rendering.
 *
 * @returns Returns a live list of validated sprite entities.
 */
export function useSprites() {
  const querySprites = useCallback(async () => {
    try {
      const rows = await fetchSprites();
      logger.debug("Map fetched sprite rows.", { rowCount: rows.length });

      // Convert persistence rows into strictly validated scene entities.
      return rows.map<SpriteEntity>((row) => {
        const id = toRequiredString(row.id, "sprite id");
        const type = toRequiredString(row.type, `sprite '${id}' type`);
        if (!VALID_SPRITE_TYPES.has(type)) {
          throw new Error(`Unsupported sprite type '${type}' for sprite '${id}'.`);
        }

        const metadata = parseMetadata(toRequiredString(row.metadata, `sprite '${id}' metadata`), id);

        return {
          id,
          type,
          position: [
            toFiniteNumber(row.pos_x, `x coordinate for sprite '${id}'`),
            toFiniteNumber(row.pos_y, `y coordinate for sprite '${id}'`),
            toFiniteNumber(row.pos_z, `z coordinate for sprite '${id}'`),
          ],
          metadata,
        };
      });
    } catch (error: unknown) {
      logger.error("Load sprites failed.", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw toError(error, "Failed to load sprites.");
    }
  }, []);

  return useLiveTableQuery("sprites", querySprites, [] as SpriteEntity[]);
}
