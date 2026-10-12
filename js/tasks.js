import { state } from "./state.js";

export function getTasksByStatus(status) {
  return state.tasks.filter(task => task.status === status);
}


export function createTask({ title, priority, status, labels }) {
  const nextNumber = state.tasks.reduce((max, task) => {
    const match = task.id.match(/(\d+)$/);
    const number = match ? Number(match[1]) : 0;

    return Math.max(max, number);
  }, 0) + 1;

  const task = {
    id: `DEV-${nextNumber}`,
    title: title.trim(),
    status,
    priority,
    labels,
    dueDate: "No due date",
    assignee: "AD",
    completed: status === "done"
  };

  state.tasks = [...state.tasks, task];

  return task;
}


export function updateTask(taskId, updates) {
  const task = state.tasks.find(
    task => task.id === taskId
  );

  if (!task) {
    return null;
  }

  Object.assign(task, updates);

  if (updates.status !== undefined) {
    task.completed = updates.status === "done";
  }

  return task;
}

