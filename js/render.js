import { state } from "./state.js";
import { getTasksByStatus } from "./tasks.js";

const kanbanBoard = document.querySelector("#kanban-board");

const dashboardElements = {
  pageHeader: document.querySelector(".page-header"),
  metrics: document.querySelector(".metric-grid"),
  dashboardLayout: document.querySelector(".dashboard-layout")
};

const projectView = document.querySelector("#project-view");
const focusMode = document.querySelector("#focus-mode");

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

export function renderView() {
  const view = state.activeView;

  // Hide all major views first
  dashboardElements.pageHeader?.classList.add("hidden");
  dashboardElements.metrics?.classList.add("hidden");
  dashboardElements.dashboardLayout?.classList.add("hidden");

  projectView?.classList.add("hidden");
  focusMode?.classList.add("hidden");

  // Show the appropriate view
  if (view === "overview") {
    dashboardElements.pageHeader?.classList.remove("hidden");
    dashboardElements.metrics?.classList.remove("hidden");
    dashboardElements.dashboardLayout?.classList.remove("hidden");
  }

  if (view === "projects" || view === "tasks" || view === "issues") {
    projectView?.classList.remove("hidden");
  }

  if (view === "focus") {
    focusMode?.classList.remove("hidden");
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