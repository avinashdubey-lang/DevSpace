import test, { beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";

import { state, projects } from "./js/state.js";
import {
  createTask,
  updateTask,
  deleteTask,
  getTasksByStatus,
  isIncompleteTask,
  validPriorities,
  validStatuses
} from "./js/tasks.js";
import {
  createTodayFocusRow,
  renderOverview,
  renderOverviewMetrics,
  renderTodayFocus,
  renderProjectHeader,
  renderKanban,
  renderView
} from "./js/render.js";
import {
  completeTaskById,
  closeTaskModal,
  openCreateTaskModal,
  openEditTaskModal,
  handleNavigationClick,
  handleKeydown,
  setLastFocusedElement,
  getLastFocusedElement
} from "./js/events.js";
import {
  saveTasks,
  loadTasks,
  isValidTask,
  STORAGE_KEY
} from "./js/api.js";
import {
  FOCUS_DURATION_MS,
  cleanupFocusTimer,
  completeFocusTask,
  configureFocusTimer,
  getFocusTimerState,
  pauseFocusTimer,
  resetFocusTimer,
  resolveFocusTask,
  restoreFocusTimerHooks,
  startFocusTimer,
  syncFocusTask
} from "./js/focus.js";

// Canonical snapshot of sample tasks to reset state between tests.
const SAMPLE_TASKS_SNAPSHOT = [
  {
    id: "DEV-142",
    title: "Implement JWT refresh flow",
    status: "backlog",
    priority: "high",
    labels: ["backend", "auth"],
    dueDate: "Today",
    assignee: "AD",
    completed: false
  },
  {
    id: "DEV-138",
    title: "Fix PostgreSQL connection pooling",
    status: "todo",
    priority: "medium",
    labels: ["database"],
    dueDate: "Today",
    assignee: "AD",
    completed: false
  },
  {
    id: "API-028",
    title: "Review API error handling",
    status: "in-progress",
    priority: "medium",
    labels: ["api"],
    dueDate: "Tomorrow",
    assignee: "AD",
    completed: false
  },
  {
    id: "DEV-151",
    title: "Build authentication middleware",
    status: "review",
    priority: "high",
    labels: ["backend", "auth"],
    dueDate: "Oct 12",
    assignee: "AD",
    completed: false
  },
  {
    id: "DEV-129",
    title: "Setup PostgreSQL schema",
    status: "done",
    priority: "low",
    labels: ["database"],
    dueDate: "Oct 5",
    assignee: "AD",
    completed: true
  }
];

function createMockLocalStorage(initialData = {}) {
  const store = new Map();
  for (const [key, value] of Object.entries(initialData)) {
    store.set(key, String(value));
  }

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    get length() {
      return store.size;
    },
    _getRaw(key) {
      return store.get(key);
    }
  };
}

const originalLocalStorage = globalThis.localStorage;
let mockStorage;

beforeEach(() => {
  // Deep clone initial tasks to ensure clean isolation
  state.tasks = JSON.parse(JSON.stringify(SAMPLE_TASKS_SNAPSHOT));
  state.selectedTaskId = null;
  state.focusTaskId = null;
  state.loading = false;
  state.error = null;
  state.activeView = "overview";
  restoreFocusTimerHooks();
  resetFocusTimer();

  mockStorage = createMockLocalStorage();
  globalThis.localStorage = mockStorage;
});

afterEach(() => {
  mockStorage = null;
});

after(() => {
  // Restore original environment
  if (originalLocalStorage !== undefined) {
    globalThis.localStorage = originalLocalStorage;
  } else {
    delete globalThis.localStorage;
  }
});

// ============================================================================
// SCENARIO 1: First visit with no saved data
// ============================================================================
test("Scenario 1: First visit initializes storage with sample tasks and preserves them", async () => {
  assert.equal(globalThis.localStorage.getItem(STORAGE_KEY), null);

  const result = await loadTasks();

  assert.equal(result, true, "loadTasks should succeed on first visit");
  assert.equal(state.error, null);
  assert.equal(state.tasks.length, 5);
  assert.equal(state.tasks[0].id, "DEV-142");

  // Verify storage was initialized
  const stored = globalThis.localStorage.getItem(STORAGE_KEY);
  assert.notEqual(stored, null, "Storage must be initialized on first visit");
  const parsed = JSON.parse(stored);
  assert.equal(parsed.length, 5);
  assert.equal(parsed[0].id, "DEV-142");
});

// ============================================================================
// SCENARIO 2: Reload with existing tasks
// ============================================================================
test("Scenario 2: Reload with valid existing tasks restores saved state", async () => {
  const savedTasks = [
    {
      id: "DEV-200",
      title: "Existing custom task",
      status: "todo",
      priority: "high",
      labels: ["core"],
      dueDate: "Tomorrow",
      assignee: "AD",
      completed: false
    }
  ];
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedTasks));

  // In-memory currently has 5 sample tasks
  assert.equal(state.tasks.length, 5);

  const result = await loadTasks();

  assert.equal(result, true);
  assert.equal(state.error, null);
  assert.equal(state.tasks.length, 1);
  assert.equal(state.tasks[0].id, "DEV-200");
  assert.equal(state.tasks[0].title, "Existing custom task");
});

// ============================================================================
// SCENARIO 3: Create a task and reload
// ============================================================================
test("Scenario 3: Create task validates, persists, and restores after reload", async () => {
  const newTask = createTask({
    title: "  New Feature Task  ",
    priority: "high",
    status: "todo",
    labels: ["  feature  ", " frontend "]
  });

  assert.notEqual(newTask, null);
  assert.equal(newTask.title, "New Feature Task");
  assert.deepEqual(newTask.labels, ["feature", "frontend"]);
  assert.equal(newTask.completed, false);
  assert.equal(state.tasks.length, 6);

  const saved = saveTasks();
  assert.equal(saved, true);

  // Simulate reload by clearing in-memory state
  state.tasks = [];
  const reloaded = await loadTasks();

  assert.equal(reloaded, true);
  assert.equal(state.tasks.length, 6);
  const found = state.tasks.find(t => t.id === newTask.id);
  assert.notEqual(found, undefined);
  assert.equal(found.title, "New Feature Task");
  assert.deepEqual(found.labels, ["feature", "frontend"]);
});

// ============================================================================
// SCENARIO 4: Edit a task and reload
// ============================================================================
test("Scenario 4: Edit task validates, sanitizes labels, persists, and restores", async () => {
  const updated = updateTask("DEV-142", {
    title: "  Updated JWT Flow Title  ",
    priority: "low",
    labels: [" auth ", "", " backend ", "   "]
  });

  assert.notEqual(updated, null);
  assert.equal(updated.title, "Updated JWT Flow Title");
  assert.equal(updated.priority, "low");
  assert.deepEqual(updated.labels, ["auth", "backend"]);
  // Existing fields must remain untouched
  assert.equal(updated.status, "backlog");
  assert.equal(updated.assignee, "AD");
  assert.equal(updated.dueDate, "Today");

  saveTasks();

  // Simulate reload
  state.tasks = [];
  await loadTasks();

  const found = state.tasks.find(t => t.id === "DEV-142");
  assert.notEqual(found, undefined);
  assert.equal(found.title, "Updated JWT Flow Title");
  assert.equal(found.priority, "low");
  assert.deepEqual(found.labels, ["auth", "backend"]);
  assert.equal(found.status, "backlog");
});

// ============================================================================
// SCENARIO 5: Delete a task and reload
// ============================================================================
test("Scenario 5: Delete task removes it from state, persists, and restores deletion", async () => {
  state.selectedTaskId = "DEV-142";

  const deleted = deleteTask("DEV-142");
  assert.equal(deleted, true);
  assert.equal(state.tasks.some(t => t.id === "DEV-142"), false);
  assert.equal(state.tasks.length, 4);

  saveTasks();

  // Simulate reload
  await loadTasks();

  assert.equal(state.tasks.length, 4);
  assert.equal(state.tasks.some(t => t.id === "DEV-142"), false);
  // selectedTaskId should be reset if pointing to deleted task
  assert.equal(state.selectedTaskId, null);
});

