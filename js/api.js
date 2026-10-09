import { state } from "./state.js";

export function fakeFetchTasks() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(state.tasks);
    }, 800);
  });
}

export async function loadTasks() {
  state.loading = true;
  state.error = null;

  try {
    const tasks = await fakeFetchTasks();

    state.tasks = tasks;
  } catch (error) {
    state.error =
      error instanceof Error
        ? error.message
        : String(error);
  } finally {
    state.loading = false;
  }
}