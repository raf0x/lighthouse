'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  changedWorkspaceCases, createAuthoritativeReviewPacket, initializeWorkspaceStore, inspectLegacyWorkspace, LEGACY_WORKSPACE_STORAGE_KEY,
  readAuthoritativeWorkspace, StaleReviewError, WORKSPACE_SAVE_UNAVAILABLE, WORKSPACE_STORAGE_KEY, WorkspaceWriteError,
  withWorkspaceWriteLock, writeCurrentReview, writeWorkspaceChange,
  type LegacyRecoveryStatus, type ReviewSnapshot, type Workspaces,
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
  legacyStatus: LegacyRecoveryStatus;
  commitReview: (snapshot: ReviewSnapshot, reviewer: string, status: ReviewStatus, note: string, at: string) => Promise<CaseReview>;
  getCurrentReviewPacket: (caseId: string) => Promise<ReturnType<typeof createAuthoritativeReviewPacket>>;
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
  const [legacyStatus, setLegacyStatus] = useState<LegacyRecoveryStatus>('none');
  const legacyCheck = useRef(0);
  const pending = useRef(0);
  const generation = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const reloadAuthoritative = useCallback(() => {
    const latest = readAuthoritativeWorkspace(localStorage).workspaces;
    rendered.current = latest;
    setRenderedWorkspaces(latest);
  }, []);

  // Re-read the old key on mount, on cross-tab events and when the tab regains
  // focus. The warning is derived from a durable v2 migration witness, so a
  // reload cannot silently clear a confirmed unsynchronized legacy change.
  const refreshLegacyStatus = useCallback(() => {
    const token = ++legacyCheck.current;
    void inspectLegacyWorkspace(localStorage)
      .then(result => { if (token === legacyCheck.current) setLegacyStatus(result.status); })
      .catch(() => { if (token === legacyCheck.current) setLegacyStatus('unavailable'); });
  }, []);

  useEffect(() => {
    let active = true;
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key === LEGACY_WORKSPACE_STORAGE_KEY || event.key === null) {
        refreshLegacyStatus();
      }
      if (event.key !== WORKSPACE_STORAGE_KEY && event.key !== null) return;
      if (!initialized.current || pending.current) return;
      try { reloadAuthoritative(); } catch {
        setStorageError(true);
        setStorageMessage('Could not read the saved workspace after another tab changed it.');
      }
    };
    const onFocus = () => refreshLegacyStatus();
    const onVisibility = () => { if (document.visibilityState === 'visible') refreshLegacyStatus(); };
    window.addEventListener('storage', sync);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    void withWorkspaceWriteLock(navigator.locks, () => initializeWorkspaceStore(localStorage))
      .then(result => {
        if (!active) return;
        initialized.current = true;
        rendered.current = result.workspaces;
        setRenderedWorkspaces(result.workspaces);
        setLegacyMigration(result.migrated);
        refreshLegacyStatus();
        setStorageError(false);
        setStorageMessage('');
        setLoaded(true);
      })
      .catch(error => {
        if (!active) return;
        refreshLegacyStatus();
        setStorageError(true);
        setStorageMessage(error instanceof Error ? error.message : WORKSPACE_SAVE_UNAVAILABLE);
        setLoaded(true);
      });
    return () => {
      active = false;
      legacyCheck.current++;
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reloadAuthoritative, refreshLegacyStatus]);

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

  const getCurrentReviewPacket = useCallback(async (caseId: string) => {
    if (!initialized.current) throw new WorkspaceWriteError(WORKSPACE_SAVE_UNAVAILABLE);
    // Flush this tab's pending edits first. Never export optimistic text.
    await queue.current;
    // Other current v2 tabs can only edit under the same exclusive lock.
    const packet = await withWorkspaceWriteLock(navigator.locks, () =>
      createAuthoritativeReviewPacket(localStorage, caseId));
    if (!pending.current) reloadAuthoritative();
    return packet;
  }, [reloadAuthoritative]);

  const value = useMemo(
    () => ({ workspaces, setWorkspaces, saveWorkspaces, loaded, saving, storageError, storageMessage,
      legacyMigration, legacyStatus, commitReview, getCurrentReviewPacket }),
    [workspaces, setWorkspaces, saveWorkspaces, loaded, saving, storageError, storageMessage,
      legacyMigration, legacyStatus, commitReview, getCurrentReviewPacket],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkspaceProvider is required');
  return value;
}