// ============================================================================
// SCENARIO 6: Move task between Kanban columns (Done toggle) and reload
// ============================================================================
test("Scenario 6: Move task to and from Done updates status and completed flag consistently", async () => {
  const task = state.tasks.find(t => t.id === "DEV-138");
  assert.equal(task.status, "todo");
  assert.equal(task.completed, false);

  // Move to Done
  const movedToDone = updateTask("DEV-138", { status: "done" });
  assert.notEqual(movedToDone, null);
  assert.equal(movedToDone.status, "done");
  assert.equal(movedToDone.completed, true, "Moving to Done must set completed to true");

  saveTasks();

  // Reload and check persistence
  state.tasks = [];
  await loadTasks();
  let reloadedTask = state.tasks.find(t => t.id === "DEV-138");
  assert.equal(reloadedTask.status, "done");
  assert.equal(reloadedTask.completed, true);

  // Move back to in-progress
  const movedBack = updateTask("DEV-138", { status: "in-progress" });
  assert.notEqual(movedBack, null);
  assert.equal(movedBack.status, "in-progress");
  assert.equal(movedBack.completed, false, "Moving out of Done must set completed to false");

  saveTasks();

  // Reload again and check persistence
  state.tasks = [];
  await loadTasks();
  reloadedTask = state.tasks.find(t => t.id === "DEV-138");
  assert.equal(reloadedTask.status, "in-progress");
  assert.equal(reloadedTask.completed, false);
});

// ============================================================================
// SCENARIO 7: Load a valid empty array []
// ============================================================================
test("Scenario 7: Load valid empty array treats it as legitimate empty board", async () => {
  globalThis.localStorage.setItem(STORAGE_KEY, "[]");

  assert.equal(state.tasks.length, 5);

  const result = await loadTasks();

  assert.equal(result, true);
  assert.equal(state.error, null);
  assert.deepEqual(state.tasks, [], "state.tasks must become empty array without re-seeding sample tasks");
  assert.equal(globalThis.localStorage.getItem(STORAGE_KEY), "[]", "Storage must remain []");
});

// ============================================================================
// SCENARIO 8: Load malformed JSON
// ============================================================================
test("Scenario 8: Load malformed JSON catches error, preserves in-memory tasks, does not overwrite storage", async () => {
  const corruptData = "{ this is invalid json :::";
  globalThis.localStorage.setItem(STORAGE_KEY, corruptData);

  const originalInMemory = JSON.parse(JSON.stringify(state.tasks));

  const originalConsoleError = console.error;
  let consoleErrorCalled = false;
  console.error = () => { consoleErrorCalled = true; };

  try {
    const result = await loadTasks();

    assert.equal(result, false, "loadTasks should return false on malformed JSON");
    assert.notEqual(state.error, null, "state.error should record the failure");
    assert.equal(consoleErrorCalled, true, "console.error must log load failure");
    assert.deepEqual(state.tasks, originalInMemory, "In-memory tasks must NOT be replaced");
    assert.equal(
      globalThis.localStorage.getItem(STORAGE_KEY),
      corruptData,
      "Corrupted storage must NOT be overwritten (zero-overwrite policy)"
    );
  } finally {
    console.error = originalConsoleError;
  }
});

// ============================================================================
// SCENARIO 9: Load an array containing an invalid task
// ============================================================================
test("Scenario 9: Load array with invalid task rejects data, preserves in-memory tasks, does not overwrite storage", async () => {
  const invalidTasksArray = [
    {
      id: "DEV-142",
      title: "", // Invalid empty title
      status: "backlog",
      priority: "high",
      labels: ["backend"],
      dueDate: "Today",
      assignee: "AD",
      completed: false
    }
  ];
  const invalidJson = JSON.stringify(invalidTasksArray);
  globalThis.localStorage.setItem(STORAGE_KEY, invalidJson);

  const originalInMemory = JSON.parse(JSON.stringify(state.tasks));

  const originalConsoleError = console.error;
  let consoleErrorCalled = false;
  console.error = () => { consoleErrorCalled = true; };

  try {
    const result = await loadTasks();

    assert.equal(result, false);
    assert.match(state.error, /Saved tasks contain invalid task data/);
    assert.equal(consoleErrorCalled, true, "console.error must log validation failure");
    assert.deepEqual(state.tasks, originalInMemory, "In-memory tasks must remain intact");
    assert.equal(
      globalThis.localStorage.getItem(STORAGE_KEY),
      invalidJson,
      "Storage must NOT be overwritten when invalid tasks are encountered"
    );
  } finally {
    console.error = originalConsoleError;
  }
});

// ============================================================================
// SCENARIO 10: Handle unavailable or failing localStorage where practical
// ============================================================================
test("Scenario 10a: Failing localStorage write reports failure honestly and retains in-memory changes", () => {
  globalThis.localStorage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("QuotaExceededError: disk is full");
    }
  };

  createTask({
    title: "Unsaved Task",
    priority: "medium",
    status: "todo",
    labels: []
  });

  const originalConsoleError = console.error;
  let consoleErrorCalled = false;
  console.error = () => { consoleErrorCalled = true; };

  try {
    const saved = saveTasks();

    assert.equal(saved, false, "saveTasks must return false on failure");
    assert.match(state.error, /QuotaExceededError/, "state.error must reflect write failure");
    assert.equal(consoleErrorCalled, true, "console.error must log save failure");
    // In-memory task must be retained
    assert.equal(state.tasks.some(t => t.title === "Unsaved Task"), true);
  } finally {
    console.error = originalConsoleError;
  }
});

test("Scenario 10b: Failing localStorage read handles error gracefully without crashing", async () => {
  globalThis.localStorage = {
    getItem() {
      throw new Error("SecurityError: storage access denied");
    },
    setItem() {
      return;
    }
  };

  const initialCount = state.tasks.length;
  const originalConsoleError = console.error;
  let consoleErrorCalled = false;
  console.error = () => { consoleErrorCalled = true; };

  try {
    const result = await loadTasks();

    assert.equal(result, false);
    assert.match(state.error, /SecurityError/);
    assert.equal(consoleErrorCalled, true);
    assert.equal(state.tasks.length, initialCount);
  } finally {
    console.error = originalConsoleError;
  }
});

test("Scenario 10c: Undefined localStorage handles error gracefully without throwing", async () => {
  delete globalThis.localStorage;

  const initialCount = state.tasks.length;
  const originalConsoleError = console.error;
  let consoleErrorCount = 0;
  console.error = () => { consoleErrorCount++; };

  try {
    const loadResult = await loadTasks();
    assert.equal(loadResult, false);
    assert.match(state.error, /localStorage is not available/);
    assert.equal(state.tasks.length, initialCount);

    const saveResult = saveTasks();
    assert.equal(saveResult, false);
    assert.match(state.error, /localStorage is not available/);
    assert.equal(consoleErrorCount, 2);
  } finally {
    console.error = originalConsoleError;
  }
});

// ============================================================================
// TASK VALIDATION & EDGE CASES
// ============================================================================
test("Task CRUD validation rejects invalid input and prevents corrupt state", () => {
  // Empty or whitespace title
  assert.equal(createTask({ title: "   ", priority: "high", status: "todo", labels: [] }), null);
  assert.equal(createTask({ title: 123, priority: "high", status: "todo", labels: [] }), null);

  // Invalid priority
  assert.equal(createTask({ title: "Valid", priority: "critical", status: "todo", labels: [] }), null);

  // Invalid status
  assert.equal(createTask({ title: "Valid", priority: "low", status: "archived", labels: [] }), null);

  // Invalid labels
  assert.equal(createTask({ title: "Valid", priority: "low", status: "todo", labels: "string" }), null);
  assert.equal(createTask({ title: "Valid", priority: "low", status: "todo", labels: [123] }), null);

  // Unknown fields in updateTask
  assert.equal(updateTask("DEV-142", { unknownProperty: "hack" }), null);

  // Attempting to modify ID directly
  assert.equal(updateTask("DEV-142", { id: "NEW-ID" }), null);

  // Non-existent task
  assert.equal(updateTask("NON-EXISTENT", { title: "Hello" }), null);
  assert.equal(deleteTask("NON-EXISTENT"), false);
});

