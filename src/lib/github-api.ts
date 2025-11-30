import { Octokit } from '@octokit/core'
import type { PipelineConfig, GitHubAdminConfig } from '@/types'
import {
  ONE_PROMPT,
  STEP1_GEO_CALIBRATION_PROMPT,
  STEP2A_STRUCTURAL_DETECTOR_PROMPT,
  STEP2B_PIGMENT_RINGS_DETECTOR_PROMPT,
  STEP2C_CONSISTENCY_VALIDATOR_PROMPT,
  STEP3_MAPPER_PROMPT,
  STEP4_PROFILE_BUILDER_PROMPT,
  STEP5_FRONTEND_REPORT_PROMPT
} from './default-pipeline-prompts'

// Default pipeline configuration based on existing steps
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  version: '1.0.0',
  steps: [
    {
      id: 'one',
      name: 'One - Цялостен анализ',
      description: 'Единичен цялостен промпт за пълен иридологичен анализ',
      order: 1,
      enabled: true,
      prompt: ONE_PROMPT,
      modelSettings: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 4000,
        topP: 0.9
      },
      inputFrom: null,
      outputTo: null,
      lastModified: new Date().toISOString()
    },
    {
      id: 'step1_geo_calibration',
      name: 'Geo Calibration',
      description: 'Геометрична калибрация на ириса - определяне на координатна система',
      order: 2,
      enabled: false,
      prompt: STEP1_GEO_CALIBRATION_PROMPT,
      modelSettings: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 2000,
        topP: 0.9
      },
      inputFrom: null,
      outputTo: 'step2a_structural_detector',
      lastModified: new Date().toISOString()
    },
    {
      id: 'step2a_structural_detector',
      name: 'Structural Detector',
      description: 'Детектор на структурни находки - лакуни, крипти, бразди',
      order: 3,
      enabled: false,
      prompt: STEP2A_STRUCTURAL_DETECTOR_PROMPT,
      modelSettings: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 3000,
        topP: 0.9
      },
      inputFrom: 'step1_geo_calibration',
      outputTo: 'step2b_pigment_rings_detector',
      lastModified: new Date().toISOString()
    },
    {
      id: 'step2b_pigment_rings_detector',
      name: 'Pigment & Rings Detector',
      description: 'Детектор на пигментация и пръстени',
      order: 4,
      enabled: false,
      prompt: STEP2B_PIGMENT_RINGS_DETECTOR_PROMPT,
      modelSettings: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 3000,
        topP: 0.9
      },
      inputFrom: 'step2a_structural_detector',
      outputTo: 'step2c_consistency_validator',
      lastModified: new Date().toISOString()
    },
    {
      id: 'step2c_consistency_validator',
      name: 'Consistency Validator',
      description: 'Валидатор за съгласуваност на находките',
      order: 5,
      enabled: false,
      prompt: STEP2C_CONSISTENCY_VALIDATOR_PROMPT,
      modelSettings: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 2000,
        topP: 0.9
      },
      inputFrom: 'step2b_pigment_rings_detector',
      outputTo: 'step3_mapper',
      lastModified: new Date().toISOString()
    },
    {
      id: 'step3_mapper',
      name: 'Zone Mapper',
      description: 'Мапиране на находките към зони по v9 схемата',
      order: 6,
      enabled: false,
      prompt: STEP3_MAPPER_PROMPT,
      modelSettings: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 2000,
        topP: 0.9
      },
      inputFrom: 'step2c_consistency_validator',
      outputTo: 'step4_profile_builder',
      lastModified: new Date().toISOString()
    },
    {
      id: 'step4_profile_builder',
      name: 'Profile Builder',
      description: 'Изграждане на профил на пациента',
      order: 7,
      enabled: false,
      prompt: STEP4_PROFILE_BUILDER_PROMPT,
      modelSettings: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 3000,
        topP: 0.9
      },
      inputFrom: 'step3_mapper',
      outputTo: 'step5_frontend_report',
      lastModified: new Date().toISOString()
    },
    {
      id: 'step5_frontend_report',
      name: 'Frontend Report Generator',
      description: 'Генериране на финалния репорт за фронтенда',
      order: 8,
      enabled: false,
      prompt: STEP5_FRONTEND_REPORT_PROMPT,
      modelSettings: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4000,
        topP: 0.9
      },
      inputFrom: 'step4_profile_builder',
      outputTo: null,
      lastModified: new Date().toISOString()
    }
  ],
  lastModified: new Date().toISOString()
}

// GitHub API Service
export class GitHubApiService {
  private octokit: Octokit | null = null
  private config: GitHubAdminConfig | null = null

  constructor(config?: GitHubAdminConfig) {
    if (config) {
      this.setConfig(config)
    }
  }

  setConfig(config: GitHubAdminConfig) {
    this.config = config
    if (config.apiKey) {
      this.octokit = new Octokit({ auth: config.apiKey })
    }
  }

