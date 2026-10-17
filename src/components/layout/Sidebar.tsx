import React from 'react';

interface SidebarProps {
  activeView?: string;
  onSelectView?: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView = 'overview' }) => {
  return (
    <aside className="sidebar" id="sidebar">
      <nav className="sidebar-navigation" aria-label="Main navigation">
        <div className="sidebar-section">
          <p className="sidebar-label">Workspace</p>

          <a
            href="#overview"
            className={`sidebar-link ${activeView === 'overview' ? 'active' : ''}`}
            data-view="overview"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="6" height="6" rx="1"></rect>
              <rect x="14" y="4" width="6" height="6" rx="1"></rect>
              <rect x="4" y="14" width="6" height="6" rx="1"></rect>
              <rect x="14" y="14" width="6" height="6" rx="1"></rect>
            </svg>
            <span>Overview</span>
            <span className="sidebar-shortcut">⌘1</span>
          </a>

          <a href="#inbox" className="sidebar-link" data-view="inbox">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 5h16v14H4z"></path>
              <path d="M4 14h4l2 3h4l2-3h4"></path>
            </svg>
            <span>Inbox</span>
            <span className="sidebar-count">3</span>
          </a>

          <a href="#tasks" className="sidebar-link" data-view="tasks">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="2"></rect>
              <path d="m8 12 2.5 2.5L16 9"></path>
            </svg>
            <span>My Tasks</span>
          </a>

          <a href="#projects" className="sidebar-link" data-view="projects">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h6l2 2h8v10H4z"></path>
            </svg>
            <span>Projects</span>
          </a>

          <a href="#issues" className="sidebar-link" data-view="issues">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8"></circle>
              <path d="M12 8v4l3 2"></path>
            </svg>
            <span>Issues</span>
          </a>

          <a href="#calendar" className="sidebar-link" data-view="calendar">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="5" width="16" height="15" rx="2"></rect>
              <path d="M8 3v4M16 3v4M4 10h16"></path>
            </svg>
            <span>Calendar</span>
          </a>

          <a href="#focus" className="sidebar-link" data-view="focus">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8"></circle>
              <path d="M12 8v4l2.5 2"></path>
            </svg>
            <span>Focus Mode</span>
            <span className="focus-indicator"></span>
          </a>

          <a href="#analytics" className="sidebar-link" data-view="analytics">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 19V9M12 19V5M19 19v-7"></path>
            </svg>
            <span>Analytics</span>
          </a>
        </div>

        <div className="sidebar-section project-section">
          <div className="sidebar-section-header">
            <p className="sidebar-label">Projects</p>

            <button
              className="sidebar-add-button"
              type="button"
              aria-label="Create project"
              id="sidebar-add-project"
            >
              +
            </button>
          </div>

          <a href="#developer-platform" className="project-link selected">
            <span className="project-icon project-icon-blue"></span>
            <span>Developer Platform</span>
          </a>

          <a href="#stock-engine" className="project-link">
            <span className="project-icon project-icon-green"></span>
            <span>Stock Engine</span>
          </a>

          <a href="#dsa-tracker" className="project-link">
            <span className="project-icon project-icon-purple"></span>
            <span>DSA Tracker</span>
          </a>
        </div>
      </nav>

      <div className="sidebar-bottom">
        <a href="#settings" className="sidebar-link" data-view="settings">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"></path>
            <path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 0 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1A2 2 0 0 0 1.6 11H1.4a2 2 0 0 1 0-4h.2A2 2 0 0 0 3 3.6l-.1-.1A2 2 0 0 1 5.7.7l.1.1A2 2 0 0 0 9.2 1V.8a2 2 0 0 1 4 0V1a2 2 0 0 0 3.4-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1A2 2 0 0 0 20.8 7h.2a2 2 0 0 1 0 4h-.2a2 2 0 0 0-1.4 4Z"></path>
          </svg>
          <span>Settings</span>
        </a>

        <div className="sidebar-status">
          <span className="status-online"></span>
          <span>All systems operational</span>
        </div>
      </div>
    </aside>
  );
};
