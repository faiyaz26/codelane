import { describe, it, expect } from 'vitest';
import { parseRemoteUrl, buildRemoteFileUrl } from '../remote-url';

describe('parseRemoteUrl', () => {
  it('parses SSH GitHub URL', () => {
    const result = parseRemoteUrl('git@github.com:user/repo.git');
    expect(result).toEqual({ host: 'github.com', owner: 'user', repo: 'repo' });
  });

  it('parses HTTPS GitHub URL with .git suffix', () => {
    const result = parseRemoteUrl('https://github.com/user/repo.git');
    expect(result).toEqual({ host: 'github.com', owner: 'user', repo: 'repo' });
  });

  it('parses HTTPS GitHub URL without .git suffix', () => {
    const result = parseRemoteUrl('https://github.com/user/repo');
    expect(result).toEqual({ host: 'github.com', owner: 'user', repo: 'repo' });
  });

  it('parses GitLab SSH URL', () => {
    const result = parseRemoteUrl('git@gitlab.com:org/project.git');
    expect(result).toEqual({ host: 'gitlab.com', owner: 'org', repo: 'project' });
  });

  it('parses Bitbucket SSH URL', () => {
    const result = parseRemoteUrl('git@bitbucket.org:user/repo.git');
    expect(result).toEqual({ host: 'bitbucket.org', owner: 'user', repo: 'repo' });
  });

  it('returns null for invalid URL', () => {
    expect(parseRemoteUrl('not-a-url')).toBeNull();
    expect(parseRemoteUrl('')).toBeNull();
  });
});

describe('buildRemoteFileUrl', () => {
  const githubRemote = 'https://github.com/user/repo.git';
  const gitlabRemote = 'https://gitlab.com/user/repo.git';
  const bitbucketRemote = 'https://bitbucket.org/user/repo.git';

  it('builds GitHub file URL', () => {
    const url = buildRemoteFileUrl(githubRemote, 'src/index.ts', 'main');
    expect(url).toBe('https://github.com/user/repo/blob/main/src/index.ts');
  });

  it('builds GitHub file URL with single line', () => {
    const url = buildRemoteFileUrl(githubRemote, 'src/index.ts', 'main', 42);
    expect(url).toBe('https://github.com/user/repo/blob/main/src/index.ts#L42');
  });

  it('builds GitHub file URL with line range', () => {
    const url = buildRemoteFileUrl(githubRemote, 'src/index.ts', 'main', 10, 20);
    expect(url).toBe('https://github.com/user/repo/blob/main/src/index.ts#L10-L20');
  });

  it('builds GitLab file URL', () => {
    const url = buildRemoteFileUrl(gitlabRemote, 'src/lib.rs', 'develop');
    expect(url).toBe('https://gitlab.com/user/repo/-/blob/develop/src/lib.rs');
  });

  it('builds GitLab file URL with line', () => {
    const url = buildRemoteFileUrl(gitlabRemote, 'src/lib.rs', 'main', 5);
    expect(url).toBe('https://gitlab.com/user/repo/-/blob/main/src/lib.rs#L5');
  });

  it('builds GitLab file URL with line range', () => {
    const url = buildRemoteFileUrl(gitlabRemote, 'src/lib.rs', 'main', 5, 15);
    expect(url).toBe('https://gitlab.com/user/repo/-/blob/main/src/lib.rs#L5-15');
  });

  it('builds Bitbucket file URL', () => {
    const url = buildRemoteFileUrl(bitbucketRemote, 'app/main.py', 'master');
    expect(url).toBe('https://bitbucket.org/user/repo/src/master/app/main.py');
  });

  it('builds Bitbucket file URL with line', () => {
    const url = buildRemoteFileUrl(bitbucketRemote, 'app/main.py', 'master', 7);
    expect(url).toBe('https://bitbucket.org/user/repo/src/master/app/main.py#lines-7');
  });

  it('builds Bitbucket file URL with line range', () => {
    const url = buildRemoteFileUrl(bitbucketRemote, 'app/main.py', 'master', 7, 12);
    expect(url).toBe('https://bitbucket.org/user/repo/src/master/app/main.py#lines-7:12');
  });

  it('handles file path with leading slash', () => {
    const url = buildRemoteFileUrl(githubRemote, '/src/index.ts', 'main');
    expect(url).toBe('https://github.com/user/repo/blob/main/src/index.ts');
  });

  it('returns null for unparseable remote', () => {
    const url = buildRemoteFileUrl('not-a-remote', 'file.ts', 'main');
    expect(url).toBeNull();
  });

  it('works with SSH remote URL', () => {
    const url = buildRemoteFileUrl('git@github.com:myorg/myrepo.git', 'README.md', 'main');
    expect(url).toBe('https://github.com/myorg/myrepo/blob/main/README.md');
  });
});
