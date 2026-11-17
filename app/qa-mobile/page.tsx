import { notFound } from 'next/navigation';

// Temporary preview fixture. Removed before the production merge.
export default function Page() {
  if (process.env.VERCEL_ENV !== 'preview') notFound();
  return <main style={{ padding: 16 }}><h1>Mobile layout check · 390px</h1><iframe title="Mobile Lighthouse" src="/accounts?account=partner-OPS-101" style={{ display: 'block', width: 390, height: 844, maxWidth: '100%', border: '1px solid #888', marginTop: 16 }} /></main>;
}
