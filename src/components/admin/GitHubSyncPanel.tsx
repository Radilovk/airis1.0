/**
 * GitHub Sync Panel
 * UI for syncing editor mode changes to GitHub repository
 */

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  GitBranch, 
  CloudArrowUp, 
  Download, 
  CheckCircle, 
  Warning,
  Info,
  Key,
  FileCode
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import type { EditorModeConfig } from '@/types'
import type { EditableElementsConfig } from '@/hooks/use-editable-elements'
import { 
  generateCodeFromEditorConfig, 
  generateChangesSummary,
  generatePatchFile,
  exportEditorConfig,
  type CodeGenerationResult
} from '@/lib/editor-code-generator'
import { 
  GitHubRepoSync,
  detectGitHubRepo,
  getGitHubToken,
  saveGitHubToken,
  clearGitHubToken
} from '@/lib/github-sync'

export default function GitHubSyncPanel() {
  const [editorConfig] = useKVWithFallback<EditorModeConfig>('editor-mode-config', {
    enabled: false,
    moduleOrder: [],
    lastModified: new Date().toISOString()
  })
  
  const [elementsConfig] = useKVWithFallback<any>('editable-elements-config', {})
  
  const [githubToken, setGithubToken] = useState(getGitHubToken() || '')
  const [commitMessage, setCommitMessage] = useState('Update from Editor Mode')
  const [prTitle, setPrTitle] = useState('Editor Mode Updates')
  const [prDescription, setPrDescription] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<any>(null)
  const [previewChanges, setPreviewChanges] = useState<CodeGenerationResult[]>([])
  const [showPreview, setShowPreview] = useState(false)

  const repoInfo = detectGitHubRepo()
  const hasToken = !!githubToken

  const handleSaveToken = () => {
    if (githubToken.trim()) {
      saveGitHubToken(githubToken)
      toast.success('GitHub token saved')
    }
  }

  const handleClearToken = () => {
    clearGitHubToken()
    setGithubToken('')
    toast.success('GitHub token cleared')
  }

  const handleGeneratePreview = () => {
    try {
      const changes = generateCodeFromEditorConfig(editorConfig!, elementsConfig)
      setPreviewChanges(changes)
      setShowPreview(true)
      toast.success(`Generated ${changes.length} file changes`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to generate preview: ${errorMessage}`)
    }
  }

  const handleDownloadPatch = () => {
    try {
      const changes = generateCodeFromEditorConfig(editorConfig!, elementsConfig)
      const patch = generatePatchFile(changes)
      
      const blob = new Blob([patch], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `editor-mode-changes-${Date.now()}.patch`
      link.click()
      URL.revokeObjectURL(url)
      
      toast.success('Patch file downloaded')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to download patch: ${errorMessage}`)
    }
  }

  const handleDownloadConfig = () => {
    try {
      const configJson = exportEditorConfig(editorConfig!, elementsConfig)
      
      const blob = new Blob([configJson], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `editor-config-${Date.now()}.json`
      link.click()
      URL.revokeObjectURL(url)
      
      toast.success('Configuration downloaded')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to download config: ${errorMessage}`)
    }
  }

  const handleCommitToRepo = async () => {
    if (!hasToken || !repoInfo) {
      toast.error('GitHub token is required')
      return
    }

    setIsSyncing(true)
    try {
      const changes = generateCodeFromEditorConfig(editorConfig!, elementsConfig)
      const sync = new GitHubRepoSync({
        ...repoInfo,
        token: githubToken,
      })

      const result = await sync.commitChanges(changes, commitMessage)
      setLastSyncResult(result)

      if (result.success) {
        toast.success('Changes committed to repository!')
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Sync failed: ${errorMessage}`)
      setLastSyncResult({
        success: false,
        message: errorMessage,
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleCreatePR = async () => {
    if (!hasToken || !repoInfo) {
      toast.error('GitHub token is required')
      return
    }

    setIsSyncing(true)
    try {
      const changes = generateCodeFromEditorConfig(editorConfig!, elementsConfig)
      const summary = generateChangesSummary(editorConfig!, elementsConfig)
      
      const sync = new GitHubRepoSync({
        ...repoInfo,
        token: githubToken,
      })

      const fullDescription = prDescription + '\n\n' + summary

      const result = await sync.createPullRequest(changes, prTitle, fullDescription)
      setLastSyncResult(result)

      if (result.success) {
        toast.success('Pull request created!', {
          action: result.pullRequestUrl ? {
            label: 'Open PR',
            onClick: () => window.open(result.pullRequestUrl, '_blank')
          } : undefined
        })
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to create PR: ${errorMessage}`)
      setLastSyncResult({
        success: false,
        message: errorMessage,
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const totalChanges = useMemo(() => {
    return Object.keys(elementsConfig).reduce((sum, moduleId) => {
      return sum + Object.keys(elementsConfig[moduleId] || {}).length
    }, 0)
  }, [elementsConfig])

  const totalComments = useMemo(() => {
    return Object.keys(elementsConfig).reduce((sum, moduleId) => {
      const module = elementsConfig[moduleId] || {}
      return sum + Object.values(module).reduce((s: number, el: any) => {
        return s + (el.comments?.filter((c: any) => !c.resolved).length || 0)
      }, 0)
    }, 0)
  }, [elementsConfig])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch size={20} className="text-primary" />
            Синхронизация с GitHub Repository
          </CardTitle>
          <CardDescription>
            Приложете промените от Editor Mode директно в кода на repository
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Repository Info */}
          {repoInfo && (
            <Alert>
              <Info size={16} />
              <AlertDescription>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Repository:</span>
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">
                    {repoInfo.owner}/{repoInfo.repo}
                  </code>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* GitHub Token Configuration */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Key size={16} />
              GitHub Personal Access Token
            </Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSaveToken} variant="outline" size="sm">
                Запази
              </Button>
              {hasToken && (
                <Button onClick={handleClearToken} variant="ghost" size="sm">
                  Изчисти
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Необходими permissions: <code>repo</code> за достъп до repository
            </p>
          </div>

          <Separator />

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <FileCode size={24} className="mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{totalChanges}</p>
                <p className="text-xs text-muted-foreground">Променени елементи</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Warning size={24} className="mx-auto mb-2 text-orange-500" />
                <p className="text-2xl font-bold">{totalComments}</p>
                <p className="text-xs text-muted-foreground">Активни коментари</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <CheckCircle size={24} className="mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold">{editorConfig?.moduleOrder.length || 0}</p>
                <p className="text-xs text-muted-foreground">Модули</p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button 
                onClick={handleGeneratePreview}
                variant="outline"
                className="flex-1"
              >
                <FileCode size={16} className="mr-2" />
                Преглед на Промените
              </Button>
              <Button 
                onClick={handleDownloadPatch}
                variant="outline"
                className="flex-1"
              >
                <Download size={16} className="mr-2" />
                Свали като Patch
              </Button>
              <Button 
                onClick={handleDownloadConfig}
                variant="outline"
                className="flex-1"
              >
                <Download size={16} className="mr-2" />
                Свали Config
              </Button>
            </div>

            {hasToken && (
              <>
                <div className="space-y-2">
                  <Label>Commit Message</Label>
                  <Input
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Update from Editor Mode"
                  />
                </div>

                <Button 
                  onClick={handleCommitToRepo}
                  disabled={isSyncing || !hasToken}
                  className="w-full"
                  size="lg"
                >
                  <CloudArrowUp size={20} className="mr-2" />
                  {isSyncing ? 'Синхронизира...' : 'Commit Промените Директно'}
                </Button>

                <div className="space-y-2">
                  <Label>Pull Request Title</Label>
                  <Input
                    value={prTitle}
                    onChange={(e) => setPrTitle(e.target.value)}
                    placeholder="Editor Mode Updates"
                  />
                  
                  <Label>Pull Request Description</Label>
                  <Textarea
                    value={prDescription}
                    onChange={(e) => setPrDescription(e.target.value)}
                    placeholder="Опишете промените..."
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleCreatePR}
                  disabled={isSyncing || !hasToken}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <GitBranch size={20} className="mr-2" />
                  {isSyncing ? 'Създава PR...' : 'Създай Pull Request'}
                </Button>
              </>
            )}

            {!hasToken && (
              <Alert>
                <Warning size={16} />
                <AlertDescription>
                  Въведете GitHub token за да активирате синхронизацията
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Last Sync Result */}
          {lastSyncResult && (
            <Alert variant={lastSyncResult.success ? 'default' : 'destructive'}>
              {lastSyncResult.success ? <CheckCircle size={16} /> : <Warning size={16} />}
              <AlertDescription>
                <p className="font-medium">{lastSyncResult.message}</p>
                {lastSyncResult.commitSha && (
                  <p className="text-xs mt-1">
                    Commit SHA: <code>{lastSyncResult.commitSha.substring(0, 8)}</code>
                  </p>
                )}
                {lastSyncResult.pullRequestUrl && (
                  <a 
                    href={lastSyncResult.pullRequestUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs underline mt-1 block"
                  >
                    Виж Pull Request
                  </a>
                )}
                {lastSyncResult.error && (
                  <p className="text-xs mt-1">Error: {lastSyncResult.error}</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Preview Changes */}
      {showPreview && previewChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Преглед на Генерирания Код</CardTitle>
            <CardDescription>
              Промените, които ще бъдат приложени в repository
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewChanges.map((change, idx) => (
              <Card key={idx} className="bg-muted/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono">{change.filePath}</code>
                    <Badge variant="outline">{change.description}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs overflow-auto max-h-96 p-4 bg-background rounded border">
                    {change.generatedCode}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
