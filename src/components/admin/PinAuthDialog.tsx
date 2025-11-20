import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Key, X } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface PinAuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const ADMIN_PIN = '6131'

export default function PinAuthDialog({ open, onOpenChange, onSuccess }: PinAuthDialogProps) {
  const [pin, setPin] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!pin) {
      toast.error('Моля, въведете PIN код')
      return
    }

    setIsVerifying(true)

    // Simulate verification delay
    setTimeout(() => {
      if (pin === ADMIN_PIN) {
        toast.success('Достъп разрешен')
        onSuccess()
        setPin('')
        onOpenChange(false)
      } else {
        toast.error('Грешен PIN код')
        setPin('')
      }
      setIsVerifying(false)
    }, 300)
  }

  const handleCancel = () => {
    setPin('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Вход в административен панел
          </DialogTitle>
          <DialogDescription>
            Моля, въведете PIN код за достъп до настройките
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">PIN код</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              disabled={isVerifying}
              autoFocus
              className="text-center text-2xl tracking-widest"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isVerifying}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Откажи
            </Button>
            <Button
              type="submit"
              disabled={isVerifying || pin.length !== 4}
              className="flex-1"
            >
              <Key className="w-4 h-4 mr-2" />
              {isVerifying ? 'Проверка...' : 'Вход'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
