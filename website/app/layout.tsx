import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  title: 'Codelane - The Agentic Cockpit for Modern Engineers',
  description: 'Stop waiting for your agent. Build in parallel. Orchestrate multiple AI agents across isolated project lanes with integrated human-in-the-loop code review.',
  keywords: ['AI agents', 'Claude Code', 'Cursor', 'Aider', 'Git Worktrees', 'Code Review', 'Software Engineering', 'Developer Tools', 'Tauri', 'Rust'],
  metadataBase: new URL('https://codelane.app'),
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Codelane',
    operatingSystem: 'Windows, macOS, Linux',
    applicationCategory: 'DeveloperApplication',
    description: 'An Agentic Development Environment for orchestrating multiple AI agents in parallel.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    softwareHelp: 'https://github.com/faiyaz26/codelane',
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${inter.className}`}>{children}</body>
    </html>
  );
}
