'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import agentTerminalImg from '@/public/screenshots/agent_terminal.png';
import { Terminal, Github, Download, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Hero() {
  const [displayedText, setDisplayedText] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);
  const fullText = '$ codelane --parallel --lanes=3 --agent=claude';

  useEffect(() => {
    let index = 0;
    const typingInterval = setInterval(() => {
      if (index < fullText.length) {
        setDisplayedText(fullText.slice(0, index + 1));
        index++;
      } else {
        clearInterval(typingInterval);
      }
    }, 80);

    return () => clearInterval(typingInterval);
  }, []);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 530);

    return () => clearInterval(cursorInterval);
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
            Built with Rust + Tauri
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
          <a href="https://github.com/faiyaz26/codelane/releases/latest" target="_blank" rel="noopener noreferrer">
            <Button
              size="lg"
              className="bg-[#60A5FA] hover:bg-[#60A5FA]/90 text-white px-8 h-12 text-lg font-medium"
            >
              <Download className="w-5 h-5 mr-2" />
              Download for macOS
            </Button>
          </a>
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

        <div className="inline-block px-6 py-4 rounded-md border border-[#374151] bg-[#1F2937]/80 backdrop-blur-sm">
          <div className="font-mono text-left text-sm md:text-base">
            <span className="text-[#34D399]">→</span>
            <span className="text-gray-300 ml-2">
              {displayedText}
              <span
                className={`inline-block w-2 h-5 ml-1 bg-[#60A5FA] ${
                  cursorVisible ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </span>
          </div>
        </div>

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
