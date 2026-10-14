import { state } from "./state.js";
import { createTask, updateTask, deleteTask } from "./tasks.js";
import { renderKanban, renderView } from "./render.js";
import { saveTasks } from "./api.js";

const kanbanBoard = document.querySelector("#kanban-board");

const taskModal = document.querySelector("#task-modal");
const createTaskForm = document.querySelector("#create-task-form");
const taskTitleInput = document.querySelector("#task-title");
const taskStatusSelect = document.querySelector("#task-status");
let editingTaskId = null;

const taskModalTitle = document.querySelector("#task-modal-title");
const taskModalSubmit = createTaskForm?.querySelector(
  'button[type="submit"]'
);
const taskLabelsInput = document.querySelector("#task-labels");
const taskPrioritySelect = document.querySelector("#task-priority");
const deleteTaskButton = document.querySelector("#delete-task-button");
const mobileMenuButton = document.querySelector("#mobile-menu-button");
const sidebarBackdrop = document.querySelector("#sidebar-backdrop");

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
  openEditTaskModal(taskId);
}


function getMobileButton() {
  return (typeof document !== "undefined" ? document.querySelector("#mobile-menu-button") : null) || mobileMenuButton;
}

export function closeMobileSidebar() {
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.remove("sidebar-open");
  }
  const btn = getMobileButton();
  if (btn && typeof btn.setAttribute === "function") {
    btn.setAttribute("aria-expanded", "false");
  }
}

export function toggleMobileSidebar() {
  if (typeof document !== "undefined" && document.body) {
    const isOpen = document.body.classList.toggle("sidebar-open");
    const btn = getMobileButton();
    if (btn && typeof btn.setAttribute === "function") {
      btn.setAttribute("aria-expanded", String(isOpen));
    }
    return isOpen;
  }
  return false;
}

function handleSidebarClick(event) {
  const link = event.target.closest(".sidebar-link[data-view]");

  if (!link) return;

  event.preventDefault();

  closeMobileSidebar();

  const view = link.dataset.view;

  if (!view) return;

  if (state.activeView === view) return;

  state.activeView = view;

  renderView();
}

function handlePlaceholderClick(event) {
  const button = event.target.closest("#placeholder-back-button");
  if (!button) return;

  state.activeView = "overview";
  renderView();
}

function handleKeydown(event) {
  if (event.key === "Escape") {
    if (document.body.classList.contains("sidebar-open")) {
      closeMobileSidebar();
      return;
    }

    if (taskModal && !taskModal.classList.contains("hidden")) {
      taskModal.classList.add("hidden");
      createTaskForm?.reset();
      deleteTaskButton.hidden = true;
      editingTaskId = null;
      taskModalTitle.textContent = "Create task";
      taskModalSubmit.textContent = "Create task";
    }
  }
}

let eventsInitialized = false;

export function initializeEvents() {
  if (eventsInitialized) return;
  eventsInitialized = true;

  kanbanBoard?.addEventListener("click", handleKanbanClick);
  document.addEventListener("click", handleSidebarClick);
  document.addEventListener("click", handleAddTaskClick);
  document.addEventListener("click", handleTaskModalClick);
  document.addEventListener("click", handlePlaceholderClick);
  mobileMenuButton?.addEventListener("click", toggleMobileSidebar);
  sidebarBackdrop?.addEventListener("click", closeMobileSidebar);
  document.addEventListener("keydown", handleKeydown);

  createTaskForm?.addEventListener(
    "submit",
    handleCreateTaskSubmit
  );
  kanbanBoard?.addEventListener("dragstart", handleDragStart);
  kanbanBoard?.addEventListener("dragover", handleDragOver);
  kanbanBoard?.addEventListener("dragleave", handleDragLeave);
  kanbanBoard?.addEventListener("drop", handleDrop);
  kanbanBoard?.addEventListener("dragend", handleDragEnd);

  deleteTaskButton?.addEventListener(
    "click",
    handleDeleteTask
  );
}



