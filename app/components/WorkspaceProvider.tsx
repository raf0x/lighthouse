'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ENGINE_VERSION, MAX_WORKSPACE_CHARACTERS, restoreWorkspaces } from '../lib/operations';
import { WORKSPACE_STORAGE_KEY, type Workspaces } from '../lib/workspace';
import { useCloudWorkspace } from './CloudWorkspaceProvider';

type WorkspaceContext = { workspaces: Workspaces; setWorkspaces: Dispatch<SetStateAction<Workspaces>>; loaded: boolean; storageError: boolean };
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
  const value = useMemo(() => ({ workspaces, setWorkspaces, loaded, storageError }), [workspaces, loaded, storageError]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  const cloud = useCloudWorkspace();
  if (!value) throw new Error('WorkspaceProvider is required');
  if (cloud.user) return { workspaces: cloud.state.snapshot.cases, setWorkspaces: cloud.setCases, loaded: cloud.loaded, storageError: false };
  return { ...value, loaded: value.loaded && cloud.authReady };
}
