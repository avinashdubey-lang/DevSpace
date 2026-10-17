import { state, projects } from "./state.js";
import { createTask, updateTask, deleteTask } from "./tasks.js";
import { renderKanban, renderFocusSession, renderOverview, renderView } from "./render.js";
import { saveTasks } from "./api.js";
import {
  completeFocusTask,
  pauseFocusTimer,
  resolveFocusTask,
  toggleFocusTimer
} from "./focus.js";

const kanbanBoard = typeof document !== "undefined" ? document.querySelector("#kanban-board") : null;

const taskModal = typeof document !== "undefined" ? document.querySelector("#task-modal") : null;
const createTaskForm = typeof document !== "undefined" ? document.querySelector("#create-task-form") : null;
const taskTitleInput = typeof document !== "undefined" ? document.querySelector("#task-title") : null;
const taskStatusSelect = typeof document !== "undefined" ? document.querySelector("#task-status") : null;
let editingTaskId = null;

const taskModalTitle = typeof document !== "undefined" ? document.querySelector("#task-modal-title") : null;
const taskModalSubmit = createTaskForm?.querySelector(
  'button[type="submit"]'
);
const taskLabelsInput = typeof document !== "undefined" ? document.querySelector("#task-labels") : null;
const taskPrioritySelect = typeof document !== "undefined" ? document.querySelector("#task-priority") : null;
const deleteTaskButton = typeof document !== "undefined" ? document.querySelector("#delete-task-button") : null;
const mobileMenuButton = typeof document !== "undefined" ? document.querySelector("#mobile-menu-button") : null;
const sidebarBackdrop = typeof document !== "undefined" ? document.querySelector("#sidebar-backdrop") : null;

function getEl(cached, selector) {
  return (typeof document !== "undefined" ? document.querySelector(selector) : null) || cached;
}

let lastFocusedElement = null;

export function setLastFocusedElement(element) {
  lastFocusedElement = element;
}

export function getLastFocusedElement() {
  return lastFocusedElement;
}

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

function enterFocusView() {
  resolveFocusTask();
  state.activeView = "focus";
  renderView();
}

function leaveFocusToOverview() {
  state.activeView = "overview";
  renderView();
}

export function handleNavigationClick(event) {
  // 1. Data-view links (sidebar links, brand link)
  const viewLink = event.target.closest("[data-view]");
  if (viewLink) {
    event.preventDefault();
    closeMobileSidebar();
    const view = viewLink.dataset.view;
    if (view && state.activeView !== view) {
      if (view === "focus") {
        resolveFocusTask();
      }
      state.activeView = view;
      renderView();
    }
    return;
  }

  // 2. Project links / cards (sidebar project links, Overview project progress cards)
  const projectEl = event.target.closest("[data-project-id]");
  if (projectEl) {
    event.preventDefault();
    closeMobileSidebar();
    const projId = projectEl.dataset.projectId;
    if (projId && projects[projId]) {
      state.selectedProjectId = projId;
    }
    state.activeView = "projects";
    renderView();
    return;
  }

  // 3. Add Project button in sidebar
  if (event.target.closest("#sidebar-add-project")) {
    event.preventDefault();
    closeMobileSidebar();
    state.activeView = "new-project";
    renderView();
    return;
  }

  // 4. All projects button in Overview
  if (event.target.closest("#overview-all-projects")) {
    event.preventDefault();
    closeMobileSidebar();
    state.activeView = "projects";
    renderView();
    return;
  }

  // 5. Kanban Sort button
  if (event.target.closest("#kanban-sort-button")) {
    event.preventDefault();
    state.taskSort = state.taskSort === "priority" ? "default" : "priority";
    renderKanban();
    return;
  }
}

export const handleSidebarClick = handleNavigationClick;

function handlePlaceholderClick(event) {
  const button = event.target.closest("#placeholder-back-button");
  if (!button) return;

  state.activeView = "overview";
  renderView();
}

