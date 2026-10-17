
import { state } from "./state.js";

export const validPriorities = ["low", "medium", "high"];

export const validStatuses = [
  "backlog",
  "todo",
  "in-progress",
  "review",
  "done"
];

export const permittedFields = [
  "title",
  "priority",
  "status",
  "labels",
  "dueDate",
  "assignee"
];

export function getTasksByStatus(status) {
  return state.tasks.filter(task => task.status === status);
}


export function createTask({ title, priority, status, labels = [] }) {
  // Validate title
  if (typeof title !== "string" || title.trim() === "") {
    return null;
  }

  // Validate priority
  if (!validPriorities.includes(priority)) {
    return null;
  }

  // Validate status
  if (!validStatuses.includes(status)) {
    return null;
  }

  // Validate labels
  if (
    !Array.isArray(labels) ||
    !labels.every(label => typeof label === "string")
  ) {
    return null;
  }

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
    labels: labels.map(label => label.trim()).filter(Boolean),
    dueDate: "No due date",
    assignee: "AD",
    completed: status === "done"
  };

  state.tasks = [...state.tasks, task];

  return task;
}




export function updateTask(taskId, incomingData) {
  const task = state.tasks.find(task => task.id === taskId);
  if (!task) return null;

  if (
    incomingData === null ||
    typeof incomingData !== "object" ||
    Array.isArray(incomingData)
  ) {
    return null;
  }

  const fields = Object.keys(incomingData);

  // Reject unknown fields.
  if (!fields.every(field => permittedFields.includes(field))) {
    return null;
  }

  // Reject invalid priority values.
  if (
    incomingData.priority !== undefined &&
    !validPriorities.includes(incomingData.priority)
  ) {
    return null;
  }

  // Reject invalid status values.
  if (
    incomingData.status !== undefined &&
    !validStatuses.includes(incomingData.status)
  ) {
    return null;
  }

  // Validate other fields before changing the task.
  if (
    incomingData.title !== undefined &&
    (typeof incomingData.title !== "string" ||
      incomingData.title.trim() === "")
  ) {
    return null;
  }

  if (
    incomingData.labels !== undefined &&
    (!Array.isArray(incomingData.labels) ||
      !incomingData.labels.every(label => typeof label === "string"))
  ) {
    return null;
  }

  if (
    incomingData.dueDate !== undefined &&
    typeof incomingData.dueDate !== "string"
  ) {
    return null;
  }

  if (
    incomingData.assignee !== undefined &&
    typeof incomingData.assignee !== "string"
  ) {
    return null;
  }

  const sanitizedUpdates = fields.reduce((acc, field) => {
    if (incomingData[field] !== undefined) {
      acc[field] = incomingData[field];
    }
    return acc;
  }, {});

  if (sanitizedUpdates.title !== undefined) {
    sanitizedUpdates.title = sanitizedUpdates.title.trim();
  }

  if (sanitizedUpdates.labels !== undefined) {
    sanitizedUpdates.labels = sanitizedUpdates.labels
      .map(label => label.trim())
      .filter(Boolean);
  }

  Object.assign(task, sanitizedUpdates);

  if (sanitizedUpdates.status !== undefined) {
    task.completed = sanitizedUpdates.status === "done";
  }

  return task;
}


export function deleteTask(taskId) {
  const taskExists = state.tasks.some(task => task.id === taskId);

  if (!taskExists) {
    return false;
  }

  state.tasks = state.tasks.filter(task => task.id !== taskId);

  return true;
}