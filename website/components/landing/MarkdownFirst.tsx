import { FileCode, Edit3, Layout, Zap } from 'lucide-react';
import Image from 'next/image';
import markdownImg from '@/public/screenshots/markdown_rendering.webp';

export function MarkdownFirst() {
  const comparisons = [
    {
      title: 'VS Code',
      pros: ['Raw text default', 'Separate preview pane', 'Context switch to read'],
      borderColor: 'border-red-500/20',
      textColor: 'text-red-400',
    },
    {
      title: 'Codelane',
      pros: ['Rendered by default', 'In-place rich editing', 'Built for agent plans'],
      borderColor: 'border-[#34D399]/20',
      textColor: 'text-[#34D399]',
    },
  ];

  return (
    <section className="relative py-24 bg-[#18181B] border-y border-[#374151]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Markdown-First Workflow
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            AI agents communicate in Markdown. Why is your IDE still treating it like a secondary preview? 
            Codelane treats Markdown as a primary citizen, designed specifically for the agentic era.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#60A5FA]/10 flex items-center justify-center">
                <Layout className="w-6 h-6 text-[#60A5FA]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Native Rendering</h3>
                <p className="text-gray-400 leading-relaxed">
                  No more toggling <code className="text-[#60A5FA] bg-[#1F2937] px-1 rounded">CMD+Shift+V</code>. 
                  In Codelane, agent responses and plans are rendered instantly. Read through complex 
                  proposals with the formatting, tables, and code blocks your agent intended.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#34D399]/10 flex items-center justify-center">
                <Edit3 className="w-6 h-6 text-[#34D399]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Rich In-Place Editing</h3>
                <p className="text-gray-400 leading-relaxed">
                  Edit files directly in a rendered environment. Refine agent instructions or 
                  tweak documentation without losing the visual context. It's the speed of 
                  raw text with the clarity of a finished document.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Built for Agent Plans</h3>
                <p className="text-gray-400 leading-relaxed">
                  Agents love structured plans. Codelane makes those plans actionable. 
                  Trace through dependencies and execution steps in a UX optimized 
                  for reading long-form AI output.
                </p>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#60A5FA] to-[#34D399] rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
            <div className="relative rounded-xl border border-[#374151] bg-[#1F2937] overflow-hidden shadow-2xl">
              <Image 
                src={markdownImg}
                alt="Codelane Markdown Rendering Interface" 
                placeholder="blur"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {comparisons.map((item, idx) => (
            <div key={idx} className={`p-8 rounded-xl border ${item.borderColor} bg-[#1F2937]/30 backdrop-blur-sm`}>
              <h4 className={`text-2xl font-bold mb-6 ${item.textColor}`}>{item.title}</h4>
              <ul className="space-y-4">
                {item.pros.map((pro, pIdx) => (
                  <li key={pIdx} className="flex items-center gap-3 text-gray-300">
                    <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-red-500' : 'bg-[#34D399]'}`} />
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
