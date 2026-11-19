'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ENGINE_VERSION, MAX_WORKSPACE_CHARACTERS, restoreWorkspaces } from '../lib/operations';
import { StaleReviewError, WORKSPACE_STORAGE_KEY, writeCurrentReview, type ReviewSnapshot, type Workspaces } from '../lib/workspace';
import type { CaseReview, ReviewStatus } from '../lib/operations';

type WorkspaceContext = {
  workspaces: Workspaces;
  setWorkspaces: Dispatch<SetStateAction<Workspaces>>;
  loaded: boolean;
  storageError: boolean;
  commitReview: (snapshot: ReviewSnapshot, reviewer: string, status: ReviewStatus, note: string, at: string) => CaseReview;
};
const Context = createContext<WorkspaceContext | null>(null);

/** One browser-local store across routes. Keep the existing key and validation contract. */
export default function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspaces>({});
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const persisted = useRef<string | null>(null);
  useEffect(() => {
    try { const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY); persisted.current = raw; setWorkspaces(restoreWorkspaces(raw)); } catch { setStorageError(true); }
    setLoaded(true);
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== WORKSPACE_STORAGE_KEY && event.key !== null)) return;
      persisted.current = event.newValue;
      setWorkspaces(restoreWorkspaces(event.newValue));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      const raw = JSON.stringify({ version: ENGINE_VERSION, cases: workspaces });
      if (raw.length > MAX_WORKSPACE_CHARACTERS) throw new Error('Workspace size limit');
      if (raw !== persisted.current) { localStorage.setItem(WORKSPACE_STORAGE_KEY, raw); persisted.current = raw; }
      setStorageError(false);
    } catch { setStorageError(true); }
  }, [workspaces, loaded]);
  function commitReview(snapshot: ReviewSnapshot, reviewer: string, status: ReviewStatus, note: string, at: string): CaseReview {
    try {
      // Read from localStorage at the write boundary, never a stale React render.
      const result = writeCurrentReview(localStorage, snapshot, reviewer, status, note, at);
      persisted.current = result.serialized;
      setWorkspaces(result.workspaces);
      setStorageError(false);
      return result.review;
    } catch (error) {
      if (error instanceof StaleReviewError) {
        // Delayed storage events must not permit a stale approval or success event.
        try {
          const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
          persisted.current = raw;
          setWorkspaces(restoreWorkspaces(raw));
        } catch { setStorageError(true); }
      } else if (error instanceof DOMException) {
        setStorageError(true);
      }
      throw error;
    }
  }
  const value = useMemo(() => ({ workspaces, setWorkspaces, loaded, storageError, commitReview }), [workspaces, loaded, storageError]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkspaceProvider is required');
  return value;
}
