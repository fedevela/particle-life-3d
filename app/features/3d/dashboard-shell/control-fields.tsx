import { useEffect, useRef, useState, type WheelEventHandler } from "react";

type NumericControlFieldProps = {
  id: string;
  label: string;
  tooltip?: string;
  value: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: string) => void;
  onWheel?: WheelEventHandler<HTMLInputElement>;
  inputMode?: "numeric" | "decimal";
  commitDelayMs?: number;
};

type TextControlFieldProps = {
  id: string;
  label: string;
  tooltip?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  commitDelayMs?: number;
};

type SelectControlFieldOption = {
  value: string;
  label: string;
};

type SelectControlFieldProps = {
  id: string;
  label: string;
  tooltip?: string;
  value: string;
  options: readonly SelectControlFieldOption[];
  onChange: (value: string) => void;
  commitDelayMs?: number;
};

function useDebouncedDraft(value: string, onCommit: (nextValue: string) => void, commitDelayMs = 0) {
  const [draft, setDraft] = useState(value);
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (deadlineMs === null) {
      return;
    }

    const intervalId = setInterval(() => {
      setDeadlineMs((current) => {
        if (current === null) {
          return null;
        }

        return current <= Date.now() ? null : current;
      });
    }, 100);

    return () => {
      clearInterval(intervalId);
    };
  }, [deadlineMs]);

  function scheduleCommit(nextValue: string) {
    setDraft(nextValue);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (commitDelayMs <= 0) {
      setDeadlineMs(null);
      onCommit(nextValue);
      return;
    }

    const nextDeadline = Date.now() + commitDelayMs;
    setDeadlineMs(nextDeadline);
    timeoutRef.current = setTimeout(() => {
      setDeadlineMs(null);
      onCommit(nextValue);
    }, commitDelayMs);
  }

  const pendingSeconds = deadlineMs === null ? null : Math.max(0, deadlineMs - Date.now()) / 1000;

  return {
    draft,
    scheduleCommit,
    pendingSeconds,
  };
}

export function getStepDecimals(step: number) {
  const text = step.toString();
  const dotIndex = text.indexOf(".");
  return dotIndex === -1 ? 0 : text.length - dotIndex - 1;
}

export function applyWheelStep(current: number, step: number, min: number | null, max: number | null, deltaY: number) {
  const direction = deltaY < 0 ? 1 : -1;
  let next = current + direction * step;

  if (min !== null) {
    next = Math.max(min, next);
  }

  if (max !== null) {
    next = Math.min(max, next);
  }

  const scale = 10 ** getStepDecimals(step);
  return Math.round(next * scale) / scale;
}

export function formatValueForStep(value: number, step: number) {
  return value.toFixed(getStepDecimals(step));
}

function PendingCommitOdometer({ id, pendingSeconds }: { id: string; pendingSeconds: number | null }) {
  if (pendingSeconds === null) {
    return null;
  }

  return (
    <p id={`${id}-pending-commit`} className="text-[10px] uppercase tracking-[0.1em] text-cyan-300/90">
      Applying in <span className="font-mono tabular-nums">{pendingSeconds.toFixed(1)}s</span>
    </p>
  );
}

export function NumericControlField(props: NumericControlFieldProps) {
  const { draft, scheduleCommit, pendingSeconds } = useDebouncedDraft(props.value, props.onChange, props.commitDelayMs);

  return (
    <div className="space-y-1">
      <label className="block text-[10px] uppercase tracking-[0.12em] text-cyan-200" htmlFor={props.id} title={props.tooltip}>
        {props.label}
      </label>
      <input
        id={props.id}
        type="number"
        inputMode={props.inputMode ?? "decimal"}
        min={props.min}
        max={props.max}
        step={props.step}
        title={props.tooltip}
        value={draft}
        onChange={(event) => scheduleCommit(event.target.value)}
        onWheel={props.onWheel}
        className="w-full rounded-md border border-cyan-800/70 bg-slate-950/90 px-2 py-1.5 text-sm text-slate-100 outline-none ring-cyan-300/50 transition focus:ring-2"
      />
      <PendingCommitOdometer id={props.id} pendingSeconds={pendingSeconds} />
    </div>
  );
}

export function TextControlField(props: TextControlFieldProps) {
  const { draft, scheduleCommit, pendingSeconds } = useDebouncedDraft(props.value, props.onChange, props.commitDelayMs);

  return (
    <div className="space-y-1">
      <label className="block text-[10px] uppercase tracking-[0.12em] text-cyan-200" htmlFor={props.id} title={props.tooltip}>
        {props.label}
      </label>
      <input
        id={props.id}
        type="text"
        title={props.tooltip}
        placeholder={props.placeholder}
        value={draft}
        onChange={(event) => scheduleCommit(event.target.value)}
        className="w-full rounded-md border border-cyan-800/70 bg-slate-950/90 px-2 py-1.5 text-sm text-slate-100 outline-none ring-cyan-300/50 transition focus:ring-2"
      />
      <PendingCommitOdometer id={props.id} pendingSeconds={pendingSeconds} />
    </div>
  );
}

export function SelectControlField(props: SelectControlFieldProps) {
  const { draft, scheduleCommit, pendingSeconds } = useDebouncedDraft(props.value, props.onChange, props.commitDelayMs);

  return (
    <div className="space-y-1">
      <label className="block text-[10px] uppercase tracking-[0.12em] text-cyan-200" htmlFor={props.id} title={props.tooltip}>
        {props.label}
      </label>
      <select
        id={props.id}
        value={draft}
        onChange={(event) => scheduleCommit(event.target.value)}
        className="w-full rounded-md border border-cyan-800/70 bg-slate-950/90 px-2 py-1.5 text-sm text-slate-100 outline-none ring-cyan-300/50 transition focus:ring-2"
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <PendingCommitOdometer id={props.id} pendingSeconds={pendingSeconds} />
    </div>
  );
}
