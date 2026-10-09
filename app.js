// ============================================================
// Developer Productivity Platform
// Chapters 7 + 8: State → Async Data → Render → DOM
// ============================================================


// ------------------------------------------------------------
// 1. APPLICATION STATE
// ------------------------------------------------------------

const state = {
  tasks: [],
  selectedTaskId: null,

  // Chapter 8
  loading: false,
  error: null
};


// ------------------------------------------------------------
// 2. DOM REFERENCES
// ------------------------------------------------------------

const elements = {
  kanbanBoard: document.querySelector("#kanban-board")
};


// ------------------------------------------------------------
// 3. INITIAL DATA
//    Read the realistic static HTML data once.
// ------------------------------------------------------------

function initializeState() {
  const cards = elements.kanbanBoard.querySelectorAll(".kanban-card");

  state.tasks = Array.from(cards).map(card => {
    const status =
      card.closest(".kanban-column")?.dataset.status ?? "backlog";

    const priorityElement = card.querySelector(".priority-line");

    const labels = Array.from(
      card.querySelectorAll(".kanban-labels .label")
    ).map(label => label.textContent.trim());

    return {
      id: card.dataset.taskId,

      title:
        card.querySelector("h4")?.textContent.trim() ??
        "Untitled task",

      status,

      priority:
        priorityElement?.textContent.trim().toLowerCase() ??
        null,

      labels,

      dueDate:
        card.querySelector(".due-date")?.textContent.trim() ??
        "",

      assignee:
        card.querySelector(".avatar")?.textContent.trim() ??
        "",

      completed:
        card.classList.contains("completed-card")
    };
  });

  const initiallySelected =
    elements.kanbanBoard.querySelector(".selected-card");

  state.selectedTaskId =
    initiallySelected?.dataset.taskId ?? null;
}


// ------------------------------------------------------------
// 4. API STATE MESSAGE
//    Small UI element for loading/error/empty states.
// ------------------------------------------------------------

function createApiStateMessage() {
  const message = document.createElement("p");

  message.classList.add("api-state-message");
  message.setAttribute("aria-live", "polite");
  message.hidden = true;

  elements.kanbanBoard.prepend(message);

  return message;
}

const apiStateMessage = createApiStateMessage();


// ------------------------------------------------------------
// 5. FAKE API
//    Simulates an asynchronous backend request.
//    No real backend is being used yet.
// ------------------------------------------------------------

function fakeFetchTasks() {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Return a copy so the "API" doesn't directly share
      // the application's state reference.

      const tasks = state.tasks.map(task => ({
        ...task,
        labels: [...task.labels]
      }));

      resolve(tasks);
    }, 800);
  });
}


// ------------------------------------------------------------
// 6. DERIVED STATE
// ------------------------------------------------------------

function getTasksByStatus(status) {
  return state.tasks.filter(
    task => task.status === status
  );
}


// ------------------------------------------------------------
// 7. RENDERING
//    UI is derived from application state.
// ------------------------------------------------------------

function renderKanban() {
  const columns =
    elements.kanbanBoard.querySelectorAll(".kanban-column");

  columns.forEach(column => {
    const status = column.dataset.status;

    const cardsContainer =
      column.querySelector(".kanban-cards");

    const countElement =
      column.querySelector(".column-count");

    if (!cardsContainer) return;

    const tasks = getTasksByStatus(status);

    cardsContainer.innerHTML = "";

    tasks.forEach(task => {
      cardsContainer.appendChild(
        createTaskCard(task)
      );
    });

    if (countElement) {
      countElement.textContent = tasks.length;
    }
  });
}


// ------------------------------------------------------------
// 8. TASK CARD RENDERER
// ------------------------------------------------------------

