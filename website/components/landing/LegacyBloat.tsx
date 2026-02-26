import { Zap, MemoryStick, Clock } from 'lucide-react';

export function LegacyBloat() {
  const stats = [
    {
      icon: Clock,
      metric: '5x',
      label: 'Faster Startup',
      description: 'Launch in milliseconds, not seconds',
      color: 'text-[#60A5FA]',
    },
    {
      icon: MemoryStick,
      metric: '70%',
      label: 'Less Memory',
      description: 'No Electron RAM tax',
      color: 'text-[#34D399]',
    },
    {
      icon: Zap,
      metric: '15%',
      label: 'Features Used',
      description: 'Why pay for bloat you ignore?',
      color: 'text-[#60A5FA]',
    },
  ];

  return (
    <section className="relative py-24 bg-[#1F2937] border-y border-[#374151]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            The IDE is a{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
              Legacy Tool
            </span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            90% of developers use fewer than 15% of VS Code's features. Why pay
            the Electron "RAM tax" for features you don't use? Codelane is built
            in Rust/Tauri—giving you a 5x faster startup and 70% less memory
            usage than VS Code.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="group relative p-8 rounded-md border border-[#374151] bg-[#18181B]/50 backdrop-blur-sm hover:border-[#60A5FA]/50 transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#60A5FA]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-md" />
                <div className="relative">
                  <Icon className={`w-12 h-12 ${stat.color} mb-4`} />
                  <div className={`font-mono text-5xl font-bold ${stat.color} mb-2`}>
                    {stat.metric}
                  </div>
                  <div className="text-xl font-semibold text-white mb-2">
                    {stat.label}
                  </div>
                  <p className="text-gray-400">{stat.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 p-6 rounded-md border border-[#374151] bg-[#18181B]/50 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="w-2 h-2 rounded-full bg-[#34D399] mt-2 flex-shrink-0" />
            <p className="text-gray-300 leading-relaxed">
              <span className="font-semibold text-white">Real Performance:</span>{' '}
              Codelane uses native Rust and Tauri to deliver desktop-class
              performance without the Electron overhead. Your machine's resources
              are for building, not for running a bloated browser engine.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
