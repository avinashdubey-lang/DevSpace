import { state } from "./state.js";

const STORAGE_KEY = "devspace.tasks";

export function saveTasks() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state.tasks)
    );
    return true;
  } catch (error) {
    console.error("Failed to save tasks:", error);
    return false;
  }
}

export async function loadTasks() {
  state.loading = true;
  state.error = null;

  try {
    const savedTasks = localStorage.getItem(STORAGE_KEY);

    if (savedTasks === null) {
      // First visit: preserve the sample tasks.
      saveTasks();
      return;
    }

    const parsedTasks = JSON.parse(savedTasks);

    if (!Array.isArray(parsedTasks)) {
      throw new Error("Saved tasks must be an array.");
    }

    state.tasks = parsedTasks;
  } catch (error) {
    state.error =
      error instanceof Error
        ? error.message
        : String(error);

    console.error("Failed to load tasks:", error);
  } finally {
    state.loading = false;
  }
}
