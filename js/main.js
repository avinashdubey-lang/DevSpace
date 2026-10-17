import { loadTasks } from "./api.js";
import {
  renderKanban,
  renderOverview,
  renderView
} from "./render.js";
import { initializeEvents } from "./events.js";

async function initializeApp() {
  initializeEvents();

  await loadTasks();

  renderKanban();
  renderOverview();
  renderView();
}

initializeApp();
