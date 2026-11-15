import type { Metadata } from 'next';
import OperationsWorkspace from './OperationsWorkspace';

export const metadata: Metadata = {
  title: 'Partner Operations · Lighthouse',
  description: 'Inspect ticket-order evidence, resolve exceptions, and review the next action. An interactive prototype using synthetic cases.',
};

export default function OperationsPage() {
  return <OperationsWorkspace />;
}
