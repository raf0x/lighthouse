import { operationCases, type OperationCase } from './operations';

export const demoStages = ['blocked', 'invoice_corrected', 'payment_cleared'] as const;
export type DemoStage = typeof demoStages[number];

/** Local what-if scenarios. Never mutates the fixture, workspace, or recorded AI run. */
export function demoCase(stage: DemoStage): OperationCase {
  const original = operationCases[0];
  return {
    ...original,
    invoice: { ...original.invoice, entity: stage === 'blocked' ? original.invoice.entity : original.approvedEntity },
    payment: { ...original.payment, status: stage === 'payment_cleared' ? 'cleared' : original.payment.status },
    crmPaymentStatus: stage === 'payment_cleared' ? 'cleared' : original.crmPaymentStatus,
  };
}
