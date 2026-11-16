import { canonicalImportedCase, MAX_IMPORTED_CASES, normalizedTimestamp, operationCases, type AuditEntry, type CaseWorkspace, type Currency, type OperationCase, type PaymentState } from './operations';

export const IMPORT_MAX_BYTES = 65_536;
export const CSV_COLUMNS = ['partner', 'approved_entity', 'order_id', 'order_amount', 'order_currency', 'tickets', 'scenario_clock', 'allocation_deadline', 'invoice_id', 'invoice_entity', 'invoice_amount', 'invoice_currency', 'other_active_invoice_id', 'payment_status', 'payment_amount', 'payment_currency', 'payment_reference', 'crm_payment_status'] as const;
const templateValues = ['Seabrook Events', 'Seabrook Events US, Inc.', 'ORD-5001', '12500.00', 'USD', '50', '2026-11-15T09:00:00-05:00', '2026-11-16T05:00:00-05:00', 'INV-9001', 'Seabrook Events Canada, Ltd.', '12500.00', 'USD', '', 'pending', '12500.00', 'USD', 'PAY-7001', 'pending'];
const csvCell = (s: string) => /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
export const CSV_TEMPLATE = CSV_COLUMNS.join(',') + '\r\n' + templateValues.map(csvCell).join(',') + '\r\n';
export type CaseImportResult = { input: OperationCase; errors?: never } | { input?: never; errors: string[] };

/** Bounded comma-separated CSV; quoted commas, escaped quotes, BOM and CRLF supported. */
function readCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
  const pushCell = () => { row.push(cell); cell = ''; closed = false; if (row.length > CSV_COLUMNS.length) throw new Error('Too many columns. Use the downloaded template and quote values containing commas.'); };
  const pushRow = () => { pushCell(); if (row.some(v => v.trim())) rows.push(row); else if (rows.length < 2) throw new Error('Remove blank rows before or between the header and case row.'); row = []; if (rows.length > 2) throw new Error('Import one case per file: one header row and one data row.'); };
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"') { if (source[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += c;
    } else if (c === ',') pushCell();
    else if (c === '\r' || c === '\n') { if (c === '\r' && source[i + 1] === '\n') i++; pushRow(); }
    else if (closed) { if (c !== ' ' && c !== '\t') throw new Error('Unexpected text after a closing quote. Check the CSV quoting.'); }
    else if (c === '"') { if (cell.length) throw new Error('Quotes must surround the whole CSV value.'); quoted = true; }
    else cell += c;
  }
  if (quoted) throw new Error('A quoted CSV value was not closed.');
  if (cell || row.length || closed) pushRow();
  return rows;
}

