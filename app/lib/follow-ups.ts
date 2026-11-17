export const FOLLOW_UP_STORAGE_KEY = 'lighthouse-follow-ups-v1';
export const FOLLOW_UP_VERSION = 1;
export const MAX_FOLLOW_UP_CHARACTERS = 2_000_000;
export const MAX_ACCOUNT_ACTIVITY = 50;

export type FollowUpDraft = { title: string; owner: string; dueDate: string };
export type FollowUp = FollowUpDraft & {
  id: string; status: 'open' | 'completed'; createdAt: string; updatedAt: string; completedAt?: string;
};
export type AccountActivity = {
  id: string; at: string; kind: 'created' | 'updated' | 'completed' | 'reopened' | 'note';
  task?: FollowUpDraft; note?: string;
};
export type AccountWork = { revision: number; followUp?: FollowUp; activity: AccountActivity[] };
export type FollowUpStore = Record<string, AccountWork>;
export type FollowUpAction =
  | { kind: 'save'; draft: FollowUpDraft }
  | { kind: 'complete' | 'reopen' }
  | { kind: 'note'; note: string };

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown, max: number): value is string => typeof value === 'string' && Boolean(value.trim()) && value.length <= max;
const timestamp = (value: unknown): value is string => typeof value === 'string' && value.length <= 30 && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
export const validAccountId = (value: string) => /^(ACC\d{3}|partner-(OPS-\d{3}|IMP-[a-zA-Z0-9-]{1,100}))$/.test(value);
export function validDueDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2000-01-01' || value > '2100-12-31') return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validDraft(value: unknown): value is FollowUpDraft {
  return isObject(value) && text(value.title, 160) && text(value.owner, 100) && validDueDate(value.dueDate);
}
function copyDraft(value: FollowUpDraft): FollowUpDraft {
  return { title: value.title.trim(), owner: value.owner.trim(), dueDate: value.dueDate };
}
function validTask(value: unknown): value is FollowUp {
  return isObject(value) && text(value.id, 100) && timestamp(value.createdAt) && timestamp(value.updatedAt)
    && (value.status === 'open' && value.completedAt === undefined || value.status === 'completed' && timestamp(value.completedAt)) && validDraft(value);
}
function validActivity(value: unknown): value is AccountActivity {
  return isObject(value) && text(value.id, 100) && timestamp(value.at) &&
    (value.kind === 'note' ? text(value.note, 2000) : ['created', 'updated', 'completed', 'reopened'].includes(String(value.kind)) && validDraft(value.task));
}
export function restoreFollowUps(raw: string | null): FollowUpStore {
  if (!raw || raw.length > MAX_FOLLOW_UP_CHARACTERS) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== FOLLOW_UP_VERSION || !isObject(parsed.accounts)) return {};
    const result: FollowUpStore = {};
    for (const [id, value] of Object.entries(parsed.accounts).slice(0, 500)) {
      if (!validAccountId(id) || !isObject(value) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 || !Array.isArray(value.activity)) continue;
      const task = validTask(value.followUp) ? value.followUp : undefined;
      if (value.followUp !== undefined && !task) continue;
      result[id] = {
        revision: Number(value.revision),
        ...(task ? { followUp: { ...copyDraft(task), id: task.id, status: task.status, createdAt: task.createdAt, updatedAt: task.updatedAt, ...(task.completedAt ? { completedAt: task.completedAt } : {}) } } : {}),
        activity: value.activity.filter(validActivity).slice(-MAX_ACCOUNT_ACTIVITY).map(event => ({ id: event.id, at: event.at, kind: event.kind, ...(event.task ? { task: copyDraft(event.task) } : {}), ...(event.note ? { note: event.note } : {}) })),
      };
    }
    return result;
  } catch { return {}; }
}

/** Only account work changes here. Case evidence and review records are separate. */
export function applyFollowUpAction(store: FollowUpStore, accountId: string, expectedRevision: number, action: FollowUpAction, at: string, eventId: string): FollowUpStore {
  if (!validAccountId(accountId) || !timestamp(at) || !text(eventId, 100)) throw new Error('This follow-up could not be saved. Reload and try again.');
  const current = store[accountId] ?? { revision: 0, activity: [] };
  if (current.revision !== expectedRevision) throw new Error('This account changed in another view. Cancel and reopen the form to use the latest version.');
  let followUp = current.followUp;
  let event: AccountActivity;
  if (action.kind === 'save') {
    if (!validDraft(action.draft)) throw new Error('Enter a task, an owner, and a valid due date.');
    const draft = copyDraft(action.draft);
    const editing = followUp?.status === 'open';
    if (editing && JSON.stringify(copyDraft(followUp!)) === JSON.stringify(draft)) return store;
    followUp = { ...draft, id: editing ? followUp!.id : eventId, status: 'open', createdAt: editing ? followUp!.createdAt : at, updatedAt: at };
    event = { id: eventId, at, kind: editing ? 'updated' : 'created', task: draft };
  } else if (action.kind === 'note') {
    if (!text(action.note, 2000)) throw new Error('Write a note before saving.');
    event = { id: eventId, at, kind: 'note', note: action.note.trim() };
  } else {
    if (!followUp || (action.kind === 'complete' ? followUp.status !== 'open' : followUp.status !== 'completed')) throw new Error('This follow-up has already changed. Refresh the account before continuing.');
    const { completedAt: _completedAt, ...task } = followUp;
    followUp = { ...task, status: action.kind === 'complete' ? 'completed' : 'open', updatedAt: at, ...(action.kind === 'complete' ? { completedAt: at } : {}) };
    event = { id: eventId, at, kind: action.kind === 'complete' ? 'completed' : 'reopened', task: copyDraft(followUp) };
  }
  return { ...store, [accountId]: { revision: current.revision + 1, followUp, activity: [...current.activity, event].slice(-MAX_ACCOUNT_ACTIVITY) } };
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function tomorrowKey(date: Date): string {
  const next = new Date(date); next.setDate(next.getDate() + 1); return localDateKey(next);
}
export function dueInfo(dueDate: string, today: string) {
  const days = Math.round((Date.parse(`${dueDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  return { days, tone: days < 0 ? 'overdue' : days === 0 ? 'today' : 'upcoming',
    label: days < 0 ? `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue` : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...(dueDate.slice(0,4) !== today.slice(0,4) ? { year: 'numeric' as const } : {}), timeZone: 'UTC' }).format(new Date(`${dueDate}T12:00:00Z`))}` };
}
export function openFollowUps(store: FollowUpStore, accountIds: string[]) {
  const ids = new Set(accountIds);
  return Object.entries(store).flatMap(([accountId, work]) => ids.has(accountId) && work.followUp?.status === 'open' ? [{ accountId, followUp: work.followUp }] : [])
    .sort((a,b) => a.followUp.dueDate.localeCompare(b.followUp.dueDate) || a.followUp.createdAt.localeCompare(b.followUp.createdAt) || a.accountId.localeCompare(b.accountId));
}
