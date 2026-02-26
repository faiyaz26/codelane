'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import agentTerminalImg from '@/public/screenshots/agent_terminal.webp';
import { Terminal, Github, Download, ChevronDown, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Hero() {
  const [platform, setPlatform] = useState({
    os: 'macos',
    label: 'Download for macOS',
    link: 'https://github.com/faiyaz26/codelane/releases/latest',
    silicon: '',
    intel: '',
  });

  useEffect(() => {
    async function detectPlatform() {
      const ua = window.navigator.userAgent.toLowerCase();
      let os = 'macos';

      if (ua.includes('win')) os = 'windows';
      else if (ua.includes('linux')) os = 'linux';

      try {
        const response = await fetch('https://api.github.com/repos/faiyaz26/codelane/releases/latest');
        const data = await response.json();
        const assets = data.assets;

        const siliconAsset = assets.find((a: any) => a.name.endsWith('aarch64.dmg'));
        const intelAsset = assets.find((a: any) => a.name.endsWith('x64.dmg'));
        const winAsset = assets.find((a: any) => a.name.endsWith('x64-setup.exe'));
        const linuxAsset = assets.find((a: any) => a.name.endsWith('amd64.AppImage'));

        if (os === 'macos') {
          setPlatform({
            os: 'macos',
            label: 'Download for macOS',
            link: siliconAsset?.browser_download_url || intelAsset?.browser_download_url || 'https://github.com/faiyaz26/codelane/releases/latest',
            silicon: siliconAsset?.browser_download_url || '',
            intel: intelAsset?.browser_download_url || '',
          });
        } else if (os === 'windows') {
          setPlatform({
            os: 'windows',
            label: 'Download for Windows',
            link: winAsset?.browser_download_url || 'https://github.com/faiyaz26/codelane/releases/latest',
            silicon: '',
            intel: '',
          });
        } else if (os === 'linux') {
          setPlatform({
            os: 'linux',
            label: 'Download for Linux',
            link: linuxAsset?.browser_download_url || 'https://github.com/faiyaz26/codelane/releases/latest',
            silicon: '',
            intel: '',
          });
        }
      } catch (e) {
        console.error('Failed to fetch latest release:', e);
      }
    }

    detectPlatform();
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#18181B]">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#60A5FA] rounded-full filter blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#34D399] rounded-full filter blur-[128px]" />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(to_right,#374151_1px,transparent_1px),linear-gradient(to_bottom,#374151_1px,transparent_1px)] bg-[size:64px_64px] opacity-10" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-[#374151] bg-[#1F2937]/50 backdrop-blur-sm mb-8">
          <Terminal className="w-4 h-4 text-[#60A5FA]" />
          <span className="font-mono text-sm text-gray-400">
            Built with Tauri + SolidJS
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
          Stop Waiting for Your Agent.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#60A5FA] to-[#34D399]">
            Build in Parallel.
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-4xl mx-auto leading-relaxed">
          Codelane is the agentic cockpit for modern engineers. Orchestrate
          multiple AI agents across isolated project lanes with integrated
          human-in-the-loop code review.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          {platform.os === 'macos' ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="lg"
                  className="bg-[#60A5FA] hover:bg-[#60A5FA]/90 text-white px-8 h-12 text-lg font-medium"
                >
                  <Download className="w-5 h-5 mr-2" />
                  {platform.label}
                  <ChevronDown className="ml-2 w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1F2937] border-[#374151] text-white">
                <DropdownMenuItem asChild className="hover:bg-[#374151] cursor-pointer">
                  <a href={platform.silicon}>Apple Silicon (M1/M2/M3)</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="hover:bg-[#374151] cursor-pointer">
                  <a href={platform.intel}>Intel Mac</a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <a href={platform.link} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="bg-[#60A5FA] hover:bg-[#60A5FA]/90 text-white px-8 h-12 text-lg font-medium"
              >
                <Download className="w-5 h-5 mr-2" />
                {platform.label}
              </Button>
            </a>
          )}
          <a href="https://github.com/faiyaz26/codelane" target="_blank" rel="noopener noreferrer">
            <Button
              size="lg"
              variant="outline"
              className="border-[#374151] bg-transparent hover:bg-[#1F2937] text-white px-8 h-12 text-lg font-medium"
            >
              <Github className="w-5 h-5 mr-2" />
              View on GitHub
            </Button>
          </a>
        </div>

        <p className="text-sm text-gray-500 mb-16">
          Also available for{' '}
          <a href="https://github.com/faiyaz26/codelane/releases/latest" className="text-[#60A5FA] hover:underline">
            Windows and Linux
          </a>
        </p>

        <div className="mt-16 mb-8 relative rounded-xl border border-[#374151] bg-[#1F2937]/50 p-2 backdrop-blur-sm shadow-2xl overflow-hidden mx-auto max-w-5xl">
          <Image 
            src={agentTerminalImg}
            alt="Codelane Agent Terminal Interface" 
            placeholder="blur"
            className="rounded-lg w-full h-auto object-cover border border-[#374151]/50"
          />
        </div>

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-gray-600" />
        </div>
      </div>
    </section>
  );
}
