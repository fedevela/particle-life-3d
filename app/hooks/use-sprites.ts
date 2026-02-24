import { useCallback } from "react";

import { fetchSprites } from "~/db/client-bridge/bridge";
import type { JsonRecord, SpriteEntity } from "~/db/types";

import { useLiveTableQuery } from "./use-live-table-query";

const VALID_SPRITE_TYPES = new Set(["sphere"]);

function toError(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

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

function toFiniteNumber(value: unknown, context: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected finite numeric ${context}.`);
  }

  return parsed;
}

function toRequiredString(value: unknown, context: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Expected non-empty string ${context}.`);
  }

  return value;
}

/**
 * Fetch and validate sprite entities for 3D scene rendering.
 *
 * @returns Returns a live list of validated sprite entities.
 */
export function useSprites() {
  const querySprites = useCallback(async () => {
    try {
      const rows = await fetchSprites();

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
      throw toError(error, "Failed to load sprites.");
    }
  }, []);

  return useLiveTableQuery("sprites", querySprites, [] as SpriteEntity[]);
}
