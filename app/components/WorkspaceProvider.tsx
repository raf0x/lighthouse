'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { restoreWorkspaces } from '../lib/operations';
import {
  changedWorkspaceCases, initializeWorkspaceStore, LEGACY_WORKSPACE_STORAGE_KEY,
  StaleReviewError, WORKSPACE_SAVE_UNAVAILABLE, WORKSPACE_STORAGE_KEY, WorkspaceWriteError,
  withWorkspaceWriteLock, writeCurrentReview, writeWorkspaceChange,
  type ReviewSnapshot, type Workspaces,
} from '../lib/workspace';
import type { CaseReview, ReviewStatus } from '../lib/operations';

type WorkspaceContext = {
  workspaces: Workspaces;
  setWorkspaces: Dispatch<SetStateAction<Workspaces>>;
  saveWorkspaces: (change: SetStateAction<Workspaces>) => Promise<Workspaces>;
  loaded: boolean;
  saving: boolean;
  storageError: boolean;
  storageMessage: string;
  legacyMigration: boolean;
  legacyWriteSeen: boolean;
  commitReview: (snapshot: ReviewSnapshot, reviewer: string, status: ReviewStatus, note: string, at: string) => Promise<CaseReview>;
};
const Context = createContext<WorkspaceContext | null>(null);

/** New authoritative storage lives under an isolated key. Old tabs can continue
 * writing v1, but cannot overwrite the evidence or approval in v2.
 * All new case writes and review submissions take the same exclusive Web Lock.
 */
export default function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setRenderedWorkspaces] = useState<Workspaces>({});
  const rendered = useRef<Workspaces>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);
  const [storageError, setStorageError] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  const [legacyMigration, setLegacyMigration] = useState(false);
  const [legacyWriteSeen, setLegacyWriteSeen] = useState(false);
  const pending = useRef(0);
  const generation = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const reloadAuthoritative = useCallback(() => {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (raw === null) throw new WorkspaceWriteError('The current workspace could not be read. No change was saved.');
    const latest = restoreWorkspaces(raw);
    rendered.current = latest;
    setRenderedWorkspaces(latest);
  }, []);

  useEffect(() => {
    let active = true;
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key === LEGACY_WORKSPACE_STORAGE_KEY) {
        setLegacyWriteSeen(true);
        return;
      }
      if (event.key !== WORKSPACE_STORAGE_KEY && event.key !== null) return;
      if (!initialized.current || pending.current) return;
      try { reloadAuthoritative(); } catch {
        setStorageError(true);
        setStorageMessage('Could not read the saved workspace after another tab changed it.');
      }
    };
    window.addEventListener('storage', sync);
    void withWorkspaceWriteLock(navigator.locks, () => initializeWorkspaceStore(localStorage))
      .then(result => {
        if (!active) return;
        initialized.current = true;
        rendered.current = result.workspaces;
        setRenderedWorkspaces(result.workspaces);
        setLegacyMigration(result.migrated);
        setStorageError(false);
        setStorageMessage('');
        setLoaded(true);
      })
      .catch(error => {
        if (!active) return;
        setStorageError(true);
        setStorageMessage(error instanceof Error ? error.message : WORKSPACE_SAVE_UNAVAILABLE);
        setLoaded(true);
      });
    return () => { active = false; window.removeEventListener('storage', sync); };
  }, [reloadAuthoritative]);

  const saveWorkspaces = useCallback((change: SetStateAction<Workspaces>): Promise<Workspaces> => {
    if (!initialized.current) {
      setStorageError(true);
      setStorageMessage(WORKSPACE_SAVE_UNAVAILABLE);
      return Promise.reject(new WorkspaceWriteError(WORKSPACE_SAVE_UNAVAILABLE));
    }
    const before = rendered.current;
    let optimistic: Workspaces;
    try { optimistic = typeof change === 'function' ? change(before) : change; }
    catch (error) { return Promise.reject(error); }
    if (!changedWorkspaceCases(before, optimistic).length) return queue.current.then(() => rendered.current);
    const epoch = generation.current;
    rendered.current = optimistic;
    setRenderedWorkspaces(optimistic);
    pending.current++;
    setSaving(true);
    const operation = queue.current.then(async () => {
      if (epoch !== generation.current) throw new WorkspaceWriteError('An earlier save failed. Review the latest state before trying again.');
      const result = await withWorkspaceWriteLock(navigator.locks, () =>
        writeWorkspaceChange(localStorage, before, optimistic,
          typeof change === 'function' ? change : undefined));
      if (epoch !== generation.current) throw new WorkspaceWriteError('The workspace changed during this save.');
      pending.current--;
      if (!pending.current) { reloadAuthoritative(); setSaving(false); }
      setStorageError(false);
      setStorageMessage('');
      return result.workspaces;
    });
    // Preserve a usable queue while allowing each caller to observe its own failure.
    queue.current = operation.then(() => undefined, () => undefined);
    return operation.catch(error => {
      if (epoch === generation.current) {
        generation.current++;
        pending.current = 0;
        setSaving(false);
        setStorageError(true);
        setStorageMessage(error instanceof Error ? error.message : WORKSPACE_SAVE_UNAVAILABLE);
        try { reloadAuthoritative(); } catch { /* Do not overwrite the failure. */ }
      }
      throw error;
    });
  }, [reloadAuthoritative]);

  const setWorkspaces = useCallback<Dispatch<SetStateAction<Workspaces>>>(
    change => { void saveWorkspaces(change).catch(() => { /* Error is exposed by provider. */ }); },
    [saveWorkspaces],
  );

  const commitReview = useCallback(async (
    snapshot: ReviewSnapshot, reviewer: string, status: ReviewStatus, note: string, at: string,
  ): Promise<CaseReview> => {
    if (!initialized.current) throw new WorkspaceWriteError(WORKSPACE_SAVE_UNAVAILABLE);
    try {
      await queue.current;
      const result = await withWorkspaceWriteLock(navigator.locks, () =>
        writeCurrentReview(localStorage, snapshot, reviewer, status, note, at));
      if (!pending.current) reloadAuthoritative();
      setStorageError(false);
      setStorageMessage('');
      return result.review;
    } catch (error) {
      if (error instanceof StaleReviewError) {
        if (!pending.current) {
          try { reloadAuthoritative(); } catch { setStorageError(true); }
        }
      } else {
        setStorageError(true);
        setStorageMessage(error instanceof Error ? error.message : WORKSPACE_SAVE_UNAVAILABLE);
      }
      throw error;
    }
  }, [reloadAuthoritative]);

  const value = useMemo(
    () => ({ workspaces, setWorkspaces, saveWorkspaces, loaded, saving, storageError, storageMessage,
      legacyMigration, legacyWriteSeen, commitReview }),
    [workspaces, setWorkspaces, saveWorkspaces, loaded, saving, storageError, storageMessage,
      legacyMigration, legacyWriteSeen, commitReview],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkspaceProvider is required');
  return value;
}
