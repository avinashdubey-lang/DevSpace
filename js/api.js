import { state } from "./state.js";
import { validPriorities, validStatuses } from "./tasks.js";

export const STORAGE_KEY = "devspace.tasks";


export function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    !Array.isArray(task) &&
    typeof task.id === "string" &&
    task.id.trim() !== "" &&
    typeof task.title === "string" &&
    task.title.trim() !== "" &&
    validStatuses.includes(task.status) &&
    validPriorities.includes(task.priority) &&
    Array.isArray(task.labels) &&
    task.labels.every(label => typeof label === "string") &&
    typeof task.dueDate === "string" &&
    typeof task.assignee === "string" &&
    typeof task.completed === "boolean"
  );
}


export function saveTasks() {
  try {
    if (typeof localStorage === "undefined" || !localStorage) {
      throw new Error("localStorage is not available.");
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state.tasks)
    );
    state.error = null;
    return true;
  } catch (error) {
    state.error =
      error instanceof Error
        ? error.message
        : String(error);

    console.error("Failed to save tasks:", error);
    return false;
  }
}

export async function loadTasks() {
  state.loading = true;
  state.error = null;

  try {
    if (typeof localStorage === "undefined" || !localStorage) {
      throw new Error("localStorage is not available.");
    }

    const savedTasks = localStorage.getItem(STORAGE_KEY);

    if (savedTasks === null) {
      // First visit: preserve the sample tasks and initialize storage.
      return saveTasks();
    }

    const parsedTasks = JSON.parse(savedTasks);

    if (!Array.isArray(parsedTasks)) {
      throw new Error("Saved tasks must be an array.");
    }

    if (!parsedTasks.every(isValidTask)) {
      throw new Error("Saved tasks contain invalid task data.");
    }

    state.tasks = parsedTasks;

    if (
      state.selectedTaskId &&
      !state.tasks.some(task => task.id === state.selectedTaskId)
    ) {
      state.selectedTaskId = null;
    }

    return true;
  } catch (error) {
    state.error =
      error instanceof Error
        ? error.message
        : String(error);

    console.error("Failed to load tasks:", error);
    return false;
  } finally {
    state.loading = false;
  }
}