export function handleKeydown(event) {
  const modal = getEl(taskModal, "#task-modal");
  const isModalOpen = modal && !modal.classList.contains("hidden");

  if (isModalOpen) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeTaskModal();
      return;
    }

    if (event.key === "Tab") {
      const focusableSelectors = [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(", ");

      const allElements = Array.from(modal.querySelectorAll(focusableSelectors));
      const focusableElements = allElements.filter(el => {
        return !el.hidden && el.type !== "hidden" && el.style?.display !== "none";
      });

      if (focusableElements.length > 0) {
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement || !modal.contains(document.activeElement)) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !modal.contains(document.activeElement)) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
      return;
    }

    return;
  }

  if (event.key === "Escape") {
    if (typeof document !== "undefined" && document.body?.classList.contains("sidebar-open")) {
      closeMobileSidebar();
      return;
    }

    if (state.activeView !== "overview") {
      state.activeView = "overview";
      renderView();
      return;
    }
  }

  const isModifier = event.ctrlKey || event.metaKey;
  if (isModifier) {
    if (event.key === "1") {
      event.preventDefault();
      closeMobileSidebar();
      state.activeView = "overview";
      renderView();
      return;
    }

    if (event.key === "2") {
      event.preventDefault();
      closeMobileSidebar();
      state.activeView = "projects";
      renderView();
      return;
    }

    if (event.key === "k" || event.key === "K") {
      event.preventDefault();
      const commandTrigger = typeof document !== "undefined" ? document.querySelector("#command-trigger") : null;
      commandTrigger?.focus();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (state.activeView === "focus") {
        toggleFocusTimer(renderFocusSession);
      } else {
        enterFocusView();
      }
      return;
    }
  }
}

function handleFocusClick(event) {
  if (event.target.closest("#overview-start-focus")) {
    enterFocusView();
    return;
  }

  if (event.target.closest("#focus-close-button, #focus-empty-back")) {
    leaveFocusToOverview();
    return;
  }

  if (event.target.closest("#focus-toggle-button")) {
    toggleFocusTimer(renderFocusSession);
    return;
  }

  if (event.target.closest("#focus-complete-button")) {
    const result = completeFocusTask();

    if (result.ok) {
      renderKanban();
      renderOverview();
    }

    renderFocusSession();
  }
}

export function completeTaskById(taskId) {
  if (!taskId || typeof taskId !== "string") {
    return { ok: false, reason: "invalid-id", task: null, saved: false };
  }

  const task = state.tasks.find(t => t.id === taskId);
  if (!task) {
    return { ok: false, reason: "missing", task: null, saved: false };
  }

  const updated = updateTask(taskId, { status: "done" });
  if (!updated) {
    return { ok: false, reason: "invalid", task: null, saved: false };
  }

  if (state.focusTaskId === taskId) {
    pauseFocusTimer();
    state.focusTaskId = null;
  }

  const saved = saveTasks();

  renderOverview();
  renderKanban();

  if (state.activeView === "focus") {
    renderFocusSession();
  }

  return {
    ok: true,
    reason: saved ? "completed" : "save-failed",
    task: updated,
    saved
  };
}

