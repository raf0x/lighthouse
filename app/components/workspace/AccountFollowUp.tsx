'use client';
import { useRef, useState } from 'react';
import { Check, PencilLine, Plus, RotateCcw } from 'lucide-react';
import { useFollowUps } from '../FollowUpProvider';
import { dueInfo, tomorrowKey, type FollowUpDraft } from '../../lib/follow-ups';
import useLocalToday from './useLocalToday';
import styles from './workspace.module.css';

const eventLabels = { created: 'Follow-up added', updated: 'Follow-up updated', completed: 'Follow-up completed', reopened: 'Follow-up reopened', note: 'Note added' };
const dateTime = (at: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(at));
export default function AccountFollowUp({ accountId, suggestedOwner }: { accountId: string; suggestedOwner: string }) {
  const { accountWork, loaded, act } = useFollowUps();
  const work = accountWork[accountId], task = work?.followUp;
  const today = useLocalToday();
  const [editing, setEditing] = useState(false), [editRevision, setEditRevision] = useState(0);
  const [draft, setDraft] = useState<FollowUpDraft>({ title: '', owner: '', dueDate: '' });
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [note, setNote] = useState('');
  const actionButton = useRef<HTMLButtonElement>(null);
  const due = task && today ? dueInfo(task.dueDate, today) : undefined;
  function begin() {
    setDraft(task?.status === 'open' ? { title: task.title, owner: task.owner, dueDate: task.dueDate } : { title: '', owner: task?.owner || suggestedOwner, dueDate: tomorrowKey(new Date()) });
    setEditRevision(work?.revision ?? 0); setError(''); setNotice(''); setEditing(true);
  }
  function close() { setEditing(false); setError(''); requestAnimationFrame(() => actionButton.current?.focus()); }
  function save(event: React.FormEvent) {
    event.preventDefault();
    const failure = act(accountId, editRevision, { kind: 'save', draft });
    if (failure) { setError(failure); return; }
    close(); setNotice('Follow-up saved. It is now listed on Today.');
  }
  function changeStatus(kind: 'complete' | 'reopen') {
    const failure = act(accountId, work?.revision ?? 0, { kind });
    setError(failure || '');
    if (!failure) setNotice(kind === 'complete' ? 'Follow-up completed. Case evidence and approvals are unchanged.' : 'Follow-up reopened and returned to Today.');
  }
  function saveNote(event: React.FormEvent) {
    event.preventDefault();
    const failure = act(accountId, work?.revision ?? 0, { kind: 'note', note });
    setError(failure || '');
    if (!failure) { setNote(''); setNotice('Note added to account activity.'); }
  }
  if (!loaded) return null;
  return <section id="follow-up" className={`${styles.card} ${styles.followUpCard}`} aria-labelledby="follow-up-title">
    <div className={styles.sectionHeading}><h3 id="follow-up-title">Next follow-up</h3>{task?.status === 'open' && due && <span className={styles.dueBadge} data-tone={due.tone}>{due.label}</span>}{task?.status === 'completed' && <span className={styles.status} data-tone="good"><Check size={13} /> Completed</span>}</div>
    {editing ? <form className={styles.followUpForm} onSubmit={save}>
      <label>What needs to happen?<input autoFocus required maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Confirm cleared payment" /></label>
      <div className={styles.followUpFields}><label>Owner<input required maxLength={100} value={draft.owner} onChange={e => setDraft({ ...draft, owner: e.target.value })} placeholder="Person or team" /></label><label>Due date<input type="date" required min="2000-01-01" max="2100-12-31" value={draft.dueDate} onChange={e => setDraft({ ...draft, dueDate: e.target.value })} /></label></div>
      <p className={styles.muted}>Uses your local calendar. This assigns a label; no notification is sent.</p>
      <div className={styles.followUpActions}><button type="submit" className={styles.primary}>Save follow-up</button><button type="button" className={styles.secondary} onClick={close}>Cancel</button></div>
    </form> : task ? <>
      <p className={styles.followUpTitle}>{task.title}</p>
      <p className={styles.followUpOwner}>Owner: <strong>{task.owner}</strong>{task.status === 'completed' && task.completedAt && <> · Completed {dateTime(task.completedAt)}</>}</p>
      <div className={styles.followUpActions}>{task.status === 'open' ? <><button ref={actionButton} className={styles.primary} onClick={() => changeStatus('complete')}><Check size={16} /> Mark complete</button><button className={styles.secondary} onClick={begin}><PencilLine size={15} /> Edit</button></> : <><button ref={actionButton} className={styles.secondary} onClick={begin}><Plus size={15} /> Add next follow-up</button><button className={styles.quietButton} onClick={() => changeStatus('reopen')}><RotateCcw size={14} /> Reopen</button></>}</div>
    </> : <div className={styles.followUpEmpty}><p>Set one next action, with an owner and a due date.</p><button ref={actionButton} className={styles.secondary} onClick={begin}><Plus size={15} /> Add follow-up</button></div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <p role="status" className={styles.followUpNotice}>{notice}</p>
    <details className={styles.accountActivity}>
      <summary>Activity & notes{work?.activity.length ? ` · ${work.activity.length}` : ''}</summary>
      <form className={styles.noteForm} onSubmit={saveNote}><label>Add a note<textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={2000} required placeholder="What happened, or what is needed next?" /></label><button className={styles.secondary} type="submit" disabled={!note.trim()}>Save note</button></form>
      {work?.activity.length ? <ol className={styles.accountActivityList}>{[...work.activity].reverse().map(event => <li key={event.id}><strong>{eventLabels[event.kind]}</strong><time dateTime={event.at}>{dateTime(event.at)}</time>{event.task && <p>{event.task.title}<small>{event.task.owner} · Due {event.task.dueDate}</small></p>}{event.note && <p className={styles.activityNote}>{event.note}</p>}</li>)}</ol> : <p className={styles.muted}>Your follow-ups and notes will appear here.</p>}
      <p className={styles.cardNote}>Latest 50 updates on this device. Completing a follow-up does not change case evidence or approve release.</p>
    </details>
  </section>;
}
