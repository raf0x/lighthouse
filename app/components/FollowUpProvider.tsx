'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applyFollowUpAction, FOLLOW_UP_STORAGE_KEY, FOLLOW_UP_VERSION, MAX_FOLLOW_UP_CHARACTERS, restoreFollowUps, type FollowUpAction, type FollowUpStore } from '../lib/follow-ups';
import { workspaceAccounts } from '../lib/workspace';
import { useWorkspace } from './WorkspaceProvider';

type FollowUpContext = {
  accountWork: FollowUpStore; loaded: boolean; storageError: boolean;
  act: (accountId: string, revision: number, action: FollowUpAction) => string | null;
};
const Context = createContext<FollowUpContext | null>(null);
export default function FollowUpProvider({ children }: { children: React.ReactNode }) {
  const { workspaces, loaded: casesLoaded } = useWorkspace();
  const [accountWork, setAccountWork] = useState<FollowUpStore>({});
  const current = useRef<FollowUpStore>({});
  const [loaded, setLoaded] = useState(false), [storageError, setStorageError] = useState(false);
  const accountIds = useMemo(() => new Set(workspaceAccounts(workspaces).map(a => a.id)), [workspaces]);
  useEffect(() => {
    const restore = (raw: string | null) => { current.current = restoreFollowUps(raw); setAccountWork(current.current); };
    try { restore(localStorage.getItem(FOLLOW_UP_STORAGE_KEY)); } catch { setStorageError(true); }
    setLoaded(true);
    const sync = (event: StorageEvent) => {
      if (event.key !== FOLLOW_UP_STORAGE_KEY && event.key !== null) return;
      try { if (event.storageArea === localStorage) restore(event.newValue); } catch { setStorageError(true); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  function act(accountId: string, revision: number, action: FollowUpAction) {
    if (!loaded || !casesLoaded || !accountIds.has(accountId)) return 'This account is not available yet.';
    try {
      // Re-read before a write so a background tab cannot silently overwrite newer work.
      try {
        const stored = restoreFollowUps(localStorage.getItem(FOLLOW_UP_STORAGE_KEY));
        if (!storageError) { current.current = stored; setAccountWork(stored); }
      } catch { /* Keep session changes available when storage is blocked. */ }
      const next = applyFollowUpAction(current.current, accountId, revision, action, new Date().toISOString(), crypto.randomUUID());
      const raw = JSON.stringify({ version: FOLLOW_UP_VERSION, accounts: next });
      if (raw.length > MAX_FOLLOW_UP_CHARACTERS) return 'This workspace has reached its local storage limit.';
      current.current = next; setAccountWork(next);
      try { localStorage.setItem(FOLLOW_UP_STORAGE_KEY, raw); setStorageError(false); } catch { setStorageError(true); }
      return null;
    } catch (error) { return error instanceof Error ? error.message : 'The follow-up could not be saved.'; }
  }
  return <Context.Provider value={{ accountWork, loaded: loaded && casesLoaded, storageError, act }}>{children}</Context.Provider>;
}
export function useFollowUps() {
  const value = useContext(Context);
  if (!value) throw new Error('FollowUpProvider is required');
  return value;
}
