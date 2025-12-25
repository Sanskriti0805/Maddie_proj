import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reddit Mastermind - Content Planning Engine',
  description: 'Production-quality Reddit content planning system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50">{children}</body>
    </html>
  );
}

