import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Camera, Upload, CheckCircle, ArrowRight, X, Crop } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import IrisCropEditor from '@/components/iris/IrisCropEditor'
import { errorLogger } from '@/lib/error-logger'
import type { IrisImage } from '@/types'

interface ImageUploadScreenProps {
  onComplete: (left: IrisImage, right: IrisImage) => void
  initialLeft?: IrisImage | null
  initialRight?: IrisImage | null
}

export default function ImageUploadScreen({ onComplete, initialLeft = null, initialRight = null }: ImageUploadScreenProps) {
  const [leftImage, setLeftImage] = useState<IrisImage | null>(initialLeft)
  const [rightImage, setRightImage] = useState<IrisImage | null>(initialRight)
  const [editingSide, setEditingSide] = useState<'left' | 'right' | null>(null)
  const [tempImageData, setTempImageData] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const isMountedRef = useRef(true)
  
  const leftInputRef = useRef<HTMLInputElement>(null)
  const rightInputRef = useRef<HTMLInputElement>(null)
  const fileReaderRef = useRef<FileReader | null>(null)

  useEffect(() => {
    errorLogger.info('UPLOAD_MOUNT', 'ImageUploadScreen mounted')
    isMountedRef.current = true
    return () => {
      errorLogger.info('UPLOAD_UNMOUNT', 'ImageUploadScreen unmounting')
      isMountedRef.current = false
      if (fileReaderRef.current) {
        try {
          fileReaderRef.current.abort()
        } catch (e) {
          errorLogger.warning('UPLOAD_CLEANUP', 'FileReader abort warning', e)
        }
      }
    }
  }, [])

  const compressImage = async (dataUrl: string, maxWidth: number = 400, quality: number = 0.55): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
          
          canvas.width = width
          canvas.height = height
          
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Не може да се създаде canvas context'))
            return
          }
          
          ctx.drawImage(img, 0, 0, width, height)
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality)
          
          console.log(`📸 [COMPRESS] Компресия: ${Math.round(dataUrl.length / 1024)} KB -> ${Math.round(compressedDataUrl.length / 1024)} KB`)
          
          resolve(compressedDataUrl)
        } catch (error) {
          console.error('❌ [COMPRESS] Грешка при компресия:', error)
          reject(error)
        }
      }
      img.onerror = () => {
        console.error('❌ [COMPRESS] Грешка при зареждане на изображението')
        reject(new Error('Грешка при зареждане на изображението'))
      }
      img.src = dataUrl
    })
  }

  const handleFileSelect = async (side: 'left' | 'right', file: File) => {
    if (!file) {
      console.warn('Няма избран файл')
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Моля, качете изображение')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Файлът е твърде голям. Максимум 10MB.')
      return
    }

    console.log(`Стартиране на обработка на файл: ${file.name}, размер: ${Math.round(file.size / 1024)} KB`)
    setIsProcessing(true)

    if (fileReaderRef.current) {
      try {
        fileReaderRef.current.abort()
      } catch (e) {
        console.warn('Не може да се прекъсне предишно четене')
      }
    }

    const reader = new FileReader()
    fileReaderRef.current = reader

    reader.onload = async (e) => {
      if (!isMountedRef.current) {
        console.warn('Компонентът е unmounted, прекъсване')
        return
      }
      
      try {
        const result = e.target?.result
        if (!result || typeof result !== 'string') {
          throw new Error('Невалиден резултат от четене на файла')
        }
        
        const dataUrl = result as string
        if (!dataUrl.startsWith('data:image/')) {
          throw new Error('Невалиден формат на изображението')
        }

        console.log(`📸 [UPLOAD] Оригинален размер на изображението: ${Math.round(dataUrl.length / 1024)} KB`)
        
        let compressedDataUrl = await compressImage(dataUrl, 400, 0.55)
        
        console.log(`📸 [UPLOAD] Компресиран размер (1st pass): ${Math.round(compressedDataUrl.length / 1024)} KB`)
        
        if (compressedDataUrl.length > 120 * 1024) {
          console.warn('⚠️ [UPLOAD] Изображението е все още голямо, допълнителна компресия...')
          compressedDataUrl = await compressImage(compressedDataUrl, 350, 0.45)
          console.log(`📸 [UPLOAD] Допълнително компресиран (2nd pass): ${Math.round(compressedDataUrl.length / 1024)} KB`)
        }
        
        if (compressedDataUrl.length > 150 * 1024) {
          console.error('❌ [UPLOAD] Изображението е твърде голямо дори след компресия!')
          toast.error('Изображението е твърде голямо. Моля, опитайте с по-малка снимка.')
          setIsProcessing(false)
          return
        }
        
        if (!isMountedRef.current) {
          console.warn('⚠️ [UPLOAD] Компонентът е unmounted, прекъсване')
          return
        }

        console.log(`✅ [UPLOAD] Изображението е готово за crop редактиране`)
        setTempImageData(compressedDataUrl)
        setEditingSide(side)
        setIsProcessing(false)
      } catch (error) {
        console.error('Грешка при обработка на изображението:', error)
        toast.error('Грешка при обработка на изображението')
        setIsProcessing(false)
      }
    }

    reader.onerror = (error) => {
      console.error('Грешка при четене на файла:', error)
      toast.error('Грешка при четене на файла')
      setIsProcessing(false)
    }

    reader.onabort = () => {
      console.log('Четенето е прекъснато')
      setIsProcessing(false)
    }

    try {
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Грешка при стартиране на четене:', error)
      toast.error('Грешка при зареждане на изображението')
      setIsProcessing(false)
    }
  }

  const handleCropSave = async (croppedDataUrl: string) => {
    console.log('✂️ [UPLOAD] handleCropSave() извикан')
    console.log(`📊 [UPLOAD] editingSide: ${editingSide}`)
    
    if (!editingSide) {
      console.warn('⚠️ [UPLOAD] Липсва информация за страна на ириса')
      toast.error('Грешка: Липсва информация за страна')
      return
    }
    
    if (!isMountedRef.current) {
      console.warn('⚠️ [UPLOAD] Компонентът е unmounted, прекъсване')
      return
    }
    
    try {
      console.log('🔍 [UPLOAD] Валидация на crop данни...')
      if (!croppedDataUrl || typeof croppedDataUrl !== 'string') {
        throw new Error('Невалидни данни от crop редактора')
      }

      if (!croppedDataUrl.startsWith('data:image/')) {
        throw new Error('Невалиден формат на обработеното изображение')
      }
      
      console.log(`📊 [UPLOAD] Размер на cropped изображение преди компресия: ${Math.round(croppedDataUrl.length / 1024)} KB`)
      console.log('🗜️ [UPLOAD] Започване на агресивна компресия...')
      
      let finalImage = await compressImage(croppedDataUrl, 400, 0.55)
      console.log(`📊 [UPLOAD] Размер след 1st pass: ${Math.round(finalImage.length / 1024)} KB`)
      
      if (finalImage.length > 120 * 1024) {
        console.warn('⚠️ [UPLOAD] Допълнителна компресия (2nd pass)...')
        finalImage = await compressImage(finalImage, 350, 0.45)
        console.log(`📊 [UPLOAD] Размер след 2nd pass: ${Math.round(finalImage.length / 1024)} KB`)
      }
      
      if (finalImage.length > 150 * 1024) {
        console.error('❌ [UPLOAD] Изображението е твърде голямо дори след агресивна компресия!')
        toast.error('Изображението е твърде голямо. Моля, опитайте с по-малка снимка.')
        setEditingSide(null)
        setTempImageData(null)
        setIsProcessing(false)
        return
      }
      
      if (!isMountedRef.current) {
        console.warn('⚠️ [UPLOAD] Компонентът е unmounted след компресия, прекъсване')
        return
      }
      
      const image: IrisImage = { dataUrl: finalImage, side: editingSide }
      const savedSide = editingSide
      
      console.log(`💾 [UPLOAD] Запазване на ${savedSide} ирис (финален размер: ${Math.round(finalImage.length / 1024)} KB)...`)
      setTempImageData(null)
      setEditingSide(null)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (savedSide === 'left') {
        console.log('💾 [UPLOAD] Запазване на ляв ирис в state...')
        setLeftImage(image)
      } else {
        console.log('💾 [UPLOAD] Запазване на десен ирис в state...')
        setRightImage(image)
      }
      
      setIsProcessing(false)
      console.log(`✅ [UPLOAD] ${savedSide === 'left' ? 'Ляв' : 'Десен'} ирис запазен успешно`)
      
      toast.success(`${savedSide === 'left' ? 'Ляв' : 'Десен'} ирис запазен успешно`)
    } catch (error) {
      console.error('❌ [UPLOAD] ГРЕШКА при запазване на изображението:', error)
      errorLogger.error('UPLOAD_CROP_SAVE', 'Error in handleCropSave', error as Error, {
        editingSide,
        isMounted: isMountedRef.current
      })
      toast.error('Грешка при запазване на изображението')
      setEditingSide(null)
      setTempImageData(null)
      setIsProcessing(false)
    }
  }

  const handleCropCancel = () => {
    setEditingSide(null)
    setTempImageData(null)
    setIsProcessing(false)
  }

  const handleEditImage = (side: 'left' | 'right') => {
    const image = side === 'left' ? leftImage : rightImage
    if (!image) return
    
    setTempImageData(image.dataUrl)
    setEditingSide(side)
  }

  const handleDrop = (side: 'left' | 'right', e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(side, file)
    }
  }

  const handleNext = async () => {
    errorLogger.info('UPLOAD_NEXT', 'handleNext() called', {
      leftImage: !!leftImage,
      rightImage: !!rightImage,
      isProcessing,
      editingSide,
      isSaving
    })
    
    if (!leftImage || !rightImage) {
      errorLogger.warning('UPLOAD_NEXT', 'Missing images')
      toast.error('Моля, качете и двете снимки')
      return
    }
    
    if (isProcessing) {
      errorLogger.warning('UPLOAD_NEXT', 'Still processing image')
      toast.error('Моля, изчакайте обработката да завърши')
      return
    }
    
    if (editingSide !== null) {
      errorLogger.warning('UPLOAD_NEXT', 'Still editing image')
      toast.error('Моля, завършете редакцията на текущото изображение')
      return
    }
    
    if (isSaving) {
      errorLogger.warning('UPLOAD_NEXT', 'Already saving, ignoring duplicate call')
      return
    }
    
    try {
      errorLogger.info('UPLOAD_NEXT', 'Starting save process')
      setIsSaving(true)
      
      errorLogger.info('UPLOAD_NEXT', 'Validating images', {
        leftSize: Math.round(leftImage.dataUrl.length / 1024),
        rightSize: Math.round(rightImage.dataUrl.length / 1024)
      })
      
      if (!leftImage.dataUrl || !rightImage.dataUrl) {
        throw new Error('Липсват данни за изображенията')
      }
      
      if (!leftImage.dataUrl.startsWith('data:image/') || !rightImage.dataUrl.startsWith('data:image/')) {
        throw new Error('Невалиден формат на изображенията')
      }
      
      errorLogger.info('UPLOAD_NEXT', 'Validation successful, calling onComplete')
      onComplete(leftImage, rightImage)
      errorLogger.info('UPLOAD_NEXT', 'onComplete() called successfully')
    } catch (error) {
      errorLogger.error('UPLOAD_NEXT', 'Error during next transition', error as Error)
      toast.error('Грешка при преминаване към анализ')
      setIsSaving(false)
    }
  }

  const removeImage = (side: 'left' | 'right') => {
    if (side === 'left') {
      setLeftImage(null)
    } else {
      setRightImage(null)
    }
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="max-w-4xl w-full">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Camera size={32} weight="duotone" className="text-primary" />
            </div>
            <h2 className="text-3xl font-bold mb-2">Качване на Снимки</h2>
            <p className="text-muted-foreground">
              Качете ясни снимки на левия и десния си ирис
            </p>
          </motion.div>

          <Card className="p-6 mb-6 bg-secondary/30">
            <h3 className="font-semibold mb-3">📋 Инструкции за качествени снимки:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Осигурете добро осветление - естествена светлина е най-добра</li>
              <li>• Заснемете отблизо, за да се вижда ириса ясно</li>
              <li>• Уверете се, че снимката е фокусирана и не е замъглена</li>
              <li>• Избягвайте отражения и сенки</li>
              <li>• След качване, позиционирайте ириса в редактора</li>
            </ul>
          </Card>

          {isProcessing && (
            <Card className="p-4 mb-6 bg-primary/10">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
                <p className="text-sm font-medium">Обработка на изображението...</p>
              </div>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-6">
                <Label className="text-lg font-semibold mb-4 block">Ляв Ирис</Label>
                
                {!leftImage ? (
                  <div
                    className={`border-2 border-dashed border-border rounded-lg p-8 text-center transition-colors ${
                      isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary hover:bg-muted/50'
                    }`}
                    onDrop={(e) => !isProcessing && handleDrop('left', e)}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => !isProcessing && leftInputRef.current?.click()}
                  >
                    <Upload size={48} weight="duotone" className="mx-auto mb-4 text-muted-foreground" />
                    <p className="font-medium mb-2">Кликнете или пуснете снимка</p>
                    <p className="text-sm text-muted-foreground">PNG, JPG до 10MB</p>
                    <input
                      ref={leftInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                      disabled={isProcessing}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleFileSelect('left', file)
                          e.target.value = ''
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="relative group">
                    <img
                      src={leftImage.dataUrl}
                      alt="Ляв ирис"
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleEditImage('left')}
                        className="gap-2"
                      >
                        <Crop size={16} />
                        Редактирай
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeImage('left')}
                        className="gap-2"
                      >
                        <X size={16} />
                        Премахни
                      </Button>
                    </div>
                    <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-2">
                      <CheckCircle size={20} weight="fill" />
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-6">
                <Label className="text-lg font-semibold mb-4 block">Десен Ирис</Label>
                
                {!rightImage ? (
                  <div
                    className={`border-2 border-dashed border-border rounded-lg p-8 text-center transition-colors ${
                      isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary hover:bg-muted/50'
                    }`}
                    onDrop={(e) => !isProcessing && handleDrop('right', e)}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => !isProcessing && rightInputRef.current?.click()}
                  >
                    <Upload size={48} weight="duotone" className="mx-auto mb-4 text-muted-foreground" />
                    <p className="font-medium mb-2">Кликнете або пуснете снимка</p>
                    <p className="text-sm text-muted-foreground">PNG, JPG до 10MB</p>
                    <input
                      ref={rightInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                      disabled={isProcessing}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleFileSelect('right', file)
                          e.target.value = ''
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="relative group">
                    <img
                      src={rightImage.dataUrl}
                      alt="Десен ирис"
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleEditImage('right')}
                        className="gap-2"
                      >
                        <Crop size={16} />
                        Редактирай
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeImage('right')}
                        className="gap-2"
                      >
                        <X size={16} />
                        Премахни
                      </Button>
                    </div>
                    <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-2">
                      <CheckCircle size={20} weight="fill" />
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex justify-end"
          >
            <Button
              size="lg"
              onClick={handleNext}
              disabled={!leftImage || !rightImage || isProcessing || editingSide !== null || isSaving}
              className="gap-2"
            >
              {isSaving ? 'Запазване...' : 'Започни Анализ'}
              <ArrowRight size={20} weight="bold" />
            </Button>
          </motion.div>
        </div>
      </div>

      {editingSide && tempImageData && !isProcessing && (
        <IrisCropEditor
          imageDataUrl={tempImageData}
          side={editingSide}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}
    </>
  )
}
