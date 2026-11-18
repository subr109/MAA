import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MaaProvider, useMaa } from './context/MaaContext';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/AppShell';
import { OfflineIndicator } from './components/OfflineIndicator';

const MaaRoot: React.FC = () => {
  const { mode, currentUser } = useMaa();

  if (mode === 'NONE' || !currentUser) {
    return <LoginPage />;
  }

  return <AppShell />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <MaaProvider>
        <MaaRoot />
        <OfflineIndicator />
      </MaaProvider>
    </ErrorBoundary>
  );
}
