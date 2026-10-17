export const state = {
  tasks: [
    {
      id: "DEV-142",
      title: "Implement JWT refresh flow",
      status: "backlog",
      priority: "high",
      labels: ["backend", "auth"],
      dueDate: "Today",
      assignee: "AD",
      completed: false
    },

    {
      id: "DEV-138",
      title: "Fix PostgreSQL connection pooling",
      status: "todo",
      priority: "medium",
      labels: ["database"],
      dueDate: "Today",
      assignee: "AD",
      completed: false
    },

    {
      id: "API-028",
      title: "Review API error handling",
      status: "in-progress",
      priority: "medium",
      labels: ["api"],
      dueDate: "Tomorrow",
      assignee: "AD",
      completed: false
    },

    {
      id: "DEV-151",
      title: "Build authentication middleware",
      status: "review",
      priority: "high",
      labels: ["backend", "auth"],
      dueDate: "Oct 12",
      assignee: "AD",
      completed: false
    },

    {
      id: "DEV-129",
      title: "Setup PostgreSQL schema",
      status: "done",
      priority: "low",
      labels: ["database"],
      dueDate: "Oct 5",
      assignee: "AD",
      completed: true
    }
  ],

  selectedTaskId: null,
  focusTaskId: null,
  selectedProjectId: "developer-platform",
  taskSort: "default",
  loading: false,
  error: null,
  activeView: "overview"
};

export const projects = {
  "developer-platform": {
    id: "developer-platform",
    title: "Developer Productivity Platform",
    description: "Build the developer workspace for planning, focus, and execution.",
    iconClass: "project-icon-blue",
    statusText: "In progress"
  },
  "stock-engine": {
    id: "stock-engine",
    title: "Stock Trading Engine",
    description: "Algorithmic execution, risk analytics, and real-time market data.",
    iconClass: "project-icon-green",
    statusText: "In progress"
  },
  "dsa-tracker": {
    id: "dsa-tracker",
    title: "DSA Tracker",
    description: "Data structures, algorithm challenges, and technical interview prep.",
    iconClass: "project-icon-purple",
    statusText: "Planning"
  }
};