function createTaskCard(task) {
  const card = document.createElement("article");

  card.classList.add("kanban-card");

  card.dataset.taskId = task.id;

  if (task.id === state.selectedTaskId) {
    card.classList.add("selected-card");
  }

  if (task.completed) {
    card.classList.add("completed-card");
  }


  // ---------- Top ----------

  const top = document.createElement("div");

  top.classList.add("kanban-card-top");


  // ---------- Issue ID ----------

  const issueId = document.createElement("span");

  issueId.classList.add("issue-id", "mono");

  issueId.textContent = task.id;

  top.appendChild(issueId);


  // ---------- Priority / Completion ----------

  if (task.completed) {

    const check = document.createElement("span");

    check.classList.add("completion-check");

    check.textContent = "✓";

    top.appendChild(check);

  } else if (task.priority) {

    const priority = document.createElement("span");

    priority.classList.add(
      "priority-line",
      `priority-line-${task.priority}`
    );

    priority.textContent =
      capitalize(task.priority);

    top.appendChild(priority);
  }

  card.appendChild(top);


  // ---------- Title ----------

  const title = document.createElement("h4");

  title.textContent = task.title;

  card.appendChild(title);


  // ---------- Labels ----------

  if (task.labels.length > 0) {

    const labels = document.createElement("div");

    labels.classList.add("kanban-labels");

    task.labels.forEach(labelText => {

      const label = document.createElement("span");

      label.classList.add(
        "label",
        getLabelClass(labelText)
      );

      label.textContent = labelText;

      labels.appendChild(label);
    });

    card.appendChild(labels);
  }


  // ---------- Footer ----------

  const footer = document.createElement("footer");

  footer.classList.add("kanban-card-footer");


  const dueDate = document.createElement("span");

  dueDate.classList.add("due-date");

  dueDate.textContent = task.dueDate;

  footer.appendChild(dueDate);


  const avatar = document.createElement("span");

  avatar.classList.add(
    "avatar",
    "avatar-small"
  );

  avatar.textContent = task.assignee;

  footer.appendChild(avatar);


  card.appendChild(footer);

  return card;
}


// ------------------------------------------------------------
// 9. UI STATE RENDERING
// ------------------------------------------------------------

function renderApiState() {

  elements.kanbanBoard.setAttribute(
    "aria-busy",
    state.loading ? "true" : "false"
  );


  // ---------- Loading ----------

  if (state.loading) {

    apiStateMessage.hidden = false;

    apiStateMessage.textContent =
      "Loading tasks…";

    return;
  }


  // ---------- Error ----------

  if (state.error) {

    apiStateMessage.hidden = false;

    apiStateMessage.textContent =
      `Could not load tasks: ${state.error}`;

    return;
  }


  // ---------- Empty ----------

  if (state.tasks.length === 0) {

    apiStateMessage.hidden = false;

    apiStateMessage.textContent =
      "No tasks yet. Create your first task.";

    return;
  }


  // ---------- Success ----------

  apiStateMessage.hidden = true;

  apiStateMessage.textContent = "";
}


// ------------------------------------------------------------
// 10. CENTRAL UI RENDER
//     State → UI
// ------------------------------------------------------------

function renderUI() {
  renderKanban();
  renderApiState();
}


// ------------------------------------------------------------
// 11. ASYNC DATA LOADING
//     Chapter 8 implementation.
// ------------------------------------------------------------

async function loadTasks() {

  // Request starts
  state.loading = true;
  state.error = null;

  renderUI();


  try {

    // Wait for asynchronous operation
    const tasks = await fakeFetchTasks();


    // Update state with returned data
    state.tasks = tasks;

  } catch (error) {

    // Store error in state
    state.error =
      error instanceof Error
        ? error.message
        : String(error);

  } finally {

    // Always finish loading
    state.loading = false;

    // Render final state
    renderUI();
  }
}


// ------------------------------------------------------------
// 12. STATE UPDATE
//     Immutable update.
// ------------------------------------------------------------

function selectTask(taskId) {

  state.selectedTaskId = taskId;

  renderUI();
}


// ------------------------------------------------------------
// 13. EVENTS
//     Event → Update State → Render
// ------------------------------------------------------------

function handleKanbanClick(event) {

  const card =
    event.target.closest(".kanban-card");

  if (!card) return;

  selectTask(card.dataset.taskId);
}


elements.kanbanBoard.addEventListener(
  "click",
  handleKanbanClick
);


// ------------------------------------------------------------
// 14. INITIALIZE APPLICATION
// ------------------------------------------------------------

initializeState();

renderUI();

loadTasks();