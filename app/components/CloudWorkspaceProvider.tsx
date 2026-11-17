'use client';
import { createContext, Fragment, useContext, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { createClient, type User } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase-browser';
import { CloudReplica, emptySnapshot, mergeDeviceSnapshot, type CloudSnapshot, type ReplicaState } from '../lib/cloud-workspace';
import { applyFollowUpAction, FOLLOW_UP_STORAGE_KEY, restoreFollowUps, type FollowUpAction } from '../lib/follow-ups';
import { restoreWorkspaces } from '../lib/operations';
import { WORKSPACE_STORAGE_KEY, workspaceAccounts, type Workspaces } from '../lib/workspace';

type CloudContext = { enabled: boolean; authReady: boolean; user: User | null; state: ReplicaState; replica: CloudReplica | null; loaded: boolean;
  setCases: Dispatch<SetStateAction<Workspaces>>; act: (id: string, revision: number, action: FollowUpAction) => string | null;
  importDevice: () => { added: number; skipped: number }; signOut: () => Promise<string | null> };
const Context = createContext<CloudContext | null>(null);
const loading: ReplicaState = { snapshot: emptySnapshot(), version: 0, status: 'loading', dirty: false, message: '', cacheError: false };
export default function CloudWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(getSupabase);
  const [user, setUser] = useState<User | null>(null), [authReady, setAuthReady] = useState(!client);
  const [active, setActive] = useState<{ userId: string; replica: CloudReplica; state: ReplicaState } | null>(null);
  useEffect(() => {
    if (!client) return;
    let disposed = false, received = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => { if (!disposed) { received = true; setUser(session?.user ?? null); setAuthReady(true); } });
    void client.auth.getSession().then(({ data }) => { if (!disposed && !received) { setUser(data.session?.user ?? null); setAuthReady(true); } }).catch(() => { if (!disposed && !received) setAuthReady(true); });
    return () => { disposed = true; subscription.unsubscribe(); };
  }, [client]);
  const userId = user?.id;
  useEffect(() => {
    if (!client || !userId) { setActive(null); return; }
    const cacheKey = `lighthouse-cloud-draft-v1:${userId}`;
    // Every request carries a token for this replica's owner, even during account switches.
    const scoped = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { accessToken: async () => {
      const { data, error } = await client.auth.getSession();
      if (error || data.session?.user.id !== userId) throw new Error('Sign in again to save your workspace.');
      return data.session.access_token;
    } });
    const replica = new CloudReplica(userId, {
      read: async () => {
        const { data, error } = await scoped.from('lighthouse_workspaces').select('version,payload,last_mutation_id').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        return data ?? { version: 0, payload: emptySnapshot(), last_mutation_id: null };
      },
      save: async mutation => {
        const { data, error } = await scoped.rpc('save_lighthouse_workspace', { p_expected_version: mutation.version, p_payload: mutation.payload, p_mutation_id: mutation.id }).single<{ version: number }>();
        if (error || !data) throw error ?? new Error('Save failed');
        return data;
      },
    }, { read: () => localStorage.getItem(cacheKey), write: raw => localStorage.setItem(cacheKey, raw), clear: () => localStorage.removeItem(cacheKey) }, () => crypto.randomUUID());
    const update = () => setActive({ userId, replica, state: replica.state });
    const unsubscribe = replica.subscribe(update); update(); void replica.start();
    const refresh = () => { if (document.visibilityState === 'visible') void replica.refresh(); };
    const online = () => { if (replica.state.status === 'error') void replica.retry(); else refresh(); };
    const warn = (event: BeforeUnloadEvent) => { if (replica.state.dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('focus', refresh); window.addEventListener('online', online); window.addEventListener('beforeunload', warn); document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 15000);
    return () => { unsubscribe(); replica.dispose(); clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', online); window.removeEventListener('beforeunload', warn); document.removeEventListener('visibilitychange', refresh); };
  }, [client, userId]);
  const owned = active?.userId === userId ? active : null;
  const replica = owned?.replica ?? null, state = owned?.state ?? loading;
  const loaded = Boolean(user && replica && state.status !== 'loading' && !(state.status === 'error' && !state.dirty));
  const setCases: Dispatch<SetStateAction<Workspaces>> = update => {
    if (!replica) return;
    replica.edit(snapshot => ({ ...snapshot, cases: typeof update === 'function' ? update(snapshot.cases) : update }));
  };
  function act(id: string, revision: number, action: FollowUpAction) {
    try {
      if (!replica || !workspaceAccounts(replica.state.snapshot.cases).some(a => a.id === id)) return 'This account is not available.';
      replica.edit(snapshot => ({ ...snapshot, followUps: applyFollowUpAction(snapshot.followUps, id, revision, action, new Date().toISOString(), crypto.randomUUID()) }));
      return null;
    } catch (error) { return error instanceof Error ? error.message : 'The follow-up could not be saved.'; }
  }
  function importDevice() {
    if (!replica || replica.state.status !== 'ready' || replica.state.dirty) throw new Error('Wait for your workspace to finish saving.');
    const device: CloudSnapshot = { schemaVersion: 1, cases: restoreWorkspaces(localStorage.getItem(WORKSPACE_STORAGE_KEY)), followUps: restoreFollowUps(localStorage.getItem(FOLLOW_UP_STORAGE_KEY)) };
    const result = mergeDeviceSnapshot(replica.state.snapshot, device);
    const count = Object.keys(device.cases).length + Object.keys(device.followUps).length;
    replica.edit(() => result.snapshot); return { added: count - result.skipped, skipped: result.skipped };
  }
  async function signOut() {
    if (state.dirty) return 'Save your changes before signing out, or download them and load the latest saved version.';
    const result = await client?.auth.signOut({ scope: 'local' });
    return result?.error ? 'Sign-out could not finish. Try again.' : null;
  }
  return <Context.Provider value={{ enabled: Boolean(client), authReady, user, state, replica, loaded, setCases, act, importDevice, signOut }}><Fragment key={!authReady ? 'checking' : userId ?? 'device'}>{children}</Fragment></Context.Provider>;
}
export function useCloudWorkspace() { const value = useContext(Context); if (!value) throw new Error('CloudWorkspaceProvider is required'); return value; }
