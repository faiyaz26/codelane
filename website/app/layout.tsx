import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  title: 'Codelane - The Agentic Cockpit for Modern Engineers',
  description: 'Orchestrate multiple AI agents in parallel with isolated project lanes and human-in-the-loop code review. Stop waiting, start building.',
  keywords: [
    'AI agents', 
    'Claude Code', 
    'Cursor', 
    'Aider', 
    'Git Worktrees', 
    'Code Review', 
    'Software Engineering', 
    'Developer Tools', 
    'Tauri', 
    'Rust',
    'LLM',
    'Agentic Workflow',
    'Parallel Development',
    'DevTools',
    'Open Source',
    'Codelane'
  ],
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
    description: 'Orchestrate multiple AI agents in parallel with isolated project lanes and human-in-the-loop code review.',
    url: 'https://codelane.app',
    siteName: 'Codelane',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/screenshots/agent_terminal.webp',
        width: 1200,
        height: 630,
        alt: 'Codelane Agent Terminal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Codelane - The Agentic Cockpit for Modern Engineers',
    description: 'Orchestrate multiple AI agents in parallel with isolated project lanes and human-in-the-loop code review.',
    images: ['/screenshots/agent_terminal.webp'],
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
    applicationSubCategory: 'Integrated Development Environment (IDE), AI Agent Orchestrator',
    description: 'An Agentic Development Environment for orchestrating multiple AI agents in parallel using Git Worktrees.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    softwareHelp: 'https://github.com/faiyaz26/codelane',
    screenshot: 'https://codelane.app/screenshots/agent_terminal.webp',
    featureList: [
      'Isolated Project Lanes using Git Worktrees',
      'Parallel AI Agent Orchestration',
      'Integrated Human-in-the-loop Code Review',
      'Markdown-first Interface',
      'Native Desktop Performance (Tauri + Rust)',
    ],
    author: {
      '@type': 'Person',
      name: 'Ahmad Faiyaz',
      url: 'https://github.com/faiyaz26',
    },
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
