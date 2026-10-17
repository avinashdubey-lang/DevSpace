import React from 'react';

export const StatusBar: React.FC = () => {
  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <span className="statusbar-item">
          <span className="status-online"></span>
          Operational
        </span>

        <span className="statusbar-separator"></span>

        <span className="statusbar-item mono">
          main
        </span>

        <span className="statusbar-item">
          React Scaffold Initialized
        </span>
      </div>

      <div className="statusbar-right">
        <span className="statusbar-shortcut">
          <kbd>⌘ P</kbd>
          Command
        </span>

        <span className="statusbar-shortcut">
          <kbd>⌘ Enter</kbd>
          Focus
        </span>
      </div>
    </footer>
  );
};
