import { Terminal, Sparkles, Code2, Cpu } from 'lucide-react';
import Image from 'next/image';
import agentConfigImg from '@/public/screenshots/agent_configuration.webp';

export function AgentIntegration() {
  const agents = [
    {
      name: 'Claude Code',
      icon: Sparkles,
      color: 'text-[#60A5FA]',
      bgColor: 'bg-[#60A5FA]/10',
      borderColor: 'border-[#60A5FA]/20',
    },
    {
      name: 'Cursor',
      icon: Sparkles,
      color: 'text-[#34D399]',
      bgColor: 'bg-[#34D399]/10',
      borderColor: 'border-[#34D399]/20',
    },
    {
      name: 'Aider',
      icon: Code2,
      color: 'text-[#F59E0B]',
      bgColor: 'bg-[#F59E0B]/10',
      borderColor: 'border-[#F59E0B]/20',
    },
    {
      name: 'Custom',
      icon: Cpu,
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
            Universal Agent Integration
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Your Agents, Native. Codelane doesn't lock you into a model. It
            provides a native terminal environment optimized for the CLI agents
            you already love.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
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

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="p-8 rounded-md border border-[#374151] bg-[#1F2937]/50 backdrop-blur-sm">
            <Terminal className="w-10 h-10 text-[#60A5FA] mb-4" />
            <h3 className="text-2xl font-semibold text-white mb-4">
              CLI-First Design
            </h3>
            <p className="text-gray-400 leading-relaxed mb-4">
              Codelane wraps your favorite CLI agents in an optimized terminal
              environment. No proprietary APIs, no vendor lock-in. Just a better
              shell for your agentic workflow.
            </p>
            <div className="font-mono text-sm text-gray-500 bg-[#18181B] p-3 rounded border border-[#374151]">
              $ codelane exec --agent claude "implement auth"
            </div>
          </div>

          <div className="p-8 rounded-md border border-[#374151] bg-[#1F2937]/50 backdrop-blur-sm">
            <Sparkles className="w-10 h-10 text-[#34D399] mb-4" />
            <h3 className="text-2xl font-semibold text-white mb-4">
              Agent Agnostic
            </h3>
            <p className="text-gray-400 leading-relaxed mb-4">
              Switch between Claude Code, Cursor, Aider, or any custom agent without changing
              your workflow. Use the best agent for each task, not the one your
              IDE dictates.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Claude Code', 'Cursor', 'Aider', 'Custom'].map((model) => (
                <span
                  key={model}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-[#18181B] text-gray-400 border border-[#374151]"
                >
                  {model}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 rounded-md border border-[#374151] bg-gradient-to-br from-[#60A5FA]/10 to-[#34D399]/10 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="w-2 h-2 rounded-full bg-[#60A5FA] mt-2 flex-shrink-0" />
            <div>
              <h4 className="text-lg font-semibold text-white mb-2">
                Bring Your Own Agent
              </h4>
              <p className="text-gray-300 leading-relaxed">
                Building a custom agent? Codelane's plugin system lets you
                integrate any tool that speaks to a terminal. If it runs in a
                shell, it runs in Codelane.
              </p>
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
