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

        <div className="text-center">
          <div className="inline-flex flex-col items-center gap-6 p-8 rounded-md border border-[#374151] bg-gradient-to-br from-[#34D399]/10 to-transparent backdrop-blur-sm w-full max-w-2xl mx-auto">
            <h3 className="text-2xl font-semibold text-white">Join the Community</h3>
            
            <div className="flex flex-wrap justify-center gap-4">
              <iframe 
                src="https://ghbtns.com/github-btn.html?user=faiyaz26&repo=codelane&type=star&count=true&size=large" 
                frameBorder="0" 
                scrolling="0" 
                width="170" 
                height="30" 
                title="GitHub Star"
              ></iframe>
              <iframe 
                src="https://ghbtns.com/github-btn.html?user=faiyaz26&repo=codelane&type=fork&count=true&size=large" 
                frameBorder="0" 
                scrolling="0" 
                width="170" 
                height="30" 
                title="GitHub Fork"
              ></iframe>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="https://github.com/faiyaz26/codelane/issues/new" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-2 rounded border border-[#374151] text-gray-300 hover:text-white hover:bg-[#1F2937] transition-all"
              >
                Create an Issue
              </a>
              <a 
                href="https://github.com/faiyaz26/codelane" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-2 rounded bg-[#60A5FA] text-white hover:bg-[#60A5FA]/90 transition-all font-medium"
              >
                View Repository
              </a>
            </div>

            <p className="text-sm text-gray-500 max-w-md">
              Found a bug? Have a feature request? Codelane is open source and we welcome your feedback and contributions.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
