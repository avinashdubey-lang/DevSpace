import React from 'react';

export const TopBar: React.FC = () => {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="icon-button mobile-menu-button"
          type="button"
          aria-label="Open navigation"
          aria-expanded="false"
          aria-controls="sidebar"
          id="mobile-menu-button"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>

        <a href="/react.html" className="brand" aria-label="DevSpace home">
          <span className="brand-mark" aria-hidden="true">&gt;_</span>
          <span>devspace</span>
        </a>

        <span className="topbar-divider" aria-hidden="true"></span>

        <button className="workspace-switcher" type="button" id="workspace-switcher">
          <span className="workspace-dot"></span>
          <span>Personal Workspace</span>

          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m7 10 5 5 5-5"></path>
          </svg>
        </button>
      </div>

      <div className="topbar-center">
        <button className="command-trigger" type="button" id="command-trigger">
          <span className="command-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="6"></circle>
              <path d="m16 16 4 4"></path>
            </svg>
          </span>

          <span>Search or jump to...</span>

          <kbd>⌘ K</kbd>
        </button>
      </div>

      <div className="topbar-actions">
        <button
          className="icon-button"
          type="button"
          aria-label="Notifications"
          id="notifications-button"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
            <path d="M10 21h4"></path>
          </svg>

          <span className="notification-dot" aria-hidden="true"></span>
        </button>

        <button className="avatar avatar-user" type="button" aria-label="Open profile">
          AD
        </button>
      </div>
    </header>
  );
};