test("isValidTask strictly verifies all required task schema fields", () => {
  const valid = {
    id: "DEV-100",
    title: "Good Task",
    status: "todo",
    priority: "medium",
    labels: ["a", "b"],
    dueDate: "Tomorrow",
    assignee: "AD",
    completed: false
  };

  assert.equal(isValidTask(valid), true);

  // Array is not a valid task
  assert.equal(isValidTask([]), false);
  assert.equal(isValidTask(null), false);
  assert.equal(isValidTask("string"), false);

  // Missing / empty id
  assert.equal(isValidTask({ ...valid, id: "" }), false);
  assert.equal(isValidTask({ ...valid, id: "   " }), false);
  assert.equal(isValidTask({ ...valid, id: 123 }), false);

  // Empty title
  assert.equal(isValidTask({ ...valid, title: "" }), false);
  assert.equal(isValidTask({ ...valid, title: "   " }), false);

  // Invalid status
  assert.equal(isValidTask({ ...valid, status: "archive" }), false);

  // Invalid priority
  assert.equal(isValidTask({ ...valid, priority: "super-high" }), false);

  // Invalid labels
  assert.equal(isValidTask({ ...valid, labels: "not-array" }), false);
  assert.equal(isValidTask({ ...valid, labels: [1, 2] }), false);

  // Invalid completed
  assert.equal(isValidTask({ ...valid, completed: "false" }), false);
  assert.equal(isValidTask({ ...valid, completed: 0 }), false);
});

test("initializeEvents registers listeners only once per application lifecycle (eventsInitialized guard)", async () => {
  let listenersCount = 0;
  const createMockEl = () => ({
    addEventListener: () => { listenersCount++; },
    querySelector: () => createMockEl(),
    querySelectorAll: () => [],
    classList: { add: () => {}, remove: () => {} },
    reset: () => {}
  });

  const prevDoc = globalThis.document;
  globalThis.document = {
    querySelector: () => createMockEl(),
    querySelectorAll: () => [],
    addEventListener: () => { listenersCount++; }
  };

  try {
    const { initializeEvents } = await import("./js/events.js");
    initializeEvents();
    const countAfterFirstInit = listenersCount;
    assert.ok(countAfterFirstInit > 0, "Listeners should be registered on first call");

    // Call initializeEvents again
    initializeEvents();
    assert.equal(
      listenersCount,
      countAfterFirstInit,
      "Second call to initializeEvents must not register duplicate listeners"
    );
  } finally {
    if (prevDoc !== undefined) {
      globalThis.document = prevDoc;
    } else {
      delete globalThis.document;
    }
  }
});

// ============================================================================
// PHASE 1 TESTS: AUXILIARY VIEWS, MOBILE SIDEBAR, OVERVIEW ACTION
// ============================================================================

test("Phase 1: renderView displays placeholder view with title for auxiliary views", async () => {
  const elements = {
    pageHeader: { classList: new Set() },
    metrics: { classList: new Set() },
    dashboardLayout: { classList: new Set() },
    projectView: { classList: new Set() },
    focusMode: { classList: new Set() },
    placeholderView: { classList: new Set(["hidden"]) },
    placeholderTitle: { textContent: "" },
    placeholderDescription: { textContent: "" }
  };

  const createClassList = (set) => ({
    add(cls) { set.add(cls); },
    remove(cls) { set.delete(cls); },
    contains(cls) { return set.has(cls); }
  });

  const prevDoc = globalThis.document;
  globalThis.document = {
    querySelector: (sel) => {
      if (sel === ".page-header") return { classList: createClassList(elements.pageHeader.classList) };
      if (sel === ".metric-grid") return { classList: createClassList(elements.metrics.classList) };
      if (sel === ".dashboard-layout") return { classList: createClassList(elements.dashboardLayout.classList) };
      if (sel === "#project-view") return { classList: createClassList(elements.projectView.classList) };
      if (sel === "#focus-mode") return { classList: createClassList(elements.focusMode.classList) };
      if (sel === "#placeholder-view") return { classList: createClassList(elements.placeholderView.classList) };
      if (sel === "#placeholder-title") return elements.placeholderTitle;
      if (sel === "#placeholder-description") return elements.placeholderDescription;
      return null;
    },
    querySelectorAll: () => []
  };

  try {
    const { renderView } = await import("./js/render.js");

    // Test Inbox
    state.activeView = "inbox";
    renderView();
    assert.equal(elements.placeholderView.classList.has("hidden"), false, "Placeholder view must be visible for inbox");
    assert.equal(elements.placeholderTitle.textContent, "Inbox");
    assert.equal(elements.projectView.classList.has("hidden"), true);
    assert.equal(elements.dashboardLayout.classList.has("hidden"), true);

    // Test Calendar
    state.activeView = "calendar";
    renderView();
    assert.equal(elements.placeholderView.classList.has("hidden"), false);
    assert.equal(elements.placeholderTitle.textContent, "Calendar");

    // Test Analytics
    state.activeView = "analytics";
    renderView();
    assert.equal(elements.placeholderView.classList.has("hidden"), false);
    assert.equal(elements.placeholderTitle.textContent, "Analytics");

    // Switching back to overview hides placeholder
    state.activeView = "overview";
    renderView();
    assert.equal(elements.placeholderView.classList.has("hidden"), true, "Placeholder must be hidden for overview");
    assert.equal(elements.dashboardLayout.classList.has("hidden"), false);
  } finally {
    if (prevDoc !== undefined) {
      globalThis.document = prevDoc;
    } else {
      delete globalThis.document;
    }
  }
});

test("Phase 1: Mobile sidebar drawer toggle updates body class and aria-expanded", async () => {
  const bodyClasses = new Set();
  const mockButton = {
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k]; }
  };

  const prevDoc = globalThis.document;
  globalThis.document = {
    body: {
      classList: {
        add(cls) { bodyClasses.add(cls); },
        remove(cls) { bodyClasses.delete(cls); },
        contains(cls) { return bodyClasses.has(cls); },
        toggle(cls) {
          if (bodyClasses.has(cls)) {
            bodyClasses.delete(cls);
            return false;
          } else {
            bodyClasses.add(cls);
            return true;
          }
        }
      }
    },
    querySelector: (sel) => {
      if (sel === "#mobile-menu-button") return mockButton;
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: () => {}
  };

  try {
    const { toggleMobileSidebar, closeMobileSidebar } = await import("./js/events.js");

    // Toggle open
    toggleMobileSidebar();
    assert.equal(bodyClasses.has("sidebar-open"), true);
    assert.equal(mockButton.getAttribute("aria-expanded"), "true");

    // Toggle close
    toggleMobileSidebar();
    assert.equal(bodyClasses.has("sidebar-open"), false);
    assert.equal(mockButton.getAttribute("aria-expanded"), "false");

    // Open then explicit close
    toggleMobileSidebar();
    assert.equal(bodyClasses.has("sidebar-open"), true);
    closeMobileSidebar();
    assert.equal(bodyClasses.has("sidebar-open"), false);
    assert.equal(mockButton.getAttribute("aria-expanded"), "false");
  } finally {
    if (prevDoc !== undefined) {
      globalThis.document = prevDoc;
    } else {
      delete globalThis.document;
    }
  }
});

