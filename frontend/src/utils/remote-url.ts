// Utility functions for constructing remote file URLs from git remote URLs.
// Supports GitHub, GitLab, and Bitbucket.

interface ParsedRemote {
  host: string;
  owner: string;
  repo: string;
}

type RemoteProvider = 'github' | 'gitlab' | 'bitbucket' | 'unknown';

function detectProvider(host: string): RemoteProvider {
  if (host.includes('github')) return 'github';
  if (host.includes('gitlab')) return 'gitlab';
  if (host.includes('bitbucket')) return 'bitbucket';
  return 'unknown';
}

/**
 * Normalize a git remote URL (SSH or HTTPS) into its component parts.
 * Returns null if the URL cannot be parsed.
 *
 * Examples:
 *   git@github.com:user/repo.git  → { host: 'github.com', owner: 'user', repo: 'repo' }
 *   https://github.com/user/repo  → { host: 'github.com', owner: 'user', repo: 'repo' }
 */
export function parseRemoteUrl(remoteUrl: string): ParsedRemote | null {
  const url = remoteUrl.trim();

  // SSH format: git@host:owner/repo.git
  const sshMatch = url.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return { host: sshMatch[1], owner: sshMatch[2], repo: sshMatch[3] };
  }

  // HTTPS format: https://host/owner/repo(.git)
  try {
    const parsed = new URL(url.endsWith('.git') ? url.slice(0, -4) : url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { host: parsed.hostname, owner: parts[0], repo: parts.slice(1).join('/') };
    }
  } catch {
    // not a valid URL
  }

  return null;
}

/**
 * Build a browser URL that points to a specific file (and optionally line range)
 * in a remote git provider.
 *
 * @param remoteUrl   - The raw git remote URL (SSH or HTTPS)
 * @param relativeFilePath - File path relative to the repo root (e.g. "src/main.ts")
 * @param branch      - Branch or commit ref
 * @param startLine   - 1-indexed start line (optional)
 * @param endLine     - 1-indexed end line (optional, only used when > startLine)
 * @returns           - Full browser URL or null if the remote cannot be parsed
 */
export function buildRemoteFileUrl(
  remoteUrl: string,
  relativeFilePath: string,
  branch: string,
  startLine?: number,
  endLine?: number,
): string | null {
  const parsed = parseRemoteUrl(remoteUrl);
  if (!parsed) return null;

  const provider = detectProvider(parsed.host);
  const { host, owner, repo } = parsed;

  // Normalize file path — ensure no leading slash
  const filePath = relativeFilePath.replace(/^\/+/, '');

  const lineAnchor = buildLineAnchor(provider, startLine, endLine);

  switch (provider) {
    case 'github':
      return `https://${host}/${owner}/${repo}/blob/${branch}/${filePath}${lineAnchor}`;

    case 'gitlab':
      return `https://${host}/${owner}/${repo}/-/blob/${branch}/${filePath}${lineAnchor}`;

    case 'bitbucket':
      return `https://${host}/${owner}/${repo}/src/${branch}/${filePath}${lineAnchor}`;

    default:
      // Fallback: use GitHub-style URL for unknown hosts (e.g. GitHub Enterprise)
      return `https://${host}/${owner}/${repo}/blob/${branch}/${filePath}${lineAnchor}`;
  }
}

function buildLineAnchor(
  provider: RemoteProvider,
  startLine?: number,
  endLine?: number,
): string {
  if (!startLine) return '';

  const hasRange = endLine !== undefined && endLine > startLine;

  switch (provider) {
    case 'github':
      return hasRange ? `#L${startLine}-L${endLine}` : `#L${startLine}`;

    case 'gitlab':
      return hasRange ? `#L${startLine}-${endLine}` : `#L${startLine}`;

    case 'bitbucket':
      return hasRange ? `#lines-${startLine}:${endLine}` : `#lines-${startLine}`;

    default:
      return hasRange ? `#L${startLine}-L${endLine}` : `#L${startLine}`;
  }
}
