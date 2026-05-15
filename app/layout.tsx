import './globals.css';

export const metadata = {
  title: 'Lighthouse',
  description: 'AI Account Intelligence',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
