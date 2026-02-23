import React from 'react';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <header className="layout-header">
        <h1>TMDB Search</h1>
      </header>
      <main className="layout-main">
        {children}
      </main>
    </div>
  );
}
