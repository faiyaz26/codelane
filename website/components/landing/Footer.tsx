import { Github, FileText, AlertCircle, Mail, Terminal } from 'lucide-react';

export function Footer() {
  const links = [
    {
      title: 'Product',
      items: [
        { name: 'Download', href: 'https://github.com/faiyaz26/codelane/releases/latest' },
      ],
    },
    {
      title: 'Community',
      items: [
        { name: 'GitHub', href: 'https://github.com/faiyaz26/codelane', icon: Github },
        { name: 'Issues', href: 'https://github.com/faiyaz26/codelane/issues', icon: AlertCircle },
      ],
    },
    {
      title: 'Legal',
      items: [
        { name: 'AGPL-3.0 License', href: 'https://github.com/faiyaz26/codelane/blob/main/LICENSE' },
      ],
    },
  ];

  return (
    <footer className="relative bg-[#18181B] border-t border-[#374151]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="w-8 h-8 text-[#60A5FA]" />
              <span className="text-2xl font-bold text-white">Codelane</span>
            </div>
            <p className="text-gray-400 leading-relaxed mb-4">
              The agentic cockpit for modern engineers.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/faiyaz26/codelane"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded border border-[#374151] text-gray-400 hover:text-white hover:border-[#60A5FA] transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="mailto:faiyaz26@gmail.com"
                className="p-2 rounded border border-[#374151] text-gray-400 hover:text-white hover:border-[#60A5FA] transition-colors"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {links.map((section, index) => (
            <div key={index}>
              <h3 className="text-white font-semibold mb-4">{section.title}</h3>
              <ul className="space-y-3">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <a
                      href={item.href}
                      className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-[#374151] flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-gray-500 text-sm">
            © 2026 Codelane. Licensed under AGPL-3.0.
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a href="mailto:faiyaz26@gmail.com" className="text-gray-400 hover:text-white transition-colors">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