function createFakeFocusClock(startTime = 1_000_000) {
  let now = startTime;
  const intervals = [];

  return {
    get now() {
      return now;
    },
    get intervals() {
      return intervals;
    },
    advance(ms) {
      now += ms;
    },
    tick() {
      intervals.slice().forEach(entry => entry.callback());
    },
    hooks: {
      now: () => now,
      setInterval(callback) {
        const entry = { callback };
        intervals.push(entry);
        return entry;
      },
      clearInterval(id) {
        const index = intervals.indexOf(id);
        if (index !== -1) {
          intervals.splice(index, 1);
        }
      }
    }
  };
}

test("Focus timer starts at 25:00 and is idle", () => {
  const timer = getFocusTimerState();

  assert.equal(timer.remainingMs, FOCUS_DURATION_MS);
  assert.equal(timer.running, false);
  assert.equal(timer.phase, "idle");
  assert.equal(timer.display, "25:00");
});

test("Focus timer start uses elapsed time from an injectable clock", () => {
  const clock = createFakeFocusClock();
  configureFocusTimer(clock.hooks);

  startFocusTimer();
  clock.advance(5_000);
  clock.tick();

  const timer = getFocusTimerState();
  assert.equal(timer.running, true);
  assert.equal(timer.phase, "running");
  assert.equal(timer.remainingMs, FOCUS_DURATION_MS - 5_000);
  assert.equal(timer.display, "24:55");
});

test("Focus timer start while running does not create a duplicate interval", () => {
  const clock = createFakeFocusClock();
  configureFocusTimer(clock.hooks);

  startFocusTimer();
  startFocusTimer();
  startFocusTimer();

  assert.equal(clock.intervals.length, 1);

  clock.advance(1_000);
  clock.tick();
  assert.equal(getFocusTimerState().remainingMs, FOCUS_DURATION_MS - 1_000);
});

test("Focus timer pause freezes remaining time and resume continues from there", () => {
  const clock = createFakeFocusClock();
  configureFocusTimer(clock.hooks);

  startFocusTimer();
  clock.advance(10_000);
  clock.tick();
  pauseFocusTimer();

  assert.equal(getFocusTimerState().running, false);
  assert.equal(getFocusTimerState().phase, "paused");
  assert.equal(getFocusTimerState().remainingMs, FOCUS_DURATION_MS - 10_000);
  assert.equal(clock.intervals.length, 0);

  clock.advance(8_000);
  assert.equal(getFocusTimerState().remainingMs, FOCUS_DURATION_MS - 10_000);

  startFocusTimer();
  clock.advance(3_000);
  clock.tick();

  assert.equal(getFocusTimerState().running, true);
  assert.equal(getFocusTimerState().remainingMs, FOCUS_DURATION_MS - 13_000);
});

test("Focus timer stops at zero and never goes negative", () => {
  const clock = createFakeFocusClock();
  configureFocusTimer(clock.hooks);

  startFocusTimer();
  clock.advance(FOCUS_DURATION_MS + 4_000);
  clock.tick();

  const timer = getFocusTimerState();
  assert.equal(timer.remainingMs, 0);
  assert.equal(timer.running, false);
  assert.equal(timer.phase, "finished");
  assert.equal(timer.display, "00:00");
  assert.equal(clock.intervals.length, 0);

  clock.advance(2_000);
  assert.equal(getFocusTimerState().remainingMs, 0);
});

test("Closing Focus Mode cleans up the interval and preserves remaining time", () => {
  const clock = createFakeFocusClock();
  configureFocusTimer(clock.hooks);

  startFocusTimer();
  clock.advance(12_000);
  clock.tick();

  cleanupFocusTimer();

  assert.equal(clock.intervals.length, 0);
  assert.equal(getFocusTimerState().running, false);
  assert.equal(getFocusTimerState().remainingMs, FOCUS_DURATION_MS - 12_000);

  clock.advance(20_000);
  assert.equal(getFocusTimerState().remainingMs, FOCUS_DURATION_MS - 12_000);

  startFocusTimer();
  clock.advance(1_000);
  clock.tick();
  assert.equal(getFocusTimerState().remainingMs, FOCUS_DURATION_MS - 13_000);
});

test("Completing the associated focus task uses updateTask, marks done, and persists", () => {
  const task = resolveFocusTask();
  assert.equal(task.id, "API-028");
  assert.equal(state.focusTaskId, "API-028");

  const result = completeFocusTask();

  assert.equal(result.ok, true);
  assert.equal(result.saved, true);
  assert.equal(result.task.status, "done");
  assert.equal(result.task.completed, true);
  assert.equal(state.focusTaskId, null);

  const stored = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY));
  const savedTask = stored.find(item => item.id === "API-028");
  assert.equal(savedTask.status, "done");
  assert.equal(savedTask.completed, true);

  const duplicate = completeFocusTask();
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "missing");
});

test("Focus task association handles a missing or deleted task without throwing", () => {
  state.focusTaskId = "MISSING-TASK";
  assert.equal(syncFocusTask(), null);
  assert.equal(state.focusTaskId, null);

  const missing = completeFocusTask();
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "missing");

  const created = resolveFocusTask();
  assert.equal(created.id, "API-028");
  deleteTask("API-028");
  assert.equal(syncFocusTask(), null);
  assert.equal(state.focusTaskId, null);

  const afterDelete = completeFocusTask();
  assert.equal(afterDelete.ok, false);
  assert.equal(afterDelete.reason, "missing");
});

test("resolveFocusTask prefers the selected incomplete task, then in-progress", () => {
  state.selectedTaskId = "DEV-138";
  assert.equal(resolveFocusTask().id, "DEV-138");

  state.selectedTaskId = "DEV-129";
  state.focusTaskId = null;
  assert.equal(resolveFocusTask().id, "API-028");

  state.tasks = state.tasks.map(task => ({
    ...task,
    status: "done",
    completed: true
  }));
  state.selectedTaskId = null;
  state.focusTaskId = null;
  assert.equal(resolveFocusTask(), null);
  assert.equal(state.focusTaskId, null);
});

// ============================================================================
// PHASE 2 TESTS: OVERVIEW DASHBOARD LIVE BINDING
// ============================================================================

function createMockDomEnvironment() {
  const elements = new Map();

  function makeElement(tag, id = null, classes = []) {
    const classSet = new Set(classes);
    const attrs = new Map();
    const children = [];

    const el = {
      tagName: tag.toUpperCase(),
      id,
      dataset: {},
      children,
      get childNodes() {
        return children;
      },
      get classList() {
        return {
          add(...cls) { cls.forEach(c => classSet.add(c)); },
          remove(...cls) { cls.forEach(c => classSet.delete(c)); },
          contains(c) { return classSet.has(c); },
          toggle(c, force) {
            const has = force !== undefined ? force : !classSet.has(c);
            if (has) classSet.add(c);
            else classSet.delete(c);
            return has;
          }
        };
      },
      textContent: "",
      get innerHTML() {
        return children.map(c => c.textContent).join("");
      },
      set innerHTML(val) {
        if (val === "") {
          children.length = 0;
        }
      },
      appendChild(child) {
        children.push(child);
        return child;
      },
      setAttribute(name, val) {
        attrs.set(name, String(val));
      },
      getAttribute(name) {
        return attrs.has(name) ? attrs.get(name) : null;
      },
      closest(sel) {
        if (sel === ".task-row" && classSet.has("task-row")) return el;
        if (sel === ".task-checkbox" && classSet.has("task-checkbox")) return el;
        return null;
      },
      querySelector(sel) {
        return findInTree(this, sel);
      },
      querySelectorAll(sel) {
        const results = [];
        collectInTree(this, sel, results);
        return results;
      }
    };

    if (id) {
      elements.set(`#${id}`, el);
    }

    return el;
  }

  function matches(node, selector) {
    if (selector.startsWith("#") && node.id === selector.slice(1)) return true;
    if (selector.startsWith(".") && node.classList.contains(selector.slice(1))) return true;
    if (selector.toLowerCase() === node.tagName.toLowerCase()) return true;
    return false;
  }

  function findInTree(root, selector) {
    for (const child of root.children) {
      if (matches(child, selector)) return child;
      const found = findInTree(child, selector);
      if (found) return found;
    }
    return null;
  }

  function collectInTree(root, selector, acc) {
    for (const child of root.children) {
      if (matches(child, selector)) acc.push(child);
      collectInTree(child, selector, acc);
    }
  }

  const completedMetric = makeElement("strong", "overview-tasks-completed-metric");
  const remainingDetail = makeElement("span", "overview-tasks-remaining-detail");
  const subtitle = makeElement("p", "overview-page-subtitle");
  const todayFocusList = makeElement("div", "overview-today-focus-list", ["task-list"]);

  const doc = {
    createElement(tag) {
      return makeElement(tag);
    },
    querySelector(selector) {
      if (elements.has(selector)) return elements.get(selector);
      return null;
    },
    querySelectorAll(selector) {
      const results = [];
      for (const el of elements.values()) {
        if (matches(el, selector)) results.push(el);
      }
      return results;
    },
    addEventListener: () => {}
  };

  return {
    document: doc,
    elements: {
      completedMetric,
      remainingDetail,
      subtitle,
      todayFocusList
    }
  };
}

