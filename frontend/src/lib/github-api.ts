/**
 * GitHub API - Wrapper around Tauri commands for gh CLI operations
 */

import { invoke } from '@tauri-apps/api/core';
import type { PrMetadata } from '../types/lane';
import type { PrReviewComment, PrConversationComment } from '../types/review';

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

/**
 * Fetch inline review comments on a PR diff
 */
export async function fetchPrReviewComments(
  repoName: string,
  prNumber: number,
): Promise<PrReviewComment[]> {
  return invoke<PrReviewComment[]>('github_fetch_pr_review_comments', { repoName, prNumber });
}

/**
 * Fetch top-level PR conversation comments
 */
export async function fetchPrConversation(
  repoName: string,
  prNumber: number,
): Promise<PrConversationComment[]> {
  return invoke<PrConversationComment[]>('github_fetch_pr_conversation', { repoName, prNumber });
}

/**
 * Submit a review with inline comments on a PR
 */
export async function submitReviewWithComments(params: {
  repoName: string;
  prNumber: number;
  commitId: string;
  event: string;
  body?: string;
  comments: { path: string; line: number; side: string; body: string }[];
}): Promise<string> {
  return invoke<string>('github_submit_review_with_comments', params);
}
