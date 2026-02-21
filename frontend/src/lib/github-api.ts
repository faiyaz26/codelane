/**
 * GitHub API - Wrapper around Tauri commands for gh CLI operations
 */

import { invoke } from '@tauri-apps/api/core';
import type { PrMetadata } from '../types/lane';

/**
 * gh CLI installation and authentication status
 */
export interface GhCliStatus {
  installed: boolean;
  authenticated: boolean;
  user: string | null;
  version: string | null;
}

/**
 * Check gh CLI installation and authentication status
 */
export async function checkGhStatus(): Promise<GhCliStatus> {
  return invoke<GhCliStatus>('github_check_status');
}

/**
 * Fetch pull request information from a GitHub PR URL
 */
export async function fetchPrInfo(prUrl: string): Promise<PrMetadata> {
  const raw = await invoke<{
    number: number;
    title: string;
    author: string;
    baseBranch: string;
    headBranch: string;
    headSha: string;
    repoUrl: string;
    repoName: string;
    body: string;
    state: string;
    filesChanged: number;
    additions: number;
    deletions: number;
  }>('github_fetch_pr', { prUrl });

  return {
    number: raw.number,
    title: raw.title,
    author: raw.author,
    baseBranch: raw.baseBranch,
    headBranch: raw.headBranch,
    headSha: raw.headSha,
    prUrl,
    repoName: raw.repoName,
    body: raw.body,
    state: raw.state,
    filesChanged: raw.filesChanged,
    additions: raw.additions,
    deletions: raw.deletions,
  };
}

/**
 * Submit a review on a pull request
 */
export async function submitPrReview(
  prUrl: string,
  reviewType: 'approve' | 'comment' | 'request_changes',
  body?: string,
): Promise<string> {
  return invoke<string>('github_submit_review', { prUrl, reviewType, body });
}