test("isIncompleteTask identifies incomplete tasks and excludes done tasks", () => {
  assert.equal(isIncompleteTask({ id: "1", status: "todo", completed: false }), true);
  assert.equal(isIncompleteTask({ id: "2", status: "in-progress", completed: false }), true);
  assert.equal(isIncompleteTask({ id: "3", status: "backlog", completed: false }), true);
  assert.equal(isIncompleteTask({ id: "4", status: "review", completed: false }), true);
  assert.equal(isIncompleteTask({ id: "5", status: "done", completed: true }), false);
  assert.equal(isIncompleteTask({ id: "6", status: "done", completed: false }), false);
  assert.equal(isIncompleteTask({ id: "7", status: "todo", completed: true }), false);
  assert.equal(isIncompleteTask(null), false);
  assert.equal(isIncompleteTask(undefined), false);
});

test("Phase 2: renderOverviewMetrics reflects completed and remaining task counts accurately", () => {
  const { document: mockDoc, elements } = createMockDomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    // Initial sample tasks: 1 done (DEV-129), 4 incomplete
    renderOverviewMetrics();

    assert.equal(elements.completedMetric.textContent, "1");
    assert.equal(elements.remainingDetail.textContent, "4 remaining today");
    assert.equal(elements.subtitle.textContent, "4 tasks need your attention.");

    // Complete another task
    updateTask("DEV-142", { status: "done" });
    renderOverviewMetrics();

    assert.equal(elements.completedMetric.textContent, "2");
    assert.equal(elements.remainingDetail.textContent, "3 remaining today");
    assert.equal(elements.subtitle.textContent, "3 tasks need your attention.");
  } finally {
    globalThis.document = prevDoc;
  }
});

test("Phase 2: renderOverviewMetrics handles empty board and all-completed tasks", () => {
  const { document: mockDoc, elements } = createMockDomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    // Empty task list
    state.tasks = [];
    renderOverviewMetrics();

    assert.equal(elements.completedMetric.textContent, "0");
    assert.equal(elements.remainingDetail.textContent, "0 remaining today");
    assert.equal(elements.subtitle.textContent, "No tasks on your board.");

    // All tasks completed
    state.tasks = [
      {
        id: "T-1",
        title: "Finished task",
        status: "done",
        priority: "medium",
        labels: [],
        dueDate: "Today",
        assignee: "AD",
        completed: true
      }
    ];
    renderOverviewMetrics();

    assert.equal(elements.completedMetric.textContent, "1");
    assert.equal(elements.remainingDetail.textContent, "0 remaining today");
    assert.equal(elements.subtitle.textContent, "All tasks completed.");

    // Exactly 1 incomplete task
    state.tasks.push({
      id: "T-2",
      title: "One left",
      status: "todo",
      priority: "high",
      labels: [],
      dueDate: "Tomorrow",
      assignee: "AD",
      completed: false
    });
    renderOverviewMetrics();

    assert.equal(elements.completedMetric.textContent, "1");
    assert.equal(elements.remainingDetail.textContent, "1 remaining today");
    assert.equal(elements.subtitle.textContent, "1 task needs your attention.");
  } finally {
    globalThis.document = prevDoc;
  }
});

test("Phase 2: createTodayFocusRow generates expected DOM elements, attributes, and priority badges", () => {
  const { document: mockDoc } = createMockDomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    const task = {
      id: "DEV-999",
      title: "Write documentation",
      priority: "high",
      status: "todo",
      labels: ["docs", "api"],
      dueDate: "Today",
      assignee: "AD",
      completed: false
    };

    const row = createTodayFocusRow(task);

    assert.equal(row.classList.contains("task-row"), true);
    assert.equal(row.classList.contains("priority-high"), true);
    assert.equal(row.dataset.taskId, "DEV-999");

    const checkbox = row.querySelector(".task-checkbox");
    assert.ok(checkbox, "Checkbox element must be present");
    assert.equal(checkbox.dataset.taskId, "DEV-999");
    assert.equal(checkbox.getAttribute("aria-label"), "Mark Write documentation complete");

    const title = row.querySelector("h3");
    assert.equal(title.textContent, "Write documentation");

    const badge = row.querySelector(".priority-badge");
    assert.ok(badge);
    assert.equal(badge.classList.contains("priority-critical"), true);
    assert.equal(badge.textContent, "High");

    // Medium priority badge
    const mediumRow = createTodayFocusRow({ ...task, priority: "medium" });
    const medBadge = mediumRow.querySelector(".priority-badge");
    assert.equal(medBadge.classList.contains("priority-medium"), true);
    assert.equal(medBadge.textContent, "Medium");

    // Low priority badge
    const lowRow = createTodayFocusRow({ ...task, priority: "low" });
    const lowBadge = lowRow.querySelector(".priority-badge");
    assert.equal(lowBadge.classList.contains("priority-low"), true);
    assert.equal(lowBadge.textContent, "Low");
  } finally {
    globalThis.document = prevDoc;
  }
});

test("Phase 2: renderTodayFocus renders eligible incomplete tasks and updates when state changes", () => {
  const { document: mockDoc, elements } = createMockDomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    // Initial sample tasks: 4 incomplete (DEV-142, DEV-138, API-028, DEV-151), 1 done (DEV-129)
    renderTodayFocus();

    assert.equal(elements.todayFocusList.children.length, 4);
    const renderedIds = elements.todayFocusList.children.map(row => row.dataset.taskId);
    assert.deepEqual(renderedIds, ["DEV-142", "DEV-138", "API-028", "DEV-151"]);
    assert.equal(renderedIds.includes("DEV-129"), false, "Done task DEV-129 must not be in Today's Focus");

    // Mark DEV-142 done and re-render
    updateTask("DEV-142", { status: "done" });
    renderTodayFocus();

    assert.equal(elements.todayFocusList.children.length, 3);
    const afterIds = elements.todayFocusList.children.map(row => row.dataset.taskId);
    assert.deepEqual(afterIds, ["DEV-138", "API-028", "DEV-151"]);
  } finally {
    globalThis.document = prevDoc;
  }
});

test("Phase 2: renderTodayFocus renders styled empty state when all tasks are complete or board is empty", () => {
  const { document: mockDoc, elements } = createMockDomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    // When all tasks are done
    state.tasks = state.tasks.map(t => ({ ...t, status: "done", completed: true }));
    renderTodayFocus();

    assert.equal(elements.todayFocusList.children.length, 1);
    const emptyEl = elements.todayFocusList.children[0];
    assert.equal(emptyEl.classList.contains("task-empty-state"), true);
    assert.equal(emptyEl.id, "overview-focus-empty");
    assert.equal(emptyEl.querySelector("p").textContent, "All caught up! No incomplete tasks.");

    // When board has zero tasks
    state.tasks = [];
    renderTodayFocus();

    assert.equal(elements.todayFocusList.children.length, 1);
    const zeroEl = elements.todayFocusList.children[0];
    assert.equal(zeroEl.classList.contains("task-empty-state"), true);
    assert.equal(zeroEl.querySelector("p").textContent, "No tasks yet. Create a task to get started.");
  } finally {
    globalThis.document = prevDoc;
  }
});

