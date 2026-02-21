import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'solid-js';
import type { FileEntry } from '../../types';

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Must import after mocks
let useFileTree: typeof import('../useFileTree')['useFileTree'];

beforeEach(async () => {
  mockInvoke.mockReset();
  vi.resetModules();
  const mod = await import('../useFileTree');
  useFileTree = mod.useFileTree;
});

function makeEntry(overrides: Partial<FileEntry> & { name: string; path: string }): FileEntry {
  return {
    is_dir: false,
    is_file: true,
    is_symlink: false,
    size: 100,
    modified: Date.now(),
    ...overrides,
  };
}

describe('useFileTree', () => {
  describe('loadDirectory', () => {
    it('passes includeHidden: true to list_directory', async () => {
      mockInvoke.mockResolvedValue([]);

      await createRoot(async (dispose) => {
        const tree = useFileTree();
        await tree.loadDirectory('/project');
        dispose();
      });

      expect(mockInvoke).toHaveBeenCalledWith('list_directory', {
        path: '/project',
        includeHidden: true,
      });
    });

    it('includes dotfiles in results', async () => {
      mockInvoke.mockResolvedValue([
        makeEntry({ name: '.gitignore', path: '/project/.gitignore' }),
        makeEntry({ name: '.env', path: '/project/.env' }),
        makeEntry({ name: 'README.md', path: '/project/README.md' }),
      ]);

      await createRoot(async (dispose) => {
        const tree = useFileTree();
        await tree.loadDirectory('/project');

        const nodes = tree.nodes();
        const names = nodes.map((n) => n.entry.name);
        expect(names).toContain('.gitignore');
        expect(names).toContain('.env');
        expect(names).toContain('README.md');
        expect(nodes).toHaveLength(3);
        dispose();
      });
    });

    it('sorts directories before files', async () => {
      mockInvoke.mockResolvedValue([
        makeEntry({ name: 'file.ts', path: '/p/file.ts' }),
        makeEntry({ name: '.github', path: '/p/.github', is_dir: true, is_file: false }),
        makeEntry({ name: 'src', path: '/p/src', is_dir: true, is_file: false }),
        makeEntry({ name: '.gitignore', path: '/p/.gitignore' }),
      ]);

      await createRoot(async (dispose) => {
        const tree = useFileTree();
        await tree.loadDirectory('/p');

        const nodes = tree.nodes();
        // Directories first (sorted), then files (sorted)
        expect(nodes[0].entry.name).toBe('.github');
        expect(nodes[1].entry.name).toBe('src');
        expect(nodes[2].entry.name).toBe('.gitignore');
        expect(nodes[3].entry.name).toBe('file.ts');
        dispose();
      });
    });

    it('sorts entries alphabetically within same type', async () => {
      mockInvoke.mockResolvedValue([
        makeEntry({ name: 'zebra.ts', path: '/p/zebra.ts' }),
        makeEntry({ name: 'alpha.ts', path: '/p/alpha.ts' }),
        makeEntry({ name: '.env', path: '/p/.env' }),
      ]);

      await createRoot(async (dispose) => {
        const tree = useFileTree();
        await tree.loadDirectory('/p');

        const names = tree.nodes().map((n) => n.entry.name);
        expect(names).toEqual(['.env', 'alpha.ts', 'zebra.ts']);
        dispose();
      });
    });

    it('sets error on failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Permission denied'));

      await createRoot(async (dispose) => {
        const tree = useFileTree();
        await tree.loadDirectory('/restricted');

        expect(tree.error()).toBe('Permission denied');
        expect(tree.isLoading()).toBe(false);
        dispose();
      });
    });

    it('sets isLoading to false after load', async () => {
      mockInvoke.mockResolvedValue([]);

      await createRoot(async (dispose) => {
        const tree = useFileTree();
        await tree.loadDirectory('/p');

        expect(tree.isLoading()).toBe(false);
        dispose();
      });
    });
  });

  describe('toggleNode', () => {
    it('selects file nodes', async () => {
      const fileEntry = makeEntry({ name: 'test.ts', path: '/p/test.ts' });
      mockInvoke.mockResolvedValue([fileEntry]);

      await createRoot(async (dispose) => {
        const tree = useFileTree();
        await tree.loadDirectory('/p');

        const selectHandler = vi.fn();
        await tree.toggleNode(tree.nodes()[0], [0], selectHandler);

        expect(tree.selectedPath()).toBe('/p/test.ts');
        expect(selectHandler).toHaveBeenCalledWith('/p/test.ts');
        dispose();
      });
    });

    it('expands directory and loads children with includeHidden', async () => {
      const dirEntry = makeEntry({ name: 'src', path: '/p/src', is_dir: true, is_file: false });
      mockInvoke
        .mockResolvedValueOnce([dirEntry]) // loadDirectory
        .mockResolvedValueOnce([           // toggleNode expand
          makeEntry({ name: '.hidden', path: '/p/src/.hidden' }),
          makeEntry({ name: 'index.ts', path: '/p/src/index.ts' }),
        ]);

      await createRoot(async (dispose) => {
        const tree = useFileTree();
        await tree.loadDirectory('/p');

        await tree.toggleNode(tree.nodes()[0], [0]);

        // Should have called list_directory with includeHidden for the subdirectory
        expect(mockInvoke).toHaveBeenCalledWith('list_directory', {
          path: '/p/src',
          includeHidden: true,
        });

        const expanded = tree.nodes()[0];
        expect(expanded.isExpanded).toBe(true);
        expect(expanded.children).toHaveLength(2);
        expect(expanded.children[0].entry.name).toBe('.hidden');
        expect(expanded.children[1].entry.name).toBe('index.ts');
        dispose();
      });
    });

    it('collapses expanded directory', async () => {
      const dirEntry = makeEntry({ name: 'src', path: '/p/src', is_dir: true, is_file: false });
      mockInvoke
        .mockResolvedValueOnce([dirEntry])
        .mockResolvedValueOnce([]);

      await createRoot(async (dispose) => {
        const tree = useFileTree();
        await tree.loadDirectory('/p');

        // Expand
        await tree.toggleNode(tree.nodes()[0], [0]);
        expect(tree.nodes()[0].isExpanded).toBe(true);

        // Collapse
        await tree.toggleNode(tree.nodes()[0], [0]);
        expect(tree.nodes()[0].isExpanded).toBe(false);
        dispose();
      });
    });
  });

  describe('refreshDirectory', () => {
    it('passes includeHidden when refreshing', async () => {
      mockInvoke.mockResolvedValue([]);

      await createRoot(async (dispose) => {
        const tree = useFileTree();
        await tree.loadDirectory('/p');
        mockInvoke.mockClear();

        await tree.refreshDirectory('/p', '/p');

        expect(mockInvoke).toHaveBeenCalledWith('list_directory', {
          path: '/p',
          includeHidden: true,
        });
        dispose();
      });
    });

    it('preserves expanded state on root refresh', async () => {
      const dirEntry = makeEntry({ name: 'src', path: '/p/src', is_dir: true, is_file: false });
      const fileEntry = makeEntry({ name: 'README.md', path: '/p/README.md' });

      mockInvoke
        .mockResolvedValueOnce([dirEntry, fileEntry]) // initial load
        .mockResolvedValueOnce([]) // expand src
        .mockResolvedValueOnce([dirEntry, fileEntry]); // refresh

      await createRoot(async (dispose) => {
        const tree = useFileTree();
        await tree.loadDirectory('/p');

        // Expand src directory
        await tree.toggleNode(tree.nodes()[0], [0]);
        expect(tree.nodes()[0].isExpanded).toBe(true);

        // Refresh root
        await tree.refreshDirectory('/p', '/p');

        // src should still be expanded
        expect(tree.nodes()[0].isExpanded).toBe(true);
        dispose();
      });
    });
  });

  describe('reset', () => {
    it('clears all state', async () => {
      mockInvoke.mockResolvedValue([
        makeEntry({ name: 'test.ts', path: '/p/test.ts' }),
      ]);

      await createRoot(async (dispose) => {
        const tree = useFileTree();
        await tree.loadDirectory('/p');
        expect(tree.nodes()).toHaveLength(1);

        tree.reset();

        expect(tree.nodes()).toHaveLength(0);
        expect(tree.selectedPath()).toBeNull();
        expect(tree.error()).toBeNull();
        dispose();
      });
    });
  });
});
