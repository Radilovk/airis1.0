/**
 * GitHub Repository Sync
 * Syncs editor mode changes to the GitHub repository
 */

import { Octokit } from '@octokit/core'
import type { CodeGenerationResult } from './editor-code-generator'

export interface GitHubConfig {
  owner: string
  repo: string
  token?: string
  branch?: string
}

export interface SyncResult {
  success: boolean
  message: string
  commitSha?: string
  pullRequestUrl?: string
  error?: string
}

/**
 * GitHub Repository Sync Manager
 */
export class GitHubRepoSync {
  private octokit: Octokit | null = null
  private config: GitHubConfig

  constructor(config: GitHubConfig) {
    this.config = {
      branch: 'main',
      ...config,
    }

    if (config.token) {
      this.octokit = new Octokit({ auth: config.token })
    }
  }

  /**
   * Check if GitHub sync is configured
   */
  isConfigured(): boolean {
    return this.octokit !== null && !!this.config.token
  }

  /**
   * Commit editor mode changes to repository
   */
  async commitChanges(
    changes: CodeGenerationResult[],
    commitMessage: string = 'Update from Editor Mode'
  ): Promise<SyncResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'GitHub sync is not configured',
        error: 'Missing GitHub token',
      }
    }

    try {
      // Get the current commit SHA
      const { data: ref } = await this.octokit!.request(
        'GET /repos/{owner}/{repo}/git/ref/{ref}',
        {
          owner: this.config.owner,
          repo: this.config.repo,
          ref: `heads/${this.config.branch}`,
        }
      )

      const baseCommitSha = ref.object.sha

      // Get the base tree
      const { data: baseCommit } = await this.octokit!.request(
        'GET /repos/{owner}/{repo}/git/commits/{commit_sha}',
        {
          owner: this.config.owner,
          repo: this.config.repo,
          commit_sha: baseCommitSha,
        }
      )

      // Create blobs for each changed file
      const tree = await Promise.all(
        changes.map(async (change) => {
          const { data: blob } = await this.octokit!.request(
            'POST /repos/{owner}/{repo}/git/blobs',
            {
              owner: this.config.owner,
              repo: this.config.repo,
              content: change.generatedCode,
              encoding: 'utf-8',
            }
          )

          return {
            path: change.filePath,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.sha,
          }
        })
      )

      // Create a new tree
      const { data: newTree } = await this.octokit!.request(
        'POST /repos/{owner}/{repo}/git/trees',
        {
          owner: this.config.owner,
          repo: this.config.repo,
          base_tree: baseCommit.tree.sha,
          tree,
        }
      )

      // Create a new commit
      const { data: newCommit } = await this.octokit!.request(
        'POST /repos/{owner}/{repo}/git/commits',
        {
          owner: this.config.owner,
          repo: this.config.repo,
          message: commitMessage,
          tree: newTree.sha,
          parents: [baseCommitSha],
        }
      )

      // Update the reference
      await this.octokit!.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${this.config.branch}`,
        sha: newCommit.sha,
      })

      return {
        success: true,
        message: `Changes committed successfully`,
        commitSha: newCommit.sha,
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to commit changes',
        error: error.message,
      }
    }
  }

  /**
   * Create a pull request with editor mode changes
   */
  async createPullRequest(
    changes: CodeGenerationResult[],
    title: string = 'Editor Mode Updates',
    description: string = ''
  ): Promise<SyncResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'GitHub sync is not configured',
        error: 'Missing GitHub token',
      }
    }

    try {
      // Create a new branch
      const branchName = `editor-mode-${Date.now()}`
      
      const { data: ref } = await this.octokit!.request(
        'GET /repos/{owner}/{repo}/git/ref/{ref}',
        {
          owner: this.config.owner,
          repo: this.config.repo,
          ref: `heads/${this.config.branch}`,
        }
      )

      await this.octokit!.request('POST /repos/{owner}/{repo}/git/refs', {
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `refs/heads/${branchName}`,
        sha: ref.object.sha,
      })

      // Commit changes to the new branch
      const tempSync = new GitHubRepoSync({
        ...this.config,
        branch: branchName,
      })
      
      const commitResult = await tempSync.commitChanges(
        changes,
        'Apply editor mode changes'
      )

      if (!commitResult.success) {
        return commitResult
      }

      // Create pull request
      const { data: pr } = await this.octokit!.request(
        'POST /repos/{owner}/{repo}/pulls',
        {
          owner: this.config.owner,
          repo: this.config.repo,
          title,
          body: description,
          head: branchName,
          base: this.config.branch || 'main',
        }
      )

      return {
        success: true,
        message: 'Pull request created successfully',
        pullRequestUrl: pr.html_url,
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to create pull request',
        error: error.message,
      }
    }
  }

  /**
   * Save changes as a downloadable patch file
   */
  async downloadAsPatch(
    changes: CodeGenerationResult[],
    fileName: string = 'editor-mode-changes.patch'
  ): Promise<void> {
    let patchContent = `# Editor Mode Changes Patch\n`
    patchContent += `# Generated: ${new Date().toISOString()}\n\n`

    changes.forEach(change => {
      patchContent += `\n${'='.repeat(80)}\n`
      patchContent += `File: ${change.filePath}\n`
      patchContent += `Description: ${change.description}\n`
      patchContent += `${'='.repeat(80)}\n\n`
      patchContent += change.generatedCode
      patchContent += '\n\n'
    })

    // Create blob and trigger download
    const blob = new Blob([patchContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }
}

/**
 * Helper to extract repo info from current location
 */
export function detectGitHubRepo(): GitHubConfig | null {
  // Try to detect from window location or git remote
  // This is a placeholder - in production, this should be configured
  const urlMatch = window.location.hostname.match(/github\.com/)
  
  if (urlMatch) {
    // Try to parse from URL
    const pathMatch = window.location.pathname.match(/\/([^\/]+)\/([^\/]+)/)
    if (pathMatch) {
      return {
        owner: pathMatch[1],
        repo: pathMatch[2],
      }
    }
  }

  // Return configured values for this project
  return {
    owner: 'Radilovk',
    repo: 'airis1.0',
  }
}

/**
 * Get GitHub token from storage or environment
 */
export function getGitHubToken(): string | null {
  // Check localStorage
  const stored = localStorage.getItem('github-token')
  if (stored) return stored

  // In production, this might come from environment or secure storage
  return null
}

/**
 * Save GitHub token securely
 */
export function saveGitHubToken(token: string): void {
  localStorage.setItem('github-token', token)
}

/**
 * Clear GitHub token
 */
export function clearGitHubToken(): void {
  localStorage.removeItem('github-token')
}