test("Phase 2: completeTaskById marks task done, completed true, and persists to localStorage", () => {
  const { document: mockDoc, elements } = createMockDomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    // Initial state
    renderOverview();
    assert.equal(elements.completedMetric.textContent, "1");
    assert.equal(elements.todayFocusList.children.length, 4);

    // Complete DEV-138 via completeTaskById
    const result = completeTaskById("DEV-138");

    assert.equal(result.ok, true);
    assert.equal(result.saved, true);
    assert.equal(result.task.status, "done");
    assert.equal(result.task.completed, true);

    // Verify in-memory state
    const inMem = state.tasks.find(t => t.id === "DEV-138");
    assert.equal(inMem.status, "done");
    assert.equal(inMem.completed, true);

    // Verify localStorage persistence
    const stored = JSON.parse(mockStorage.getItem(STORAGE_KEY));
    const saved = stored.find(t => t.id === "DEV-138");
    assert.equal(saved.status, "done");
    assert.equal(saved.completed, true);

    // Verify Overview metrics updated immediately
    assert.equal(elements.completedMetric.textContent, "2");
    assert.equal(elements.remainingDetail.textContent, "3 remaining today");

    // Verify Today's Focus list updated immediately (DEV-138 removed)
    assert.equal(elements.todayFocusList.children.length, 3);
    const remainingIds = elements.todayFocusList.children.map(row => row.dataset.taskId);
    assert.equal(remainingIds.includes("DEV-138"), false);
  } finally {
    globalThis.document = prevDoc;
  }
});

test("Phase 2: completeTaskById clears focusTaskId if completing the active focus task", () => {
  const { document: mockDoc } = createMockDomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    state.focusTaskId = "API-028";
    const result = completeTaskById("API-028");

    assert.equal(result.ok, true);
    assert.equal(state.focusTaskId, null, "focusTaskId must be reset to null");
  } finally {
    globalThis.document = prevDoc;
  }
});

test("Phase 2: completeTaskById safely handles non-existent or invalid task ID", () => {
  const { document: mockDoc } = createMockDomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    const missing = completeTaskById("NON-EXISTENT");
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, "missing");
    assert.equal(missing.task, null);

    const emptyId = completeTaskById("");
    assert.equal(emptyId.ok, false);
    assert.equal(emptyId.reason, "invalid-id");

    const nullId = completeTaskById(null);
    assert.equal(nullId.ok, false);
    assert.equal(nullId.reason, "invalid-id");
  } finally {
    globalThis.document = prevDoc;
  }
});

test("Phase 2: completeTaskById handles storage write failure gracefully", () => {
  const { document: mockDoc, elements } = createMockDomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  mockStorage.setItem = () => {
    throw new Error("Quota exceeded");
  };

  try {
    renderOverview();
    const result = completeTaskById("DEV-138");

    assert.equal(result.ok, true);
    assert.equal(result.saved, false);
    assert.equal(result.reason, "save-failed");
    assert.equal(result.task.status, "done");
    assert.equal(result.task.completed, true);

    // In-memory changes and DOM are still updated
    assert.equal(elements.completedMetric.textContent, "2");
    assert.equal(state.error, "Quota exceeded");
  } finally {
    globalThis.document = prevDoc;
  }
});

test("Phase 2: Task CRUD and drop actions update Overview dashboard synchronously", () => {
  const { document: mockDoc, elements } = createMockDomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    renderOverview();
    assert.equal(elements.completedMetric.textContent, "1");
    assert.equal(elements.todayFocusList.children.length, 4);

    // 1. Create a new incomplete task
    const newTask = createTask({
      title: "New feature",
      priority: "high",
      status: "todo",
      labels: ["frontend"]
    });
    saveTasks();
    renderOverview();

    assert.equal(elements.completedMetric.textContent, "1");
    assert.equal(elements.remainingDetail.textContent, "5 remaining today");
    assert.equal(elements.todayFocusList.children.length, 5);

    // 2. Delete a task
    deleteTask(newTask.id);
    saveTasks();
    renderOverview();

    assert.equal(elements.completedMetric.textContent, "1");
    assert.equal(elements.remainingDetail.textContent, "4 remaining today");
    assert.equal(elements.todayFocusList.children.length, 4);

    // 3. Status change to done
    updateTask("DEV-142", { status: "done" });
    saveTasks();
    renderOverview();

    assert.equal(elements.completedMetric.textContent, "2");
    assert.equal(elements.remainingDetail.textContent, "3 remaining today");
    assert.equal(elements.todayFocusList.children.length, 3);
  } finally {
    globalThis.document = prevDoc;
  }
});

// ============================================================================
// PHASE 3: Remaining Vanilla JavaScript Interaction Audit & Usability Tests
// ============================================================================

