import { Routes, Route, Navigate } from 'react-router-dom';
import { FileManager } from './pages/FileManager';

/*
 * Phase 1: userId is stored in localStorage as a plain string.
 * Phase 2 (auth): replace this with userId from a JWT token/session.
 */
function getUserId(): string {
  let id = localStorage.getItem('finpulse_user_id');
  if (!id) {
    id = `user_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('finpulse_user_id', id);
  }
  return id;
}

export function App() {
  const userId = getUserId();
  return (
    <Routes>
      <Route path="/" element={<FileManager userId={userId} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
