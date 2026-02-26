import { Terminal, Sparkles } from 'lucide-react';
import Image from 'next/image';
import agentConfigImg from '@/public/screenshots/agent_configuration.webp';
import { ClaudeIcon, GeminiIcon, OpenAIIcon, OpenCodeIcon } from '@/components/icons/AgentIcons';

export function AgentIntegration() {
  const agents = [
    {
      name: 'Claude',
      icon: ClaudeIcon,
      color: 'text-[#60A5FA]',
      bgColor: 'bg-[#60A5FA]/10',
      borderColor: 'border-[#60A5FA]/20',
    },
    {
      name: 'Gemini',
      icon: GeminiIcon,
      color: 'text-[#34D399]',
      bgColor: 'bg-[#34D399]/10',
      borderColor: 'border-[#34D399]/20',
    },
    {
      name: 'Codex',
      icon: OpenAIIcon,
      color: 'text-[#F59E0B]',
      bgColor: 'bg-[#F59E0B]/10',
      borderColor: 'border-[#F59E0B]/20',
    },
    {
      name: 'OpenCode',
      icon: OpenCodeIcon,
      color: 'text-[#8B5CF6]',
      bgColor: 'bg-[#8B5CF6]/10',
      borderColor: 'border-[#8B5CF6]/20',
    },
  ];

  return (
    <section className="relative py-24 bg-[#18181B]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Native Support for Any CLI Agent
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Run your preferred terminal-based agents in an optimized environment. 
            Codelane treats Markdown as a first-class citizen, allowing agents to 
            render complex plans and code with exceptional clarity.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {agents.map((agent, index) => {
            const Icon = agent.icon;
            return (
              <div
                key={index}
                className={`group p-6 rounded-md border ${agent.borderColor} ${agent.bgColor} backdrop-blur-sm hover:scale-105 transition-all duration-300`}
              >
                <div className="flex flex-col items-center text-center">
                  <div className={`p-4 rounded-full ${agent.bgColor} mb-4`}>
                    <Icon className={`w-8 h-8 ${agent.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    {agent.name}
                  </h3>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-8 rounded-md border border-[#374151] bg-[#1F2937]/50 backdrop-blur-sm mb-12">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <Terminal className="w-8 h-8 text-[#60A5FA]" />
                <h3 className="text-2xl font-semibold text-white">
                  The Ultimate Agent Terminal
                </h3>
              </div>
              <p className="text-gray-400 leading-relaxed mb-6">
                Codelane isn't just another shell. It's a specialized cockpit for 
                agentic workflows. Whether it's Claude Code, Aider, or your own 
                custom script, Codelane provides the low-latency, ANSI-compliant 
                environment they need to thrive.
              </p>
              <div className="flex flex-wrap gap-3">
                {['Full ANSI Support', 'Markdown Rendering', 'Non-Blocking I/O', 'Agent Plugins'].map((feature) => (
                  <span
                    key={feature}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-[#18181B] text-gray-400 border border-[#374151]"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-1 w-full font-mono text-sm text-gray-400 bg-[#18181B] p-6 rounded border border-[#374151] shadow-inner">
              <div className="text-[#34D399] mb-2"># Agent Plan</div>
              <div className="mb-4">1. Analyze dependency graph</div>
              <div className="mb-4">2. Implement new auth lane</div>
              <div className="text-[#60A5FA]">```typescript</div>
              <div className="pl-4 border-l-2 border-[#374151] my-2">
                export const lane = 'auth';
              </div>
              <div className="text-[#60A5FA]">```</div>
            </div>
          </div>
        </div>

        <div className="mt-16 rounded-xl border border-[#374151] bg-[#1F2937]/50 p-2 backdrop-blur-sm shadow-2xl overflow-hidden max-w-5xl mx-auto">
          <Image 
            src={agentConfigImg}
            alt="Codelane Agent Configuration Interface" 
            placeholder="blur"
            className="rounded-lg w-full h-auto object-cover border border-[#374151]/50"
          />
        </div>
      </div>
    </section>
  );
}
