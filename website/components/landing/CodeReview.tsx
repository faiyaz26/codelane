import { CheckCircle2, XCircle, Eye } from 'lucide-react';

export function CodeReview() {
  const diffLines = [
    { type: 'context', content: 'export function AuthProvider({ children }) {' },
    { type: 'removed', content: '-  const [user, setUser] = useState(null);' },
    { type: 'added', content: '+  const [user, setUser] = useState<User | null>(null);' },
    { type: 'added', content: '+  const [loading, setLoading] = useState(true);' },
    { type: 'context', content: '  useEffect(() => {' },
    { type: 'removed', content: '-    fetchUser().then(setUser);' },
    { type: 'added', content: '+    fetchUser().then(u => {' },
    { type: 'added', content: '+      setUser(u);' },
    { type: 'added', content: '+      setLoading(false);' },
    { type: 'added', content: '+    });' },
    { type: 'context', content: '  }, []);' },
  ];

  return (
    <section className="relative py-24 bg-[#1F2937] border-y border-[#374151]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Human-in-the-Loop Review
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Don't blindly trust <code className="px-2 py-1 bg-[#18181B] rounded text-[#60A5FA] font-mono">git apply</code>.
            Codelane provides a native, high-performance visual review layer for
            all agent-generated changes. Inspect, tweak, and approve code before
            it ever hits your branch.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          <div className="space-y-4">
            <div className="p-6 rounded-md border border-[#374151] bg-[#18181B]/50 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-4">
                <Eye className="w-6 h-6 text-[#60A5FA]" />
                <h3 className="text-xl font-semibold text-white">
                  Visual Diff Viewer
                </h3>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Side-by-side or unified diffs with syntax highlighting. See exactly
                what your agent changed, line by line, with full context.
              </p>
            </div>

            <div className="p-6 rounded-md border border-[#374151] bg-[#18181B]/50 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="w-6 h-6 text-[#34D399]" />
                <h3 className="text-xl font-semibold text-white">
                  Selective Approval
                </h3>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Accept changes file-by-file or hunk-by-hunk. Your agent proposed
                12 files but you only trust 10? Approve what works, reject the rest.
              </p>
            </div>

            <div className="p-6 rounded-md border border-[#374151] bg-[#18181B]/50 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-4">
                <XCircle className="w-6 h-6 text-red-400" />
                <h3 className="text-xl font-semibold text-white">
                  Inline Editing
                </h3>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Tweak agent output directly in the diff view. Fix minor issues
                without round-tripping back to the agent or your editor.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-[#374151] bg-[#18181B] overflow-hidden">
            <div className="px-4 py-3 bg-[#1F2937] border-b border-[#374151] flex items-center justify-between">
              <span className="font-mono text-sm text-gray-400">
                components/AuthProvider.tsx
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400">
                  -3
                </span>
                <span className="px-2 py-1 rounded text-xs font-medium bg-[#34D399]/20 text-[#34D399]">
                  +7
                </span>
              </div>
            </div>

            <div className="p-4 font-mono text-sm overflow-x-auto">
              {diffLines.map((line, index) => {
                let bgColor = '';
                let textColor = 'text-gray-400';
                let prefix = ' ';

                if (line.type === 'removed') {
                  bgColor = 'bg-red-500/10';
                  textColor = 'text-red-300';
                  prefix = '-';
                } else if (line.type === 'added') {
                  bgColor = 'bg-[#34D399]/10';
                  textColor = 'text-[#34D399]';
                  prefix = '+';
                }

                return (
                  <div key={index} className={`${bgColor} ${textColor} py-0.5`}>
                    <span className="text-gray-600 select-none mr-4">
                      {index + 1}
                    </span>
                    <span className="select-none mr-2">{prefix}</span>
                    {line.content.replace(/^[+-]\s*/, '')}
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-3 bg-[#1F2937] border-t border-[#374151] flex items-center justify-end gap-2">
              <button className="px-4 py-2 rounded border border-[#374151] text-gray-400 hover:text-white hover:border-gray-400 transition-colors text-sm">
                Reject
              </button>
              <button className="px-4 py-2 rounded bg-[#34D399] text-[#18181B] hover:bg-[#34D399]/90 transition-colors text-sm font-medium">
                Approve Changes
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-md border border-[#374151] bg-[#18181B]/50 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="w-2 h-2 rounded-full bg-[#60A5FA] mt-2 flex-shrink-0" />
            <p className="text-gray-300 leading-relaxed">
              <span className="font-semibold text-white">Trust, but Verify:</span>{' '}
              Agents are powerful, but they're not infallible. Codelane's review
              layer ensures you maintain control and quality without slowing down
              your workflow.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
