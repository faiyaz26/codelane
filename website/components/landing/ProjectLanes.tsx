import { GitBranch, Bot, Eye, Bug } from 'lucide-react';
import Image from 'next/image';
import gitManagerImg from '@/public/screenshots/git_manager.webp';

export function ProjectLanes() {
  const lanes = [
    {
      name: 'Lane A',
      icon: Bot,
      title: 'Feature Development',
      status: 'Claude: implementing-auth',
      color: 'border-[#60A5FA]',
      glow: 'from-[#60A5FA]/20',
      badge: 'Claude Code',
      badgeColor: 'bg-[#60A5FA]/20 text-[#60A5FA]',
    },
    {
      name: 'Lane B',
      icon: Eye,
      title: 'PR Review',
      status: 'Reviewing PR #42',
      color: 'border-[#34D399]',
      glow: 'from-[#34D399]/20',
      badge: 'Human Review',
      badgeColor: 'bg-[#34D399]/20 text-[#34D399]',
    },
    {
      name: 'Lane C',
      icon: Bug,
      title: 'Fix Tests',
      status: 'Claude: fixing-e2e-tests',
      color: 'border-[#F59E0B]',
      glow: 'from-[#F59E0B]/20',
      badge: 'Claude Code',
      badgeColor: 'bg-[#F59E0B]/20 text-[#F59E0B]',
    },
  ];

  return (
    <section className="relative py-24 bg-[#18181B]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Isolated Project Lanes
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Stop stashing code and juggling branches. Codelane uses Git Worktrees 
            to give every task its own isolated lane. Run agents, build features, 
            and review PRs simultaneously in independent environments that 
            never interfere with your main working directory.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {lanes.map((lane, index) => {
            const Icon = lane.icon;
            return (
              <div
                key={index}
                className={`relative p-6 rounded-md border-2 ${lane.color} bg-gradient-to-br ${lane.glow} to-transparent backdrop-blur-sm`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-sm text-gray-400">
                    {lane.name}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${lane.badgeColor}`}
                  >
                    {lane.badge}
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <Icon className="w-8 h-8 text-white" />
                  <h3 className="text-xl font-semibold text-white">
                    {lane.title}
                  </h3>
                </div>

                <p className="text-gray-400 mb-4">{lane.status}</p>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-gray-500" />
                    <span className="font-mono text-xs text-gray-500">
                      worktree/{lane.name.toLowerCase().replace(' ', '-')}
                    </span>
                  </div>
                  <div className="h-1 bg-[#1F2937] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#60A5FA] to-[#34D399] rounded-full"
                      style={{ width: `${60 + index * 15}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-8 rounded-md border border-[#374151] bg-[#1F2937]/50 backdrop-blur-sm">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-lg font-semibold text-white mb-3">
                True Parallelism
              </h4>
              <p className="text-gray-400 leading-relaxed">
                Each lane is an independent Git worktree with its own file system
                state. Agents can't step on each other's toes. No race
                conditions, no merge conflicts during active development.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white mb-3">
                Zero Context Loss
              </h4>
              <p className="text-gray-400 leading-relaxed">
                Switch between lanes instantly. Your agent's work continues in
                the background while you review another lane or work manually. No
                stashing, no branch juggling.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 rounded-xl border border-[#374151] bg-[#1F2937]/50 p-2 backdrop-blur-sm shadow-2xl overflow-hidden max-w-5xl mx-auto">
          <Image 
            src={gitManagerImg}
            alt="Codelane Git Manager Interface" 
            placeholder="blur"
            className="rounded-lg w-full h-auto object-cover border border-[#374151]/50"
          />
        </div>
      </div>
    </section>
  );
}
