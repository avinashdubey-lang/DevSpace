import { state } from "./state.js";
import { renderKanban, renderView } from "./render.js";

const kanbanBoard = document.querySelector("#kanban-board");

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
}