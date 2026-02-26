import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  title: 'Codelane - The Agentic Cockpit for Modern Engineers',
  description: 'Stop waiting for your agent. Build in parallel. Orchestrate multiple AI agents across isolated project lanes with integrated human-in-the-loop code review.',
  metadataBase: new URL('https://codelane.app'),
  openGraph: {
    title: 'Codelane - The Agentic Cockpit for Modern Engineers',
    description: 'Stop waiting for your agent. Build in parallel. Orchestrate multiple AI agents across isolated project lanes with integrated human-in-the-loop code review.',
    url: 'https://codelane.app',
    siteName: 'Codelane',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Codelane - The Agentic Cockpit for Modern Engineers',
    description: 'Stop waiting for your agent. Build in parallel. Orchestrate multiple AI agents across isolated project lanes with integrated human-in-the-loop code review.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${inter.className}`}>{children}</body>
    </html>
  );
}
