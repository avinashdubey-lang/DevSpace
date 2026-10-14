import test, { beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";

import { state } from "./js/state.js";
import {
  createTask,
  updateTask,
  deleteTask,
  validPriorities,
  validStatuses
} from "./js/tasks.js";
import {
  saveTasks,
  loadTasks,
  isValidTask,
  STORAGE_KEY
} from "./js/api.js";

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
  state.loading = false;
  state.error = null;

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