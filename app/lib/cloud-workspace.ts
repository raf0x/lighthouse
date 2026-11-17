import { ENGINE_VERSION, MAX_WORKSPACE_CHARACTERS, restoreWorkspaces } from './operations';
import { FOLLOW_UP_VERSION, MAX_FOLLOW_UP_CHARACTERS, restoreFollowUps, type FollowUpStore } from './follow-ups';
import type { Workspaces } from './workspace';

export type CloudSnapshot = { schemaVersion: 1; cases: Workspaces; followUps: FollowUpStore };
export type CloudRow = { version: number; payload: CloudSnapshot; last_mutation_id: string | null };
export type Mutation = { version: number; payload: CloudSnapshot; id: string };
export type ReplicaState = { snapshot: CloudSnapshot; version: number; status: 'loading' | 'ready' | 'saving' | 'error' | 'conflict'; dirty: boolean; message: string; cacheError: boolean };
export interface CloudGateway { read(): Promise<CloudRow>; save(mutation: Mutation): Promise<{ version: number }> }
export interface DraftCache { read(): string | null; write(raw: string): void; clear(): void }
export const emptySnapshot = (): CloudSnapshot => ({ schemaVersion: 1, cases: {}, followUps: {} });
const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
export function normalizeSnapshot(value: unknown): CloudSnapshot {
  if (!object(value) || value.schemaVersion !== 1 || !object(value.cases) || !object(value.followUps)) throw new Error('This workspace format cannot be opened. Your saved data has not changed.');
  const casesRaw = JSON.stringify({ version: ENGINE_VERSION, cases: value.cases });
  const tasksRaw = JSON.stringify({ version: FOLLOW_UP_VERSION, accounts: value.followUps });
  if (casesRaw.length > MAX_WORKSPACE_CHARACTERS || tasksRaw.length > MAX_FOLLOW_UP_CHARACTERS) throw new Error('This workspace is too large to save. Download a copy before continuing.');
  const cases = restoreWorkspaces(casesRaw), followUps = restoreFollowUps(tasksRaw);
  if (Object.keys(cases).length !== Object.keys(value.cases).length || Object.keys(followUps).length !== Object.keys(value.followUps).length) throw new Error('Some saved records could not be read. Your saved data has not changed.');
  return { schemaVersion: 1, cases, followUps };
}
export function mergeDeviceSnapshot(cloud: CloudSnapshot, device: CloudSnapshot) {
  const overlap = Object.keys(device.cases).filter(id => cloud.cases[id]).length + Object.keys(device.followUps).filter(id => cloud.followUps[id]).length;
  // Existing cloud records always win. No merge by account name or timestamp.
  return { snapshot: normalizeSnapshot({ schemaVersion: 1, cases: { ...device.cases, ...cloud.cases }, followUps: { ...device.followUps, ...cloud.followUps } }), skipped: overlap };
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Per-user sync engine. Late responses are ignored after disposal; revisions prevent lost updates. */
export class CloudReplica {
  state: ReplicaState = { snapshot: emptySnapshot(), version: 0, status: 'loading', dirty: false, message: '', cacheError: false };
  private pending: Mutation | null = null;
  private disposed = false;
  private busy = false;
  private generation = 0;
  private listeners = new Set<() => void>();
  constructor(private userId: string, private gateway: CloudGateway, private cache: DraftCache, private uuid: () => string) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getState = () => this.state;
  private emit(patch: Partial<ReplicaState>) { if (this.disposed) return; this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  private persist() {
    if (this.disposed) return;
    try { if (this.state.dirty) this.cache.write(JSON.stringify({ userId: this.userId, version: this.state.version, snapshot: this.state.snapshot, pending: this.pending })); else this.cache.clear(); this.emit({ cacheError: false }); }
    catch { this.emit({ cacheError: true }); }
  }
  async start() {
    this.emit({ status: 'loading', message: '' });
    try {
      const row = await this.gateway.read(); if (this.disposed) return;
      const snapshot = normalizeSnapshot(row.payload);
      let cached: { userId: string; version: number; snapshot: CloudSnapshot; pending: Mutation | null } | undefined;
      try { const raw = this.cache.read(); if (raw) { const c = JSON.parse(raw); if (c.userId === this.userId && Number.isSafeInteger(c.version) && c.version >= 0) { normalizeSnapshot(c.snapshot); if (c.pending) { normalizeSnapshot(c.pending.payload); if (typeof c.pending.id !== 'string' || c.pending.version !== c.version) throw new Error('Invalid pending write'); } cached = c; } } } catch { this.emit({ cacheError: true }); }
      if (cached) {
        this.pending = cached.pending;
        this.emit({ snapshot: normalizeSnapshot(cached.snapshot), version: cached.version, dirty: true });
        if (this.pending && row.last_mutation_id === this.pending.id && same(snapshot, normalizeSnapshot(this.pending.payload))) {
          this.pending = null; this.emit({ version: row.version, dirty: !same(snapshot, this.state.snapshot), status: 'ready' }); this.persist();
        } else if (row.version !== cached.version) { this.emit({ status: 'conflict', message: 'This workspace changed on another device. Your unsaved changes are preserved here.' }); return; }
        else this.emit({ status: 'ready' });
        if (this.state.dirty) void this.flush();
      } else this.emit({ snapshot, version: row.version, status: 'ready', dirty: false });
    } catch { this.emit({ status: 'error', message: 'Your workspace could not load. Check your connection and try again.' }); }
  }
  edit(update: (snapshot: CloudSnapshot) => CloudSnapshot) {
    if (this.disposed || this.state.status === 'loading' || this.state.status === 'conflict' || (this.state.status === 'error' && !this.state.dirty)) throw new Error('Wait for your workspace to sync before editing.');
    const snapshot = normalizeSnapshot(update(this.state.snapshot));
    if (same(snapshot, this.state.snapshot)) return;
    this.generation++; this.emit({ snapshot, dirty: true, message: '' }); this.persist(); void this.flush();
  }
  async flush() {
    if (this.disposed || this.busy || !this.state.dirty || this.state.status === 'conflict') return;
    this.busy = true; this.emit({ status: 'saving', message: '' });
    try {
      while (this.state.dirty && !this.disposed) {
        const pending = this.pending ?? { version: this.state.version, payload: this.state.snapshot, id: this.uuid() };
        this.pending = pending; this.persist();
        const result = await this.gateway.save(pending); if (this.disposed) return;
        this.pending = null;
        this.emit({ version: result.version, dirty: !same(this.state.snapshot, pending.payload) }); this.persist();
      }
      this.emit({ status: 'ready' });
    } catch (error) {
      if (this.disposed) return;
      const conflict = object(error) && error.code === '40001';
      this.emit({ status: conflict ? 'conflict' : 'error', message: conflict ? 'This workspace changed on another device. Your unsaved changes are preserved here.' : 'Changes have not reached the cloud. Retry when you are connected.' }); this.persist();
    } finally { this.busy = false; }
  }
  async refresh() {
    if (this.disposed || this.busy || this.state.dirty || this.state.status !== 'ready') return;
    const generation = this.generation;
    try { const row = await this.gateway.read(); if (!this.disposed && generation === this.generation && !this.state.dirty && row.version >= this.state.version) this.emit({ snapshot: normalizeSnapshot(row.payload), version: row.version, message: '' }); }
    catch { /* A failed background read never replaces a valid workspace. */ }
  }
  async retry() { if (this.state.dirty) await this.flush(); else await this.start(); }
  async loadLatest() {
    if (this.busy || this.disposed) return;
    // Caller must offer/export the preserved draft before choosing this action.
    const generation = this.generation;
    const row = await this.gateway.read(); if (this.disposed) return;
    if (generation !== this.generation) throw new Error('Changes were made while loading. Try again.');
    const snapshot = normalizeSnapshot(row.payload); this.generation++; this.pending = null;
    this.emit({ snapshot, version: row.version, dirty: false, status: 'ready', message: '' }); this.persist();
  }
  dispose() { this.disposed = true; this.listeners.clear(); }
}
