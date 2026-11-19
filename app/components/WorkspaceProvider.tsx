'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { restoreWorkspaces } from '../lib/operations';
import {
  changedWorkspaceCases, StaleReviewError, WORKSPACE_STORAGE_KEY, withWorkspaceWriteLock,
  writeCurrentReview, writeWorkspaceChange, type ReviewSnapshot, type Workspaces,
} from '../lib/workspace';
import type { CaseReview, ReviewStatus } from '../lib/operations';

type WorkspaceContext = {
  workspaces: Workspaces;
  setWorkspaces: Dispatch<SetStateAction<Workspaces>>;
  loaded: boolean;
  storageError: boolean;
  commitReview: (snapshot: ReviewSnapshot, reviewer: string, status: ReviewStatus, note: string, at: string) => Promise<CaseReview>;
};
const Context = createContext<WorkspaceContext | null>(null);

/** All Operations writes, including changes from the evidence editor, use the
 * same browser-native, cross-tab exclusive lock as Harbor review submissions.
 * Local optimistic state keeps the draft text responsive while writes queue.
 */
export default function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setRenderedWorkspaces] = useState<Workspaces>({});
  const rendered = useRef<Workspaces>({});
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const pending = useRef(0);
  const generation = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const reloadAuthoritative = useCallback(() => {
    const latest = restoreWorkspaces(localStorage.getItem(WORKSPACE_STORAGE_KEY));
    rendered.current = latest;
    setRenderedWorkspaces(latest);
  }, []);

  useEffect(() => {
    try { reloadAuthoritative(); } catch { setStorageError(true); }
    setLoaded(true);
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== WORKSPACE_STORAGE_KEY && event.key !== null)) return;
      if (pending.current) return; // The queued writer will reread and merge the latest store.
      try { reloadAuthoritative(); } catch { setStorageError(true); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [reloadAuthoritative]);

  const setWorkspaces = useCallback<Dispatch<SetStateAction<Workspaces>>>((action) => {
    const before = rendered.current;
    const optimistic = typeof action === 'function' ? action(before) : action;
    if (!changedWorkspaceCases(before, optimistic).length) return;
    const epoch = generation.current;
    rendered.current = optimistic;
    setRenderedWorkspaces(optimistic);
    pending.current += 1;
    // Every queued write reads the latest stored case *under* the shared lock.
    // A queued edit to another case merges; a stale edit to this case is rejected.
    queue.current = queue.current.then(async () => {
      if (epoch !== generation.current) return;
      try {
        const result = await withWorkspaceWriteLock(navigator.locks, () =>
          writeWorkspaceChange(
            localStorage, before, optimistic,
            typeof action === 'function' ? action : undefined,
          ),
        );
        if (epoch !== generation.current) return;
        pending.current -= 1;
        if (pending.current === 0) reloadAuthoritative();
        setStorageError(false);
        // A successful write has persisted the latest case, not merely a React render.
        void result;
      } catch {
        // Fail closed. Never retry a stale intent or overwrite a newer tab.
        generation.current += 1;
        pending.current = 0;
        setStorageError(true);
        try { reloadAuthoritative(); } catch { /* Keep the failure notice visible. */ }
      }
    });
  }, [reloadAuthoritative]);

  const commitReview = useCallback(async (
    snapshot: ReviewSnapshot, reviewer: string, status: ReviewStatus, note: string, at: string,
  ): Promise<CaseReview> => {
    try {
      // Flush this tab's pending optimistic edits before examining authoritative data.
      await queue.current;
      const result = await withWorkspaceWriteLock(navigator.locks, () =>
        writeCurrentReview(localStorage, snapshot, reviewer, status, note, at),
      );
      if (pending.current === 0) reloadAuthoritative();
      setStorageError(false);
      return result.review;
    } catch (error) {
      if (error instanceof StaleReviewError) {
        if (pending.current === 0) {
          try { reloadAuthoritative(); } catch { setStorageError(true); }
        }
      } else {
        setStorageError(true);
      }
      throw error;
    }
  }, [reloadAuthoritative]);

  const value = useMemo(
    () => ({ workspaces, setWorkspaces, loaded, storageError, commitReview }),
    [workspaces, setWorkspaces, loaded, storageError, commitReview],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkspaceProvider is required');
  return value;
}
