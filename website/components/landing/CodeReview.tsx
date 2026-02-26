import { CheckCircle2, MessageSquare, Eye } from 'lucide-react';
import Image from 'next/image';
import codeReviewImg from '@/public/screenshots/code_review_tab.webp';

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

        <div className="mb-12">
          <div className="rounded-md border border-[#374151] bg-[#18181B] overflow-hidden shadow-2xl mb-8 max-w-5xl mx-auto">
            <Image 
              src={codeReviewImg}
              alt="Codelane Code Review Interface" 
              placeholder="blur"
              className="w-full h-auto"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-md border border-[#374151] bg-[#18181B]/50 backdrop-blur-sm hover:border-[#60A5FA]/50 transition-colors">
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

            <div className="p-6 rounded-md border border-[#374151] bg-[#18181B]/50 backdrop-blur-sm hover:border-[#34D399]/50 transition-colors">
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

            <div className="p-6 rounded-md border border-[#374151] bg-[#18181B]/50 backdrop-blur-sm hover:border-[#F59E0B]/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="w-6 h-6 text-[#F59E0B]" />
                <h3 className="text-xl font-semibold text-white">
                  Contextual AI Assistant
                </h3>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Have questions about a diff? Ask the built-in AI assistant to explain changes, summarize the PR, or identify potential bugs directly within the review tab.
              </p>
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
