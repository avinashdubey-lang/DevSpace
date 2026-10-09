import { state } from "./state.js";

export function getTasksByStatus(status) {
  return state.tasks.filter(task => task.status === status);
}