function handleAddTaskClick(event) {
  const button = event.target.closest(
    ".add-card-button, .project-view-actions .button-primary, #overview-add-task, .page-header-actions .button-secondary"
  );

  // Ignore every click that isn't an Add task button.
  if (!button) return;

  if (!taskModal) return;

  editingTaskId = null;
  taskModalTitle.textContent = "Create task";
  taskModalSubmit.textContent = "Create task";
  deleteTaskButton.hidden = true;
  createTaskForm.reset();

  taskModal.classList.remove("hidden");

  const column = button.closest(".kanban-column");

  if (column) {
    taskStatusSelect.value = column.dataset.status;
  } else {
    taskStatusSelect.value = "todo";
  }

  taskTitleInput.focus();
}


function handleTaskModalClick(event) {
  if (!event.target.closest("[data-close-modal]")) return;

  taskModal.classList.add("hidden");
  createTaskForm.reset();
  deleteTaskButton.hidden = true;

  editingTaskId = null;
  taskModalTitle.textContent = "Create task";
  taskModalSubmit.textContent = "Create task";
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

  const result =
    editingTaskId !== null
      ? updateTask(editingTaskId, taskData)
      : createTask(taskData);

  if (!result) {
    return;
  }

  saveTasks();

  createTaskForm.reset();
  editingTaskId = null;

  taskModal.classList.add("hidden");
  taskModalTitle.textContent = "Create task";
  taskModalSubmit.textContent = "Create task";
  deleteTaskButton.hidden = true;

  renderKanban();
}

function handleDeleteTask() {
  if (editingTaskId === null) return;

  const confirmed = confirm(
    "Are you sure you want to delete this task?"
  );

  if (!confirmed) return;

  const deleted = deleteTask(editingTaskId);

  if (!deleted) return;

  if (state.selectedTaskId === editingTaskId) {
    state.selectedTaskId = null;
  }

  saveTasks();

  createTaskForm.reset();
  editingTaskId = null;

  taskModal.classList.add("hidden");
  taskModalTitle.textContent = "Create task";
  taskModalSubmit.textContent = "Create task";
  deleteTaskButton.hidden = true;

  renderKanban();
}



function openEditTaskModal(taskId) {
  const task = state.tasks.find(
    task => task.id === taskId
  );

  if (!task || !taskModal) return;

  editingTaskId = task.id;

  taskModalTitle.textContent = "Edit task";
  taskModalSubmit.textContent = "Save changes";

  deleteTaskButton.hidden = false;

  taskTitleInput.value = task.title;
  taskPrioritySelect.value = task.priority;
  taskStatusSelect.value = task.status;
  taskLabelsInput.value = task.labels.join(", ");

  taskModal.classList.remove("hidden");
  taskTitleInput.focus();
}


let draggedTaskId = null;

function handleDragStart(event) {
  const card = event.target.closest(".kanban-card");
  if (!card) return;

  draggedTaskId = card.dataset.taskId;

  event.dataTransfer.setData("text/plain", draggedTaskId);
  event.dataTransfer.effectAllowed = "move";
}

function handleDragOver(event) {
  const column = event.target.closest(".kanban-column");
  if (!column) return;

  event.preventDefault();
  column.classList.add("drag-over");
  event.dataTransfer.dropEffect = "move";
}

function handleDragLeave(event) {
  const column = event.target.closest(".kanban-column");
  if (!column) return;

  // Don't remove the highlight when moving between children
  // inside the same column.
  if (event.relatedTarget && column.contains(event.relatedTarget)) {
    return;
  }

  column.classList.remove("drag-over");
}

function handleDrop(event) {
  const column = event.target.closest(".kanban-column");
  if (!column) return;

  event.preventDefault();
  column.classList.remove("drag-over");

  const taskId =
    event.dataTransfer.getData("text/plain") || draggedTaskId;
  const newStatus = column.dataset.status;

  if (!taskId || !newStatus) return;

  const task = state.tasks.find(task => task.id === taskId);
  if (!task || task.status === newStatus) return;

  const updated = updateTask(taskId, { status: newStatus });
  if (!updated) return;

  saveTasks();
  renderKanban();
}

function handleDragEnd() {
  document.querySelectorAll(".kanban-column.drag-over").forEach(column => {
    column.classList.remove("drag-over");
  });

  draggedTaskId = null;
}