function createPhase3DomEnvironment() {
  const elements = new Map();

  function makeEl(tagName, id = "", classes = [], attrs = {}) {
    const classSet = new Set(classes);
    const attrMap = new Map(Object.entries(attrs));
    const children = [];
    const eventListeners = new Map();

    const el = {
      tagName: tagName.toUpperCase(),
      id,
      dataset: {},
      children,
      get childNodes() { return children; },
      get classList() {
        return {
          add(...cls) { cls.forEach(c => classSet.add(c)); },
          remove(...cls) { cls.forEach(c => classSet.delete(c)); },
          contains(c) { return classSet.has(c); },
          toggle(c, force) {
            const has = force !== undefined ? force : !classSet.has(c);
            if (has) classSet.add(c);
            else classSet.delete(c);
            return has;
          }
        };
      },
      textContent: "",
      value: "",
      hidden: false,
      type: "text",
      style: {},
      get innerHTML() {
        return children.map(c => c.textContent).join("");
      },
      set innerHTML(val) {
        if (val === "") children.length = 0;
      },
      appendChild(child) {
        children.push(child);
        child.parentElement = el;
        return child;
      },
      setAttribute(k, v) { attrMap.set(k, String(v)); },
      getAttribute(k) { return attrMap.has(k) ? attrMap.get(k) : null; },
      removeAttribute(k) { attrMap.delete(k); },
      addEventListener(type, fn) {
        if (!eventListeners.has(type)) eventListeners.set(type, []);
        eventListeners.get(type).push(fn);
      },
      dispatchEvent(event) {
        const list = eventListeners.get(event.type) || [];
        list.forEach(fn => fn(event));
      },
      focus() {
        if (doc) doc.activeElement = el;
      },
      reset() {
        el.value = "";
      },
      closest(sel) {
        let curr = el;
        while (curr) {
          if (matches(curr, sel)) return curr;
          curr = curr.parentElement;
        }
        return null;
      },
      contains(target) {
        if (target === el) return true;
        for (const child of children) {
          if (child.contains && child.contains(target)) return true;
        }
        return false;
      },
      querySelector(sel) { return findInTree(this, sel); },
      querySelectorAll(sel) {
        const results = [];
        collectInTree(this, sel, results);
        return results;
      }
    };

    if (id) elements.set(`#${id}`, el);
    return el;
  }

  function matchSingle(node, sel) {
    if (!node) return false;
    sel = sel.trim();
    if (!sel) return false;

    // Handle :not(...)
    const notMatch = sel.match(/^(.+?):not\((.+?)\)$/);
    if (notMatch) {
      const [, base, notCond] = notMatch;
      return matchSingle(node, base) && !matchSingle(node, notCond);
    }

    // Extract attributes: [attr] or [attr="val"]
    let remainder = sel;
    const attrRegex = /\[([a-zA-Z0-9_-]+)(?:=(['"]?)(.*?)\2)?\]/g;
    let match;
    while ((match = attrRegex.exec(sel)) !== null) {
      const [full, attrName, , attrVal] = match;
      const key = attrName.startsWith("data-")
        ? attrName.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase())
        : null;

      let hasAttr = false;
      let val = null;
      if (key && node.dataset && key in node.dataset) {
        hasAttr = true;
        val = node.dataset[key];
      } else if (node.getAttribute && node.getAttribute(attrName) !== null) {
        hasAttr = true;
        val = node.getAttribute(attrName);
      }

      if (!hasAttr) return false;
      if (attrVal !== undefined && val !== attrVal) return false;
      remainder = remainder.replace(full, "");
    }

    if (!remainder) return true;

    // Extract ID
    const idMatch = remainder.match(/#([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      if (node.id !== idMatch[1]) return false;
      remainder = remainder.replace(idMatch[0], "");
    }

    // Extract classes
    const classRegex = /\.([a-zA-Z0-9_-]+)/g;
    while ((match = classRegex.exec(remainder)) !== null) {
      if (!node.classList || !node.classList.contains(match[1])) return false;
    }
    remainder = remainder.replace(classRegex, "");

    // Remainder is tag name if present
    if (remainder) {
      if (node.tagName && node.tagName.toLowerCase() !== remainder.toLowerCase()) {
        return false;
      }
    }

    return true;
  }

  function matches(node, selector) {
    if (!node || !selector) return false;
    const parts = selector.split(",");
    return parts.some(part => matchSingle(node, part));
  }

  function findInTree(root, selector) {
    for (const child of root.children) {
      if (matches(child, selector)) return child;
      const found = findInTree(child, selector);
      if (found) return found;
    }
    return null;
  }

  function collectInTree(root, selector, acc) {
    for (const child of root.children) {
      if (matches(child, selector)) acc.push(child);
      collectInTree(child, selector, acc);
    }
  }

  const body = makeEl("body");
  const doc = {
    body,
    activeElement: body,
    createElement(tag) { return makeEl(tag); },
    querySelector(selector) {
      if (elements.has(selector)) return elements.get(selector);
      return findInTree(body, selector);
    },
    querySelectorAll(selector) {
      const results = [];
      collectInTree(body, selector, results);
      return results;
    },
    addEventListener: () => {}
  };

  // 1. Project header elements
  const projectTitleIcon = makeEl("span", "project-title-icon", ["project-icon", "project-icon-blue"]);
  const projectTitleHeading = makeEl("h2", "project-title-heading");
  const projectStatusPill = makeEl("span", "project-status-pill", ["status-pill", "status-progress"]);
  const projectTitleDescription = makeEl("p", "project-title-description");
  const kanbanSortButton = makeEl("button", "kanban-sort-button", ["button"]);
  const kanbanFilterButton = makeEl("button", "kanban-filter-button", ["button"]);
  const projectView = makeEl("div", "project-view");

  body.appendChild(projectTitleIcon);
  body.appendChild(projectTitleHeading);
  body.appendChild(projectStatusPill);
  body.appendChild(projectTitleDescription);
  body.appendChild(kanbanSortButton);
  body.appendChild(kanbanFilterButton);
  body.appendChild(projectView);

  // 2. Project links in sidebar
  const linkDev = makeEl("a", "", ["project-link", "selected"], { "data-project-id": "developer-platform" });
  linkDev.dataset.projectId = "developer-platform";
  const linkStock = makeEl("a", "", ["project-link"], { "data-project-id": "stock-engine" });
  linkStock.dataset.projectId = "stock-engine";
  const linkDsa = makeEl("a", "", ["project-link"], { "data-project-id": "dsa-tracker" });
  linkDsa.dataset.projectId = "dsa-tracker";

  body.appendChild(linkDev);
  body.appendChild(linkStock);
  body.appendChild(linkDsa);

  // 3. Kanban board
  const kanbanBoard = makeEl("div", "kanban-board");
  const colTodo = makeEl("div", "", ["kanban-column"], { "data-status": "todo" });
  colTodo.dataset.status = "todo";
  const cardsTodo = makeEl("div", "", ["kanban-cards"]);
  const countTodo = makeEl("span", "", ["column-count"]);
  colTodo.appendChild(cardsTodo);
  colTodo.appendChild(countTodo);
  kanbanBoard.appendChild(colTodo);

  const colDone = makeEl("div", "", ["kanban-column"], { "data-status": "done" });
  colDone.dataset.status = "done";
  const cardsDone = makeEl("div", "", ["kanban-cards"]);
  const countDone = makeEl("span", "", ["column-count"]);
  colDone.appendChild(cardsDone);
  colDone.appendChild(countDone);
  kanbanBoard.appendChild(colDone);

  body.appendChild(kanbanBoard);

  // 4. Modal elements
  const taskModal = makeEl("div", "task-modal", ["task-modal", "hidden"]);
  const createTaskForm = makeEl("form", "create-task-form");
  const taskTitleInput = makeEl("input", "task-title");
  const taskPrioritySelect = makeEl("select", "task-priority");
  const taskStatusSelect = makeEl("select", "task-status");
  const taskLabelsInput = makeEl("input", "task-labels");
  const taskModalTitle = makeEl("h3", "task-modal-title");
  const taskModalSubmit = makeEl("button", "", ["button", "button-primary"], { type: "submit" });
  const deleteTaskButton = makeEl("button", "delete-task-button", ["button", "button-danger"]);
  deleteTaskButton.hidden = true;
  const modalCloseBtn = makeEl("button", "", ["button-close"], { "data-close-modal": "true" });

  createTaskForm.appendChild(taskModalTitle);
  createTaskForm.appendChild(taskTitleInput);
  createTaskForm.appendChild(taskPrioritySelect);
  createTaskForm.appendChild(taskStatusSelect);
  createTaskForm.appendChild(taskLabelsInput);
  createTaskForm.appendChild(taskModalSubmit);
  createTaskForm.appendChild(deleteTaskButton);
  createTaskForm.appendChild(modalCloseBtn);
  taskModal.appendChild(createTaskForm);
  body.appendChild(taskModal);

  // 5. Placeholder view
  const placeholderView = makeEl("div", "placeholder-view", ["hidden"]);
  const placeholderTitle = makeEl("h2", "placeholder-title");
  const placeholderDescription = makeEl("p", "placeholder-description");
  const placeholderBackButton = makeEl("button", "placeholder-back-button");
  placeholderView.appendChild(placeholderTitle);
  placeholderView.appendChild(placeholderDescription);
  placeholderView.appendChild(placeholderBackButton);
  body.appendChild(placeholderView);

  return {
    document: doc,
    body,
    elements: {
      projectTitleIcon,
      projectTitleHeading,
      projectStatusPill,
      projectTitleDescription,
      kanbanSortButton,
      kanbanFilterButton,
      projectView,
      linkDev,
      linkStock,
      linkDsa,
      kanbanBoard,
      colTodo,
      cardsTodo,
      countTodo,
      colDone,
      cardsDone,
      countDone,
      taskModal,
      createTaskForm,
      taskTitleInput,
      taskPrioritySelect,
      taskStatusSelect,
      taskLabelsInput,
      taskModalTitle,
      taskModalSubmit,
      deleteTaskButton,
      modalCloseBtn,
      placeholderView,
      placeholderTitle,
      placeholderDescription,
      placeholderBackButton
    }
  };
}

test("Phase 3: renderProjectHeader updates header and active project link", () => {
  const { document: mockDoc, elements } = createPhase3DomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    state.selectedProjectId = "developer-platform";
    renderProjectHeader();

    assert.equal(elements.projectTitleHeading.textContent, "Developer Productivity Platform");
    assert.equal(elements.projectStatusPill.textContent, "In progress");
    assert.equal(elements.linkDev.classList.contains("selected"), true);
    assert.equal(elements.linkStock.classList.contains("selected"), false);
    assert.equal(elements.linkDsa.classList.contains("selected"), false);

    state.selectedProjectId = "stock-engine";
    renderProjectHeader();

    assert.equal(elements.projectTitleHeading.textContent, "Stock Trading Engine");
    assert.equal(elements.projectStatusPill.textContent, "In progress");
    assert.equal(elements.linkDev.classList.contains("selected"), false);
    assert.equal(elements.linkStock.classList.contains("selected"), true);
    assert.equal(elements.linkDsa.classList.contains("selected"), false);

    state.selectedProjectId = "dsa-tracker";
    renderProjectHeader();

    assert.equal(elements.projectTitleHeading.textContent, "DSA Tracker");
    assert.equal(elements.projectStatusPill.textContent, "Planning");
    assert.equal(elements.linkDev.classList.contains("selected"), false);
    assert.equal(elements.linkStock.classList.contains("selected"), false);
    assert.equal(elements.linkDsa.classList.contains("selected"), true);
  } finally {
    globalThis.document = prevDoc;
  }
});

test("Phase 3: renderKanban supports priority sorting and toggles sort button", () => {
  const { document: mockDoc, elements } = createPhase3DomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    state.tasks = [
      { id: "T-1", title: "Low priority task", status: "todo", priority: "low", labels: [], dueDate: "Today", assignee: "AD", completed: false },
      { id: "T-2", title: "High priority task", status: "todo", priority: "high", labels: [], dueDate: "Today", assignee: "AD", completed: false },
      { id: "T-3", title: "Medium priority task", status: "todo", priority: "medium", labels: [], dueDate: "Today", assignee: "AD", completed: false }
    ];

    state.taskSort = "default";
    renderKanban();

    assert.equal(elements.kanbanSortButton.textContent, "Sort");
    assert.equal(elements.kanbanSortButton.getAttribute("aria-pressed"), "false");
    assert.equal(elements.cardsTodo.children[0].dataset.taskId, "T-1");
    assert.equal(elements.cardsTodo.children[1].dataset.taskId, "T-2");
    assert.equal(elements.cardsTodo.children[2].dataset.taskId, "T-3");

    state.taskSort = "priority";
    renderKanban();

    assert.equal(elements.kanbanSortButton.textContent, "Sort: Priority");
    assert.equal(elements.kanbanSortButton.getAttribute("aria-pressed"), "true");
    assert.equal(elements.cardsTodo.children[0].dataset.taskId, "T-2"); // high
    assert.equal(elements.cardsTodo.children[1].dataset.taskId, "T-3"); // medium
    assert.equal(elements.cardsTodo.children[2].dataset.taskId, "T-1"); // low
  } finally {
    globalThis.document = prevDoc;
    state.taskSort = "default";
  }
});

test("Phase 3: openCreateTaskModal and closeTaskModal manage focus, body scroll lock, and form state", () => {
  const { document: mockDoc, elements, body } = createPhase3DomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    const triggerBtn = mockDoc.createElement("button");
    triggerBtn.focus();
    assert.equal(mockDoc.activeElement, triggerBtn);

    openCreateTaskModal("todo");

    assert.equal(elements.taskModal.classList.contains("hidden"), false);
    assert.equal(body.classList.contains("modal-open"), true);
    assert.equal(getLastFocusedElement(), triggerBtn);
    assert.equal(mockDoc.activeElement, elements.taskTitleInput);

    closeTaskModal();

    assert.equal(elements.taskModal.classList.contains("hidden"), true);
    assert.equal(body.classList.contains("modal-open"), false);
    assert.equal(mockDoc.activeElement, triggerBtn);
    assert.equal(getLastFocusedElement(), null);
  } finally {
    globalThis.document = prevDoc;
  }
});