export function parseCaseCsv(text: string, origin: { id: string; fileName: string; at: string }): CaseImportResult {
  if (text.length > IMPORT_MAX_BYTES || new TextEncoder().encode(text).byteLength > IMPORT_MAX_BYTES) return { errors: ['Use a CSV file no larger than 64 KB.'] };
  let rows: string[][];
  try { rows = readCsv(text); } catch (err) { return { errors: [err instanceof Error ? err.message : 'The CSV could not be read.'] }; }
  if (rows.length !== 2) return { errors: ['Include the template header and exactly one case row.'] };
  const headers = rows[0].map(h => h.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) return { errors: ['The header contains duplicate column names.'] };
  const missing = CSV_COLUMNS.filter(h => !headers.includes(h)), unknown = headers.filter(h => !(CSV_COLUMNS as readonly string[]).includes(h));
  if (missing.length || unknown.length) return { errors: [...(missing.length ? [`Missing columns: ${missing.join(', ')}.`] : []), ...(unknown.length ? ['Unrecognized columns. Use only the columns in the downloaded template.'] : [])] };
  if (rows[1].length !== headers.length) return { errors: ['The case row has a different number of values than the header. Quote names containing commas.'] };
  const values = Object.fromEntries(headers.map((h, i) => [h, rows[1][i].trim()]));
  const errors: string[] = [];
  const field = (name: string, required = true, max = 200) => {
    const value = values[name];
    if ((required && !value) || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) errors.push(`${name}: ${required ? 'provide a value' : 'use a value or leave blank'} of up to ${max} characters, on one line.`);
    return value;
  };
  const identifier = (name: string) => { const value = field(name, true, 80); if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/.test(value)) errors.push(`${name}: use letters, numbers, dots, hyphens, underscores or slashes.`); return value; };
  const amount = (name: string, zero = false) => {
    const value = values[name];
    if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) { errors.push(`${name}: use a decimal amount such as 12500.00, without currency symbols or thousands separators.`); return NaN; }
    const [whole, fraction = ''] = value.split('.'); const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (cents > 1_000_000_000 || (!zero && cents === 0)) errors.push(`${name}: enter ${zero ? '0' : '0.01'} to 10000000.00.`);
    return cents;
  };
  const currency = (name: string) => { const value = values[name].toUpperCase(); if (!['USD', 'CAD', 'MXN'].includes(value)) errors.push(`${name}: use USD, CAD or MXN.`); return value as Currency; };
  const status = (name: string) => { const value = values[name].toLowerCase(); if (!['missing', 'pending', 'cleared'].includes(value)) errors.push(`${name}: use missing, pending or cleared. A blank status is not interpreted as cleared.`); return value as PaymentState; };
  const timestamp = (name: string) => { const value = normalizedTimestamp(values[name]); if (!value) errors.push(`${name}: use a valid ISO date with time zone, such as 2026-11-15T09:00:00-05:00.`); return value ?? ''; };
  const asOf = timestamp('scenario_clock'), deadline = timestamp('allocation_deadline');
  if (asOf && deadline) { const hours = (Date.parse(deadline) - Date.parse(asOf)) / 3_600_000; if (hours < -168 || hours > 720) errors.push('allocation_deadline: use a date from 7 days before to 30 days after scenario_clock.'); }
  const tickets = Number(values.tickets);
  if (!/^\d+$/.test(values.tickets) || !Number.isSafeInteger(tickets) || tickets < 1 || tickets > 1_000_000) errors.push('tickets: enter a whole number from 1 to 1000000.');
  const input = { id: origin.id, account: field('partner'), approvedEntity: field('approved_entity', false), asOf, deadline,
    orderId: identifier('order_id'), orderAmountCents: amount('order_amount'), orderCurrency: currency('order_currency'), tickets,
    invoice: { id: identifier('invoice_id'), entity: field('invoice_entity', false), amountCents: amount('invoice_amount'), currency: currency('invoice_currency') },
    duplicateInvoiceId: field('other_active_invoice_id', false), payment: { status: status('payment_status'), amountCents: amount('payment_amount', true), currency: currency('payment_currency'), reference: field('payment_reference', false) }, crmPaymentStatus: status('crm_payment_status'),
    imported: { format: 'case-csv-v1', fileName: origin.fileName, at: origin.at, row: 2 } };
  if (errors.length) return { errors };
  const canonical = canonicalImportedCase(input);
  return canonical ? { input: canonical } : { errors: ['The file details are invalid. Use a .csv filename of up to 200 characters and try again.'] };
}

export function importProblem(input: OperationCase, workspaces: Record<string, CaseWorkspace>): string | null {
  const imported = Object.values(workspaces).filter(w => w.importedOriginal);
  if (imported.length >= MAX_IMPORTED_CASES) return `This browser already has ${MAX_IMPORTED_CASES} imported cases. Remove an imported case before adding another.`;
  if ([...operationCases, ...imported.map(w => w.input)].some(c => c.id === input.id || c.orderId.toLowerCase() === input.orderId.toLowerCase())) return `Order ${input.orderId} is already in the queue. Open its existing case to review or edit it.`;
  return null;
}

export function addImportedCase(workspaces: Record<string, CaseWorkspace>, input: OperationCase, entry: AuditEntry): Record<string, CaseWorkspace> {
  const canonical = canonicalImportedCase(input);
  if (!canonical) throw new Error('The imported records are invalid.');
  const problem = importProblem(canonical, workspaces); if (problem) throw new Error(problem);
  return { ...workspaces, [canonical.id]: { input: canonical, importedOriginal: structuredClone(canonical), analyzed: false, history: [entry] } };
}
