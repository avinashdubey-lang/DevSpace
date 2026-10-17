import { state } from "./state.js";
import { getTasksByStatus } from "./tasks.js";
import {
  cleanupFocusTimer,
  formatFocusDuration,
  formatFocusTime,
  getFocusTimerState,
  syncFocusTask
} from "./focus.js";

const kanbanBoard = document.querySelector("#kanban-board");

const dashboardElements = {
  pageHeader: document.querySelector(".page-header"),
  metrics: document.querySelector(".metric-grid"),
  dashboardLayout: document.querySelector(".dashboard-layout")
};

const projectView = document.querySelector("#project-view");
const focusMode = document.querySelector("#focus-mode");
const placeholderView = document.querySelector("#placeholder-view");
const placeholderTitle = document.querySelector("#placeholder-title");
const placeholderDescription = document.querySelector("#placeholder-description");

function createTaskCard(task) {
  const card = document.createElement("article");

  card.classList.add("kanban-card");
  card.draggable = true;

  if (task.completed) {
    card.classList.add("completed-card");
  }

  if (task.id === state.selectedTaskId) {
    card.classList.add("selected-card");
  }

  card.dataset.taskId = task.id;

  const top = document.createElement("div");
  top.classList.add("kanban-card-top");

  const issueId = document.createElement("span");
  issueId.classList.add("issue-id", "mono");
  issueId.textContent = task.id;

  top.appendChild(issueId);

  if (task.completed) {
    const completionCheck = document.createElement("span");
    completionCheck.classList.add("completion-check");
    completionCheck.textContent = "✓";

    top.appendChild(completionCheck);
  } else {
    const priority = document.createElement("span");

    priority.classList.add(
      "priority-line",
      `priority-line-${task.priority}`
    );

    priority.textContent = task.priority;

    top.appendChild(priority);
  }

  const title = document.createElement("h4");
  title.textContent = task.title;

  card.appendChild(top);
  card.appendChild(title);

  if (task.labels.length > 0) {
    const labelsContainer = document.createElement("div");
    labelsContainer.classList.add("kanban-labels");

    task.labels.forEach(label => {
      const labelElement = document.createElement("span");

      labelElement.classList.add("label");
      labelElement.textContent = label;

      labelsContainer.appendChild(labelElement);
    });

    card.appendChild(labelsContainer);
  }

  const footer = document.createElement("footer");
  footer.classList.add("kanban-card-footer");

  const dueDate = document.createElement("span");
  dueDate.classList.add("due-date");
  dueDate.textContent = task.dueDate;

  const avatar = document.createElement("span");
  avatar.classList.add("avatar", "avatar-small");
  avatar.textContent = task.assignee;

  footer.appendChild(dueDate);
  footer.appendChild(avatar);

  card.appendChild(footer);

  return card;
}

export function renderKanban() {
  if (!kanbanBoard) return;

  const columns = kanbanBoard.querySelectorAll(".kanban-column");

  columns.forEach(column => {
    const status = column.dataset.status;
    const cardsContainer = column.querySelector(".kanban-cards");
    const countElement = column.querySelector(".column-count");

    if (!cardsContainer) return;

    const tasks = getTasksByStatus(status);

    cardsContainer.innerHTML = "";

    tasks.forEach(task => {
      cardsContainer.appendChild(createTaskCard(task));
    });

    if (countElement) {
      countElement.textContent = tasks.length;
    }
  });
}

function getEl(cached, selector) {
  return (typeof document !== "undefined" ? document.querySelector(selector) : null) || cached;
}

let lastFocusAnnouncement = "";

function setText(element, value) {
  if (element && element.textContent !== value) {
    element.textContent = value;
  }
}

function announceFocusStatus(message) {
  const live = getEl(null, "#focus-live");

  if (!live || message === lastFocusAnnouncement) {
    return;
  }

  lastFocusAnnouncement = message;
  live.textContent = message;
}