test("Phase 3: handleKeydown traps focus inside task modal on Tab and Shift+Tab", () => {
  const { document: mockDoc, elements } = createPhase3DomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    openCreateTaskModal("todo");

    // Modal focusable elements: taskTitleInput, taskPrioritySelect, taskStatusSelect, taskLabelsInput, taskModalSubmit, modalCloseBtn
    // (deleteTaskButton is hidden)
    elements.modalCloseBtn.focus();
    assert.equal(mockDoc.activeElement, elements.modalCloseBtn);

    let defaultPrevented = false;
    handleKeydown({
      key: "Tab",
      shiftKey: false,
      preventDefault: () => { defaultPrevented = true; }
    });

    assert.equal(defaultPrevented, true);
    assert.equal(mockDoc.activeElement, elements.taskTitleInput);

    defaultPrevented = false;
    handleKeydown({
      key: "Tab",
      shiftKey: true,
      preventDefault: () => { defaultPrevented = true; }
    });

    assert.equal(defaultPrevented, true);
    assert.equal(mockDoc.activeElement, elements.modalCloseBtn);
  } finally {
    closeTaskModal();
    globalThis.document = prevDoc;
  }
});

test("Phase 3: renderView renders auxiliary placeholders for settings and new-project", () => {
  const { document: mockDoc, elements } = createPhase3DomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    state.activeView = "settings";
    renderView();

    assert.equal(elements.placeholderTitle.textContent, "Settings");
    assert.match(elements.placeholderDescription.textContent, /preferences/i);

    state.activeView = "new-project";
    renderView();

    assert.equal(elements.placeholderTitle.textContent, "Create Project");
    assert.match(elements.placeholderDescription.textContent, /workspace creation/i);
  } finally {
    globalThis.document = prevDoc;
  }
});

test("Phase 3: handleNavigationClick handles project links, sidebar add, and sort toggle", () => {
  const { document: mockDoc, elements } = createPhase3DomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    // 1. Click project link
    let defaultPrevented = false;
    handleNavigationClick({
      target: elements.linkStock,
      preventDefault: () => { defaultPrevented = true; }
    });

    assert.equal(defaultPrevented, true);
    assert.equal(state.selectedProjectId, "stock-engine");
    assert.equal(state.activeView, "projects");

    // 2. Click sort button
    assert.equal(state.taskSort, "default");
    handleNavigationClick({
      target: elements.kanbanSortButton,
      preventDefault: () => {}
    });
    assert.equal(state.taskSort, "priority");

    handleNavigationClick({
      target: elements.kanbanSortButton,
      preventDefault: () => {}
    });
    assert.equal(state.taskSort, "default");
  } finally {
    globalThis.document = prevDoc;
  }
});

test("Phase 3: handleKeydown handles Escape and Cmd/Ctrl shortcuts", () => {
  const { document: mockDoc, elements } = createPhase3DomEnvironment();
  const prevDoc = globalThis.document;
  globalThis.document = mockDoc;

  try {
    // 1. Escape closes open modal
    openCreateTaskModal("todo");
    assert.equal(elements.taskModal.classList.contains("hidden"), false);

    handleKeydown({
      key: "Escape",
      preventDefault: () => {}
    });
    assert.equal(elements.taskModal.classList.contains("hidden"), true);

    // 2. Escape from auxiliary view returns to overview
    state.activeView = "settings";
    handleKeydown({
      key: "Escape",
      preventDefault: () => {}
    });
    assert.equal(state.activeView, "overview");

    // 3. Ctrl+2 switches to projects
    handleKeydown({
      key: "2",
      ctrlKey: true,
      preventDefault: () => {}
    });
    assert.equal(state.activeView, "projects");

    // 4. Ctrl+1 switches to overview
    handleKeydown({
      key: "1",
      ctrlKey: true,
      preventDefault: () => {}
    });
    assert.equal(state.activeView, "overview");

    // 5. Ctrl+Enter starts focus mode
    handleKeydown({
      key: "Enter",
      ctrlKey: true,
      preventDefault: () => {}
    });
    assert.equal(state.activeView, "focus");
  } finally {
    globalThis.document = prevDoc;
    state.activeView = "overview";
  }
});