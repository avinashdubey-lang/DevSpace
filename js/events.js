import { state } from "./state.js";
import { createTask } from "./tasks.js";
import { renderKanban, renderView } from "./render.js";

const kanbanBoard = document.querySelector("#kanban-board");

const taskModal = document.querySelector("#task-modal");
const createTaskForm = document.querySelector("#create-task-form");
const taskTitleInput = document.querySelector("#task-title");
const taskStatusSelect = document.querySelector("#task-status");

function selectTask(taskId) {
  state.selectedTaskId = taskId;

  renderKanban();
}

function handleKanbanClick(event) {
  const card = event.target.closest(".kanban-card");

  if (!card) return;

  const taskId = card.dataset.taskId;

  if (!taskId) return;

  selectTask(taskId);
}

function handleSidebarClick(event) {
  const link = event.target.closest(".sidebar-link[data-view]");

  if (!link) return;

  event.preventDefault();

  const view = link.dataset.view;

  if (!view) return;

  if (state.activeView === view) return;

  state.activeView = view;

  renderView();
}

export function initializeEvents() {
  kanbanBoard?.addEventListener("click", handleKanbanClick);
  document.addEventListener("click", handleSidebarClick);
  document.addEventListener("click", handleAddTaskClick);
  document.addEventListener("click", handleTaskModalClick);

  createTaskForm?.addEventListener(
  "submit",
  handleCreateTaskSubmit
);
}


function handleAddTaskClick(event) {
  const button = event.target.closest(".add-card-button, .project-view-actions .button-primary");

  if (!button) return;

  if (!taskModal) return;

  taskModal.classList.remove("hidden");

  const column = button.closest(".kanban-column");

  if (column) {
    taskStatusSelect.value = column.dataset.status;
  }

  taskTitleInput.focus();
}

function handleTaskModalClick(event) {
  if (!event.target.closest("[data-close-modal]")) return;

  taskModal.classList.add("hidden");
  createTaskForm.reset();
}


function handleCreateTaskSubmit(event) {
  event.preventDefault();

  const formData = new FormData(createTaskForm);

  const title = formData.get("title").trim();

  if (!title) {
    taskTitleInput.focus();
    return;
  }

  const taskData = {
    title,
    priority: formData.get("priority"),
    status: formData.get("status"),
    labels: formData
      .get("labels")
      .split(",")
      .map(label => label.trim())
      .filter(Boolean)
  };

  createTask(taskData);

  createTaskForm.reset();
  taskModal.classList.add("hidden");

  renderKanban();
}
