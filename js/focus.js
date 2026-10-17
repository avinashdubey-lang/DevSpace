import { state } from "./state.js";
import { updateTask } from "./tasks.js";
import { saveTasks } from "./api.js";

export const FOCUS_DURATION_MS = 25 * 60 * 1000;
const TICK_MS = 250;

let nowFn = () => Date.now();
let setIntervalFn = (callback, delay) => globalThis.setInterval(callback, delay);
let clearIntervalFn = id => globalThis.clearInterval(id);

let remainingMs = FOCUS_DURATION_MS;
let remainingAtStart = FOCUS_DURATION_MS;
let startedAt = 0;
let running = false;
let intervalId = null;
let onTick = null;

function getComputedRemaining() {
  if (!running) {
    return Math.max(0, remainingMs);
  }

  return Math.max(0, remainingAtStart - (nowFn() - startedAt));
}

function stopInterval() {
  if (intervalId === null) {
    return;
  }

  clearIntervalFn(intervalId);
  intervalId = null;
}

function emitTick() {
  if (typeof onTick === "function") {
    onTick(getFocusTimerState());
  }
}

function tick() {
  const remaining = getComputedRemaining();

  if (remaining <= 0) {
    remainingMs = 0;
    remainingAtStart = 0;
    startedAt = 0;
    running = false;
    stopInterval();
    emitTick();
    return;
  }

  emitTick();
}

export function configureFocusTimer(hooks = {}) {
  if (typeof hooks.now === "function") {
    nowFn = hooks.now;
  }

  if (typeof hooks.setInterval === "function") {
    setIntervalFn = hooks.setInterval;
  }

  if (typeof hooks.clearInterval === "function") {
    clearIntervalFn = hooks.clearInterval;
  }
}

export function restoreFocusTimerHooks() {
  nowFn = () => Date.now();
  setIntervalFn = (callback, delay) => globalThis.setInterval(callback, delay);
  clearIntervalFn = id => globalThis.clearInterval(id);
}

export function formatFocusTime(ms) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatFocusDuration(ms) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0 && seconds > 0) {
    return `PT${minutes}M${seconds}S`;
  }

  if (minutes > 0) {
    return `PT${minutes}M`;
  }

  return `PT${seconds}S`;
}

export function getFocusTimerState() {
  const remaining = getComputedRemaining();
  let phase = "idle";

  if (running) {
    phase = "running";
  } else if (remaining <= 0) {
    phase = "finished";
  } else if (remaining < FOCUS_DURATION_MS) {
    phase = "paused";
  }

  return {
    remainingMs: remaining,
    durationMs: FOCUS_DURATION_MS,
    running,
    phase,
    display: formatFocusTime(remaining)
  };
}

export function startFocusTimer(tickCallback) {
  if (typeof tickCallback === "function") {
    onTick = tickCallback;
  }

  if (running) {
    return getFocusTimerState();
  }

  let remaining = getComputedRemaining();

  if (remaining <= 0) {
    remaining = FOCUS_DURATION_MS;
    remainingMs = FOCUS_DURATION_MS;
  }

  remainingAtStart = remaining;
  remainingMs = remaining;
  startedAt = nowFn();
  running = true;
  stopInterval();
  intervalId = setIntervalFn(tick, TICK_MS);
  emitTick();

  return getFocusTimerState();
}

export function pauseFocusTimer() {
  if (running) {
    remainingMs = getComputedRemaining();
    remainingAtStart = remainingMs;
    startedAt = 0;
    running = false;
    stopInterval();
    emitTick();
  }

  return getFocusTimerState();
}

export function toggleFocusTimer(tickCallback) {
  if (running) {
    return pauseFocusTimer();
  }

  return startFocusTimer(tickCallback);
}

export function resetFocusTimer() {
  stopInterval();
  running = false;
  remainingMs = FOCUS_DURATION_MS;
  remainingAtStart = FOCUS_DURATION_MS;
  startedAt = 0;
  onTick = null;

  return getFocusTimerState();
}

export function cleanupFocusTimer() {
  if (running) {
    remainingMs = getComputedRemaining();
    remainingAtStart = remainingMs;
    startedAt = 0;
    running = false;
  }

  stopInterval();

  return getFocusTimerState();
}

export function isIncompleteTask(task) {
  return Boolean(
    task &&
      task.completed !== true &&
      task.status !== "done"
  );
}

export function getFocusTask() {
  if (!state.focusTaskId) {
    return null;
  }

  return state.tasks.find(task => task.id === state.focusTaskId) ?? null;
}

export function resolveFocusTask() {
  const selected = state.tasks.find(task => task.id === state.selectedTaskId);

  if (isIncompleteTask(selected)) {
    state.focusTaskId = selected.id;
    return selected;
  }

  const current = getFocusTask();

  if (isIncompleteTask(current)) {
    return current;
  }

  const incomplete = state.tasks.filter(isIncompleteTask);
  const inProgress = incomplete.find(task => task.status === "in-progress");
  const chosen = inProgress || incomplete[0] || null;

  state.focusTaskId = chosen ? chosen.id : null;

  return chosen;
}

export function syncFocusTask() {
  const current = getFocusTask();

  if (isIncompleteTask(current)) {
    return current;
  }

  state.focusTaskId = null;
  return null;
}

export function completeFocusTask() {
  const task = getFocusTask();

  if (!isIncompleteTask(task)) {
    return {
      ok: false,
      reason: "missing",
      task: null,
      saved: false
    };
  }

  const updated = updateTask(task.id, { status: "done" });

  if (!updated) {
    return {
      ok: false,
      reason: "invalid",
      task: null,
      saved: false
    };
  }

  const saved = saveTasks();

  pauseFocusTimer();
  state.focusTaskId = null;

  return {
    ok: true,
    reason: saved ? "completed" : "save-failed",
    task: updated,
    saved
  };
}
