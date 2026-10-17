import React, { useState } from 'react';
import { TopBar } from './components/layout/TopBar';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import type { ActiveView } from './types';

export const App: React.FC = () => {
  const [activeView] = useState<ActiveView>('overview');

  return (
    <div className="app-shell">
      <TopBar />

      <div className="app-body">
        <Sidebar activeView={activeView} />

        <div className="sidebar-backdrop" id="sidebar-backdrop" aria-hidden="true" />

        <main className="main-workspace" id="main-workspace">
          <section className="page-header">
            <div>
              <p className="eyebrow">PERSONAL WORKSPACE / MIGRATION</p>
              <h1>Good evening, Avinash</h1>
              <p className="page-subtitle" id="overview-page-subtitle">
                Phase 5.1: React + Vite + TypeScript Scaffold Initialized
              </p>
            </div>

            <div className="page-header-actions">
              <a
                href="/index.html"
                className="button button-secondary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>&larr;</span>
                <span>Open Vanilla JS Workspace</span>
              </a>

              <button className="button button-primary" type="button">
                Migration Ready
              </button>
            </div>
          </section>

          {/* Metric Grid showing migration status */}
          <section className="metric-grid" aria-label="Migration status summary">
            <article className="metric-card">
              <div className="metric-card-header">
                <span className="metric-label">Automated Tests</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m5 12 4 4L19 6"></path>
                </svg>
              </div>
              <strong className="metric-value">44 / 44</strong>
              <span className="metric-detail positive">All node:test suites passing</span>
            </article>

            <article className="metric-card">
              <div className="metric-card-header">
                <span className="metric-label">Browser CDP Tests</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="8"></circle>
                  <path d="m10 12 2 2 4-4"></path>
                </svg>
              </div>
              <strong className="metric-value">35 / 35</strong>
              <span className="metric-detail positive">Headless Chrome verified</span>
            </article>

            <article className="metric-card">
              <div className="metric-card-header">
                <span className="metric-label">TypeScript Baseline</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2v20M2 12h20"></path>
                </svg>
              </div>
              <strong className="metric-value">Strict</strong>
              <span className="metric-detail positive">Contracts defined</span>
            </article>
          </section>

          {/* Dashboard Panel explaining the side-by-side migration setup */}
          <div className="dashboard-layout">
            <section className="panel focus-panel">
              <header className="panel-header">
                <div>
                  <p className="eyebrow">INCREMENTAL MIGRATION ARCHITECTURE</p>
                  <h2>Phase 5.1 Scaffold Overview</h2>
                </div>
                <span className="status-pill status-progress">In progress</span>
              </header>

              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--text-secondary, #94a3b8)', fontSize: '14px', lineHeight: '1.6' }}>
                <p>
                  DevSpace is now configured with a zero-friction, multi-entry Vite build environment. The original vanilla JavaScript application remains completely preserved and operational as a fallback and reference.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div style={{ background: 'var(--surface-subtle, #1e293b)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span className="status-pill status-done">Active</span>
                      <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>Vanilla JS Workspace</strong>
                    </div>
                    <p style={{ margin: '0 0 12px 0', fontSize: '13px' }}>
                      Live at <code style={{ color: 'var(--accent-blue, #38bdf8)' }}>/index.html</code>. Includes full task CRUD, Kanban drag & drop, Today&apos;s Focus list, and Pomodoro timer.
                    </p>
                    <a href="/index.html" className="button button-secondary" style={{ fontSize: '12px', padding: '6px 12px', textDecoration: 'none', display: 'inline-block' }}>
                      View Live Vanilla App
                    </a>
                  </div>

                  <div style={{ background: 'var(--surface-subtle, #1e293b)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span className="status-pill status-progress">Scaffolded</span>
                      <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>React + TS Preview</strong>
                    </div>
                    <p style={{ margin: '0 0 12px 0', fontSize: '13px' }}>
                      Live at <code style={{ color: 'var(--accent-blue, #38bdf8)' }}>/react.html</code>. Reuses global tokens from <code style={{ color: 'var(--accent-blue, #38bdf8)' }}>style.css</code> with component scaffolding.
                    </p>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                      Ready for Phase 5.2 TaskProvider port
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color, #334155)', paddingTop: '16px' }}>
                  <h3 style={{ fontSize: '14px', color: 'var(--text-primary, #f8fafc)', margin: '0 0 8px 0' }}>
                    Next Migration Milestones
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                    <li><strong>Phase 5.2:</strong> Migrate state, tasks, and persistence into a typed React Context (<code style={{ color: 'var(--accent-blue, #38bdf8)' }}>TaskProvider</code> &amp; <code style={{ color: 'var(--accent-blue, #38bdf8)' }}>useTasks</code>).</li>
                    <li><strong>Phase 5.3:</strong> Port the Overview dashboard and Kanban board into modular React components.</li>
                    <li><strong>Phase 5.4:</strong> Port Focus Mode and accessible Task Modal dialogs.</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>

          <StatusBar />
        </main>
      </div>
    </div>
  );
};

export default App;
