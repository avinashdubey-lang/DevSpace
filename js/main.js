import { loadTasks } from "./api.js";
import {
  renderKanban,
  renderView
} from "./render.js";
import { initializeEvents } from "./events.js";

async function initializeApp() {
  initializeEvents();

  await loadTasks();

  renderKanban();
  renderView();
}

initializeApp();
