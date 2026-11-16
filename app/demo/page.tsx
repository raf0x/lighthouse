import type { Metadata } from 'next';
import { restoreAgentRun } from '../lib/operations-agent';
import { demoCase } from '../lib/operations-demo';
import recording from '../../docs/evals/operations-agent-browser-fix-ui.json';
import DemoExperience from './DemoExperience';

export const metadata: Metadata = {
  title: 'A blocked order, investigated · Lighthouse',
  description: 'Inspect a saved Claude investigation, follow its evidence, and resolve a fictional ticketing case. An interactive AI operations portfolio by Rafael Lemor. No AI credits required.',
  openGraph: { title: 'Lighthouse · Evidence before action', description: 'One saved AI investigation. Six source records. A decision you can inspect.' },
};

export default function DemoPage() {
  // Fail the build if the published recording no longer passes the current checks.
  const checked = restoreAgentRun(recording, demoCase('blocked'));
  if (!checked) throw new Error('The saved Lighthouse investigation needs review before publication.');
  // Pass only the recorded fields used by the public viewer.
  const { version, runId, caseId, inputSignature, model, completedAt, elapsedMs, report, trace, usage, validationAttempts, firstSubmissionPassed } = checked;
  return <DemoExperience recording={{ version, runId, caseId, inputSignature, model, completedAt, elapsedMs, report, trace, usage, validationAttempts, firstSubmissionPassed }} />;
}
