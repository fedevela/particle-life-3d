import { SqliteQueryExecutor } from "./sqlite-query-executor";

/** Define the deterministic row shape used by contract exports for sprites. */
type ContractSpriteRow = {
  type: string;
  x: string;
  y: string;
  z: string;
  metadata: string;
};

/** Define the deterministic row shape used by contract exports for variables. */
type ContractVariableRow = {
  name: string;
  value: string;
};

type ContractSimulationMilestoneRow = {
  milestoneId: string;
  frame: number;
  payload: [string, string, string];
};

/** Format a finite number into deterministic six-decimal text. */
function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error(`Expected finite numeric value, received ${String(value)}.`);
  }

  const formatted = value.toFixed(6);
  return formatted === "-0.000000" ? "0.000000" : formatted;
}

/** Canonicalize JSON object key order recursively while preserving array order. */
function sortJsonKeysRecursively(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonKeysRecursively(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const sortedEntries = Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => [key, sortJsonKeysRecursively(record[key])] as const);

  return Object.fromEntries(sortedEntries);
}

/** Return compact canonical JSON text when parseable; otherwise return the original text. */
function canonicalizeJsonOrRaw(input: string) {
  try {
    const parsed = JSON.parse(input) as unknown;
    const sorted = sortJsonKeysRecursively(parsed);
    return JSON.stringify(sorted);
  } catch {
    return input;
  }
}

/** Escape DB contract fields so separators and line-breaks remain deterministic. */
function escapeField(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("\n", "\\n");
}

/** Format deterministic sprite contract section for one project. */
export function formatSpriteSection(projectId: string, executor: SqliteQueryExecutor) {
  const rows = executor.selectAll("SELECT type, pos_x, pos_y, pos_z, metadata FROM sprites WHERE project_id = ?", [projectId]);

  const projected = rows
    .map<ContractSpriteRow>((row, index) => ({
      type: escapeField(executor.toStringValue(row.type, `sprites[${index}].type`)),
      x: formatNumber(executor.toFiniteNumber(row.pos_x, `sprites[${index}].pos_x`)),
      y: formatNumber(executor.toFiniteNumber(row.pos_y, `sprites[${index}].pos_y`)),
      z: formatNumber(executor.toFiniteNumber(row.pos_z, `sprites[${index}].pos_z`)),
      metadata: escapeField(
        canonicalizeJsonOrRaw(executor.toStringValue(row.metadata, `sprites[${index}].metadata`)),
      ),
    }))
    .sort((left, right) => {
      const leftTuple = [left.type, left.x, left.y, left.z, left.metadata];
      const rightTuple = [right.type, right.x, right.y, right.z, right.metadata];

      for (let tupleIndex = 0; tupleIndex < leftTuple.length; tupleIndex += 1) {
        const comparison = leftTuple[tupleIndex].localeCompare(rightTuple[tupleIndex]);
        if (comparison !== 0) {
          return comparison;
        }
      }

      return 0;
    });

  const lines = ["[sprites]", `count=${projected.length}`];

  for (let index = 0; index < projected.length; index += 1) {
    const next = projected[index];
    lines.push(`${index}|${next.type}|${next.x}|${next.y}|${next.z}|${next.metadata}`);
  }

  return lines.join("\n");
}

/** Format deterministic variable contract section for one project. */
export function formatVariableSection(projectId: string, executor: SqliteQueryExecutor) {
  const rows = executor.selectAll("SELECT name, value FROM variables WHERE project_id = ?", [projectId]);

  const projected = rows
    .map<ContractVariableRow>((row, index) => ({
      name: escapeField(executor.toStringValue(row.name, `variables[${index}].name`)),
      value: escapeField(
        canonicalizeJsonOrRaw(executor.toStringValue(row.value, `variables[${index}].value`)),
      ),
    }))
    .sort((left, right) => {
      const nameComparison = left.name.localeCompare(right.name);
      if (nameComparison !== 0) {
        return nameComparison;
      }

      return left.value.localeCompare(right.value);
    });

  const lines = ["[variables]", `count=${projected.length}`];

  for (let index = 0; index < projected.length; index += 1) {
    const next = projected[index];
    lines.push(`${index}|${next.name}|${next.value}`);
  }

  return lines.join("\n");
}

export function formatSimulationMilestoneSection(projectId: string, executor: SqliteQueryExecutor) {
  const rows = executor.selectAll(
    "SELECT milestone_id, frame, payload_x, payload_y, payload_z FROM simulation_snapshots WHERE project_id = ?",
    [projectId],
  );

  const projected = rows
    .map<ContractSimulationMilestoneRow>((row, index) => ({
      milestoneId: escapeField(
        executor.toStringValue(row.milestone_id, `simulation_snapshots[${index}].milestone_id`),
      ),
      frame: executor.toFiniteNumber(row.frame, `simulation_snapshots[${index}].frame`),
      payload: [
        formatNumber(executor.toFiniteNumber(row.payload_x, `simulation_snapshots[${index}].payload_x`)),
        formatNumber(executor.toFiniteNumber(row.payload_y, `simulation_snapshots[${index}].payload_y`)),
        formatNumber(executor.toFiniteNumber(row.payload_z, `simulation_snapshots[${index}].payload_z`)),
      ],
    }))
    .sort((left, right) => {
      const frameComparison = left.frame - right.frame;
      if (frameComparison !== 0) {
        return frameComparison;
      }

      return left.milestoneId.localeCompare(right.milestoneId);
    });

  const lines = ["[simulation_milestones]"];
  for (const milestone of projected) {
    lines.push(`milestone_id: ${milestone.milestoneId}`);
    lines.push(`frame: ${milestone.frame}`);
    lines.push(`payload: ${milestone.payload.join("|")}`);
    lines.push("---");
  }

  return lines.join("\n");
}