  isConfigured(): boolean {
    return !!this.octokit && !!this.config?.apiKey
  }

  // Get file content from GitHub repo
  async getFileContent(path: string): Promise<{ content: string; sha: string } | null> {
    if (!this.octokit || !this.config) {
      throw new Error('GitHub API not configured')
    }

    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner: this.config.repoOwner,
        repo: this.config.repoName,
        path: path,
        ref: this.config.branch
      })

      if ('content' in response.data && typeof response.data.content === 'string') {
        const content = atob(response.data.content)
        return {
          content,
          sha: response.data.sha as string
        }
      }
      return null
    } catch (error: unknown) {
      if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
        return null
      }
      throw error
    }
  }

  // Create or update file in GitHub repo
  async saveFileContent(path: string, content: string, message: string, sha?: string): Promise<{ sha: string }> {
    if (!this.octokit || !this.config) {
      throw new Error('GitHub API not configured')
    }

    const encodedContent = btoa(unescape(encodeURIComponent(content)))

    const params: {
      owner: string
      repo: string
      path: string
      message: string
      content: string
      branch: string
      sha?: string
    } = {
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      path: path,
      message: message,
      content: encodedContent,
      branch: this.config.branch
    }

    if (sha) {
      params.sha = sha
    }

    const response = await this.octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', params)
    
    return { sha: response.data.content?.sha || '' }
  }

  // Delete file from GitHub repo
  async deleteFile(path: string, sha: string, message: string): Promise<void> {
    if (!this.octokit || !this.config) {
      throw new Error('GitHub API not configured')
    }

    await this.octokit.request('DELETE /repos/{owner}/{repo}/contents/{path}', {
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      path: path,
      message: message,
      sha: sha,
      branch: this.config.branch
    })
  }

  // List files in directory
  async listDirectory(path: string): Promise<Array<{ name: string; path: string; type: string; sha: string }>> {
    if (!this.octokit || !this.config) {
      throw new Error('GitHub API not configured')
    }

    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner: this.config.repoOwner,
        repo: this.config.repoName,
        path: path,
        ref: this.config.branch
      })

      if (Array.isArray(response.data)) {
        return response.data.map((item: { name: string; path: string; type: string; sha: string }) => ({
          name: item.name,
          path: item.path,
          type: item.type,
          sha: item.sha
        }))
      }
      return []
    } catch (error: unknown) {
      if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
        return []
      }
      throw error
    }
  }

  // Get pipeline configuration
  async getPipelineConfig(): Promise<{ config: PipelineConfig; sha: string } | null> {
    if (!this.config) {
      throw new Error('GitHub API not configured')
    }

    const result = await this.getFileContent(this.config.pipelinePath)
    if (result) {
      try {
        const config = JSON.parse(result.content) as PipelineConfig
        return { config, sha: result.sha }
      } catch {
        console.error('Failed to parse pipeline config')
        return null
      }
    }
    return null
  }

  // Save pipeline configuration
  async savePipelineConfig(config: PipelineConfig, sha?: string): Promise<{ sha: string }> {
    if (!this.config) {
      throw new Error('GitHub API not configured')
    }

    const content = JSON.stringify(config, null, 2)
    return this.saveFileContent(
      this.config.pipelinePath,
      content,
      `Update pipeline configuration - ${new Date().toISOString()}`,
      sha
    )
  }

  // Get individual step prompt from steps folder
  async getStepPrompt(stepId: string): Promise<{ content: string; sha: string } | null> {
    const path = `steps/${stepId}.txt`
    return this.getFileContent(path)
  }

  // Save individual step prompt to steps folder
  async saveStepPrompt(stepId: string, content: string, sha?: string): Promise<{ sha: string }> {
    const path = `steps/${stepId}.txt`
    return this.saveFileContent(
      path,
      content,
      `Update ${stepId} prompt - ${new Date().toISOString()}`,
      sha
    )
  }

  // Delete step prompt
  async deleteStepPrompt(stepId: string, sha: string): Promise<void> {
    const path = `steps/${stepId}.txt`
    return this.deleteFile(path, sha, `Delete ${stepId} prompt`)
  }

  // Test connection
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.octokit || !this.config) {
      return { success: false, message: 'API not configured' }
    }

    try {
      await this.octokit.request('GET /repos/{owner}/{repo}', {
        owner: this.config.repoOwner,
        repo: this.config.repoName
      })
      return { success: true, message: 'Connection successful' }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, message }
    }
  }
}

// Singleton instance
let githubApiService: GitHubApiService | null = null

export function getGitHubApiService(): GitHubApiService {
  if (!githubApiService) {
    githubApiService = new GitHubApiService()
  }
  return githubApiService
}

export function initializeGitHubApiService(config: GitHubAdminConfig): GitHubApiService {
  const service = getGitHubApiService()
  service.setConfig(config)
  return service
}
