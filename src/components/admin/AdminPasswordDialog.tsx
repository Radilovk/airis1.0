import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Key } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface AdminPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const ADMIN_PASSWORD = '6131'

export default function AdminPasswordDialog({ open, onOpenChange, onSuccess }: AdminPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simple password check
    if (password === ADMIN_PASSWORD) {
      toast.success('✓ Достъп разрешен', {
        description: 'Добре дошли в административния панел'
      })
      onOpenChange(false)
      onSuccess()
      setPassword('')
    } else {
      toast.error('❌ Грешна парола', {
        description: 'Моля, опитайте отново'
      })
    }

    setIsLoading(false)
  }

  const handleCancel = () => {
    setPassword('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Административен достъп
          </DialogTitle>
          <DialogDescription>
            Въведете паролата за достъп до административния панел
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="admin-password">
                Парола
              </Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="Въведете парола"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Отказ
            </Button>
            <Button type="submit" disabled={isLoading || !password}>
              {isLoading ? 'Проверка...' : 'Вход'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
