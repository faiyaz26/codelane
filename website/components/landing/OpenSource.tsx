import { Shield, Lock, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function OpenSource() {
  const features = [
    {
      icon: Shield,
      title: 'No Telemetry',
      description: 'Your code stays on your machine. No analytics, no tracking, no phone-home.',
    },
    {
      icon: Lock,
      title: 'Pure Local Execution',
      description: 'Codelane itself performs zero online processing. It provides a purely local cockpit for your workflow, while your agents communicate directly with their providers using your own API keys.',
    },
    {
      icon: Package,
      title: 'Fully Extensible',
      description: 'Fork it, modify it, build on it. AGPL-3.0 means the code is yours to shape.',
    },
  ];

  return (
    <section className="relative py-24 bg-[#1F2937] border-y border-[#374151]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-[#34D399] bg-[#34D399]/10 backdrop-blur-sm mb-6">
            <span className="font-mono text-sm text-[#34D399]">
              AGPL-3.0 Licensed
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Transparent. Extensible.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#34D399] to-[#60A5FA]">
              Yours.
            </span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Codelane is AGPL-3.0. No telemetry, pure local execution, just 
            native performance. Inspect the source, audit the security, extend the
            functionality.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="p-8 rounded-md border border-[#374151] bg-[#18181B]/50 backdrop-blur-sm"
              >
                <div className="p-3 rounded-md bg-[#34D399]/10 w-fit mb-4">
                  <Icon className="w-8 h-8 text-[#34D399]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="p-8 rounded-md border border-[#374151] bg-[#18181B]/50 backdrop-blur-sm mb-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="text-2xl font-semibold text-white mb-3">
                Need Commercial Licensing?
              </h3>
              <p className="text-gray-400 leading-relaxed">
                Building Codelane into your enterprise tooling or proprietary
                product? We offer commercial licenses for organizations that can't
                use AGPL-3.0.
              </p>
            </div>
            <a href="mailto:faiyaz26@gmail.com">
              <Button
                variant="outline"
                className="border-[#60A5FA] text-[#60A5FA] hover:bg-[#60A5FA]/10 whitespace-nowrap"
              >
                Contact for Licensing
              </Button>
            </a>
          </div>
        </div>

        <div className="text-center">
          <div className="inline-flex flex-col items-center gap-4 p-8 rounded-md border border-[#374151] bg-gradient-to-br from-[#34D399]/10 to-transparent backdrop-blur-sm">
            <div className="font-mono text-lg text-gray-400">
              View the source on GitHub
            </div>
            <code className="px-6 py-3 bg-[#18181B] rounded border border-[#374151] text-[#60A5FA] font-mono text-sm">
              git clone https://github.com/faiyaz26/codelane.git
            </code>
            <p className="text-sm text-gray-500 max-w-md">
              Star the repo, open issues, submit PRs. Codelane is built by
              developers, for developers.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