export function renderFocusSession() {
  const session = getEl(null, "#focus-session");
  const empty = getEl(null, "#focus-empty");
  const task = syncFocusTask();
  const timer = getFocusTimerState();
  const hasTask = Boolean(task);

  if (session?.classList) {
    session.classList.toggle("hidden", !hasTask);
  }

  if (empty?.classList) {
    empty.classList.toggle("hidden", hasTask);
  }

  const toggleButton = getEl(null, "#focus-toggle-button");
  const completeButton = getEl(null, "#focus-complete-button");
  const timerEl = getEl(null, "#focus-timer");
  const statusEl = getEl(null, "#focus-status");
  const descriptionEl = getEl(null, "#focus-timer-description");
  const progressFill = getEl(null, "#focus-progress-fill");
  const progressPercent = getEl(null, "#focus-progress-percent");
  const progressElapsed = getEl(null, "#focus-progress-elapsed");

  if (hasTask) {
    setText(getEl(null, "#focus-task-title"), task.title);
    setText(getEl(null, "#focus-task-id"), task.id);
    setText(getEl(null, "#focus-task-priority"), task.priority);
  }

  if (timerEl) {
    timerEl.textContent = timer.display;
    if (typeof timerEl.setAttribute === "function") {
      timerEl.setAttribute("datetime", formatFocusDuration(timer.remainingMs));
    }
  }

  const statusLabels = {
    idle: "READY",
    running: "DEEP WORK",
    paused: "PAUSED",
    finished: "SESSION COMPLETE"
  };

  setText(statusEl, statusLabels[timer.phase] || "READY");

  if (toggleButton) {
    const labels = {
      idle: "Start",
      running: "Pause",
      paused: "Resume",
      finished: "Start"
    };

    toggleButton.textContent = labels[timer.phase] || "Start";
    toggleButton.setAttribute(
      "aria-label",
      timer.phase === "running"
        ? "Pause focus timer"
        : timer.phase === "paused"
          ? "Resume focus timer"
          : "Start focus timer"
    );
  }

  if (completeButton) {
    completeButton.disabled = !hasTask;
  }

  const elapsedMs = Math.max(0, timer.durationMs - timer.remainingMs);
  const percent = Math.min(
    100,
    Math.round((elapsedMs / timer.durationMs) * 100)
  );

  if (progressFill && progressFill.style) {
    progressFill.style.width = `${percent}%`;
  }

  setText(progressPercent, `${percent}%`);
  setText(progressElapsed, `${formatFocusTime(elapsedMs)} elapsed`);

  if (!hasTask) {
    const emptyDescription = getEl(null, "#focus-empty-description");
    setText(
      emptyDescription,
      "Select an incomplete task from the board, or create one first."
    );
    setText(
      descriptionEl,
      state.error
        ? `Could not save changes: ${state.error}`
        : "Stay focused on the current task."
    );

    if (state.error) {
      announceFocusStatus(`Could not save changes: ${state.error}`);
    }

    return;
  }

  const descriptions = {
    idle: "Start a 25-minute session on this task.",
    running: "Stay focused on the current task.",
    paused: "Timer paused. Resume when you are ready.",
    finished: "Session complete. Complete the task or start another session."
  };

  if (state.error) {
    setText(descriptionEl, `Could not save changes: ${state.error}`);
    announceFocusStatus(`Could not save changes: ${state.error}`);
    return;
  }

  setText(descriptionEl, descriptions[timer.phase] || descriptions.idle);

  if (timer.phase === "running") {
    announceFocusStatus("Focus timer running.");
  } else if (timer.phase === "paused") {
    announceFocusStatus("Focus timer paused.");
  } else if (timer.phase === "finished") {
    announceFocusStatus("Focus session complete.");
  } else {
    announceFocusStatus("Focus timer ready.");
  }
}

export function renderView() {
  const view = state.activeView;

  const pageHeader = getEl(dashboardElements.pageHeader, ".page-header");
  const metrics = getEl(dashboardElements.metrics, ".metric-grid");
  const dashboardLayout = getEl(dashboardElements.dashboardLayout, ".dashboard-layout");
  const projView = getEl(projectView, "#project-view");
  const focMode = getEl(focusMode, "#focus-mode");
  const placeView = getEl(placeholderView, "#placeholder-view");
  const placeTitle = getEl(placeholderTitle, "#placeholder-title");
  const placeDesc = getEl(placeholderDescription, "#placeholder-description");

  // Hide all major views first
  pageHeader?.classList.add("hidden");
  metrics?.classList.add("hidden");
  dashboardLayout?.classList.add("hidden");

  projView?.classList.add("hidden");
  focMode?.classList.add("hidden");
  placeView?.classList.add("hidden");

  if (view !== "focus") {
    cleanupFocusTimer();
  }

  // Show the appropriate view
  if (view === "overview") {
    pageHeader?.classList.remove("hidden");
    metrics?.classList.remove("hidden");
    dashboardLayout?.classList.remove("hidden");
  } else if (view === "projects" || view === "tasks" || view === "issues") {
    projView?.classList.remove("hidden");
  } else if (view === "focus") {
    focMode?.classList.remove("hidden");
    renderFocusSession();
  } else {
    const auxiliaryViews = {
      inbox: {
        title: "Inbox",
        description: "Unified activity, mentions, and notifications are under active development."
      },
      calendar: {
        title: "Calendar",
        description: "Schedule, task deadlines, and milestone views are under active development."
      },
      analytics: {
        title: "Analytics",
        description: "Productivity metrics, velocity charts, and focus logs are under active development."
      }
    };

    const target = auxiliaryViews[view] || {
      title: view.charAt(0).toUpperCase() + view.slice(1),
      description: "This section is under active development. Check back soon for updates."
    };

    if (placeTitle) {
      placeTitle.textContent = target.title;
    }
    if (placeDesc) {
      placeDesc.textContent = target.description;
    }

    placeView?.classList.remove("hidden");
  }

  updateActiveSidebarLink();
}

function updateActiveSidebarLink() {
  const sidebarLinks = document.querySelectorAll(
    ".sidebar-link[data-view]"
  );

  sidebarLinks.forEach(link => {
    const isActive = link.dataset.view === state.activeView;

    link.classList.toggle("active", isActive);
  });
}