function handleTodayFocusClick(event) {
  const checkbox = event.target.closest(".task-checkbox");
  if (checkbox) {
    const taskId =
      checkbox.dataset.taskId ||
      checkbox.closest(".task-row")?.dataset.taskId;

    if (taskId) {
      completeTaskById(taskId);
    }
    return;
  }

  const viewAllBtn = event.target.closest(
    "#overview-view-all, .focus-panel .text-button"
  );
  if (viewAllBtn) {
    state.activeView = "tasks";
    renderView();
    return;
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
  document.addEventListener("click", handleFocusClick);
  document.addEventListener("click", handleTodayFocusClick);
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



export function closeTaskModal() {
  const modal = getEl(taskModal, "#task-modal");
  if (modal) {
    modal.classList.add("hidden");
  }

  if (typeof document !== "undefined" && document.body) {
    document.body.classList.remove("modal-open");
  }

  const form = getEl(createTaskForm, "#create-task-form");
  form?.reset();

  const delBtn = getEl(deleteTaskButton, "#delete-task-button");
  if (delBtn) {
    delBtn.hidden = true;
  }

  editingTaskId = null;

  const modalTitle = getEl(taskModalTitle, "#task-modal-title");
  if (modalTitle) {
    modalTitle.textContent = "Create task";
  }

  const modalSubmit = form?.querySelector('button[type="submit"]') || taskModalSubmit;
  if (modalSubmit) {
    modalSubmit.textContent = "Create task";
  }

  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
  lastFocusedElement = null;
}

export function openCreateTaskModal(defaultStatus = "todo") {
  const modal = getEl(taskModal, "#task-modal");
  if (!modal) return;

  if (typeof document !== "undefined" && document.activeElement) {
    lastFocusedElement = document.activeElement;
  }

  editingTaskId = null;

  const modalTitle = getEl(taskModalTitle, "#task-modal-title");
  if (modalTitle) modalTitle.textContent = "Create task";

  const form = getEl(createTaskForm, "#create-task-form");
  const modalSubmit = form?.querySelector('button[type="submit"]') || taskModalSubmit;
  if (modalSubmit) modalSubmit.textContent = "Create task";

  const delBtn = getEl(deleteTaskButton, "#delete-task-button");
  if (delBtn) delBtn.hidden = true;

  form?.reset();

  modal.classList.remove("hidden");
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.add("modal-open");
  }

  const statusSelect = getEl(taskStatusSelect, "#task-status");
  if (statusSelect) {
    statusSelect.value = defaultStatus;
  }

  const titleInput = getEl(taskTitleInput, "#task-title");
  titleInput?.focus();
}

function handleAddTaskClick(event) {
  const button = event.target.closest(
    ".add-card-button, .project-view-actions .button-primary, #overview-add-task, .page-header-actions .button-secondary"
  );

  // Ignore every click that isn't an Add task button.
  if (!button) return;

  const column = button.closest(".kanban-column");
  const defaultStatus = column ? column.dataset.status : "todo";

  openCreateTaskModal(defaultStatus);
}

function handleTaskModalClick(event) {
  const modal = getEl(taskModal, "#task-modal");
  if (event.target === modal || event.target.closest("[data-close-modal]")) {
    closeTaskModal();
  }
}

function handleCreateTaskSubmit(event) {
  event.preventDefault();

  const form = getEl(createTaskForm, "#create-task-form");
  if (!form) return;

  const formData = new FormData(form);
  const title = (formData.get("title") || "").trim();

  if (!title) {
    const titleInput = getEl(taskTitleInput, "#task-title");
    titleInput?.focus();
    return;
  }

  const rawLabels = formData.get("labels");
  const taskData = {
    title,
    priority: formData.get("priority"),
    status: formData.get("status"),
    labels: typeof rawLabels === "string"
      ? rawLabels.split(",").map(label => label.trim()).filter(Boolean)
      : []
  };

  const result =
    editingTaskId !== null
      ? updateTask(editingTaskId, taskData)
      : createTask(taskData);

  if (!result) {
    return;
  }

  saveTasks();
  closeTaskModal();

  renderKanban();
  renderOverview();
}

function handleDeleteTask() {
  if (editingTaskId === null) return;

  const confirmed = typeof confirm === "function"
    ? confirm("Are you sure you want to delete this task?")
    : true;

  if (!confirmed) return;

  const deleted = deleteTask(editingTaskId);

  if (!deleted) return;

  if (state.selectedTaskId === editingTaskId) {
    state.selectedTaskId = null;
  }

  if (state.focusTaskId === editingTaskId) {
    state.focusTaskId = null;
  }

  saveTasks();
  closeTaskModal();

  renderKanban();
  renderOverview();

  if (state.activeView === "focus") {
    renderFocusSession();
  }
}

export function openEditTaskModal(taskId) {
  const task = state.tasks.find(
    task => task.id === taskId
  );

  const modal = getEl(taskModal, "#task-modal");
  if (!task || !modal) return;

  if (typeof document !== "undefined" && document.activeElement) {
    lastFocusedElement = document.activeElement;
  }

  editingTaskId = task.id;

  const modalTitle = getEl(taskModalTitle, "#task-modal-title");
  if (modalTitle) modalTitle.textContent = "Edit task";

  const form = getEl(createTaskForm, "#create-task-form");
  const modalSubmit = form?.querySelector('button[type="submit"]') || taskModalSubmit;
  if (modalSubmit) modalSubmit.textContent = "Save changes";

  const delBtn = getEl(deleteTaskButton, "#delete-task-button");
  if (delBtn) delBtn.hidden = false;

  const titleInput = getEl(taskTitleInput, "#task-title");
  if (titleInput) titleInput.value = task.title;

  const prioritySelect = getEl(taskPrioritySelect, "#task-priority");
  if (prioritySelect) prioritySelect.value = task.priority;

  const statusSelect = getEl(taskStatusSelect, "#task-status");
  if (statusSelect) statusSelect.value = task.status;

  const labelsInput = getEl(taskLabelsInput, "#task-labels");
  if (labelsInput) labelsInput.value = task.labels.join(", ");

  modal.classList.remove("hidden");
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.add("modal-open");
  }

  titleInput?.focus();
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
  renderOverview();

  if (state.activeView === "focus") {
    renderFocusSession();
  }
}

function handleDragEnd() {
  document.querySelectorAll(".kanban-column.drag-over").forEach(column => {
    column.classList.remove("drag-over");
  });

  draggedTaskId = null;
}


