import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Camera, Upload, CheckCircle, ArrowRight, X, Crop } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import IrisCropEditor from '@/components/iris/IrisCropEditor'
import { errorLogger } from '@/lib/error-logger'
import { uploadDiagnostics } from '@/lib/upload-diagnostics'
import type { IrisImage } from '@/types'

// Compression and size limit constants
// Iris images need ≥1600px width to preserve fine medical detail (lacunae, crypts, radial lines).
// Shared with IrisCropEditor – keep in sync.
export const IRIS_MAX_DIMENSION = 1600
const SECOND_PASS_THRESHOLD_BYTES = 3 * 1024 * 1024 // 3 MB – only re-compress truly large files
const MAX_FINAL_SIZE_BYTES = 5 * 1024 * 1024        // 5 MB – supports 1600px JPEG at q=0.92
const MAX_FINAL_SIZE_KB = 5120

interface ImageUploadScreenProps {
  onComplete: (left: IrisImage, right: IrisImage) => void
  initialLeft?: IrisImage | null
  initialRight?: IrisImage | null
  isReanalysis?: boolean
}

export default function ImageUploadScreen({ onComplete, initialLeft = null, initialRight = null, isReanalysis = false }: ImageUploadScreenProps) {
  const leftImageRef = useRef<IrisImage | null>(initialLeft)
  const rightImageRef = useRef<IrisImage | null>(initialRight)
  const [imagesVersion, setImagesVersion] = useState(0)
  const [editingSide, setEditingSide] = useState<'left' | 'right' | null>(null)
  const [tempImageData, setTempImageData] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const isMountedRef = useRef(true)
  
  const leftInputRef = useRef<HTMLInputElement>(null)
  const rightInputRef = useRef<HTMLInputElement>(null)
  const fileReaderRef = useRef<FileReader | null>(null)

  useEffect(() => {
    const environment = window.location.hostname.includes('preview') ? 'PREVIEW' : 
                       window.location.hostname.includes('localhost') ? 'LOCAL' : 'PRODUCTION'
    console.log(`🌍 [UPLOAD] Environment: ${environment}`)
    console.log(`🌍 [UPLOAD] Hostname: ${window.location.hostname}`)
    
    uploadDiagnostics.startSession()
    uploadDiagnostics.log('COMPONENT_MOUNT', 'info', { 
      component: 'ImageUploadScreen',
      environment,
      hostname: window.location.hostname
    })
    errorLogger.info('UPLOAD_MOUNT', 'ImageUploadScreen mounted', {
      environment,
      hostname: window.location.hostname
    })
    isMountedRef.current = true
    return () => {
      uploadDiagnostics.log('COMPONENT_UNMOUNT', 'info', { component: 'ImageUploadScreen' })
      uploadDiagnostics.endSession()
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

  const compressImage = async (dataUrl: string, maxWidth: number = IRIS_MAX_DIMENSION, quality: number = 0.92): Promise<string> => {
    const startTime = performance.now()
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        try {
          const originalWidth = img.width
          const originalHeight = img.height
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
          
          canvas.width = width
          canvas.height = height
          
          const ctx = canvas.getContext('2d', { alpha: false })
          if (!ctx) {
            reject(new Error('Не може да се създаде canvas context'))
            return
          }
          
          // Enable high-quality image smoothing for better resizing
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          
          // Fill with white background for better JPEG compression
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, width, height)
          
          ctx.drawImage(img, 0, 0, width, height)
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality)
          const endTime = performance.now()
          const duration = Math.round(endTime - startTime)
          
          const inputSizeKB = Math.round(dataUrl.length / 1024)
          const outputSizeKB = Math.round(compressedDataUrl.length / 1024)
          const reductionPercent = Math.round(((inputSizeKB - outputSizeKB) / inputSizeKB) * 100)
          
          console.log(`📸 [COMPRESS] ========== Compression Details ==========`)
          console.log(`📸 [COMPRESS] Dimensions: ${originalWidth}×${originalHeight} → ${width}×${height}`)
          console.log(`📸 [COMPRESS] Quality: ${quality}`)
          console.log(`📸 [COMPRESS] Size: ${inputSizeKB} KB → ${outputSizeKB} KB (${reductionPercent}% reduction)`)
          console.log(`📸 [COMPRESS] Duration: ${duration}ms`)
          console.log(`📸 [COMPRESS] ================================================`)
          
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
    uploadDiagnostics.log('FILE_SELECT_START', 'start', {
      side,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    })

    if (!file) {
      uploadDiagnostics.log('FILE_SELECT_ERROR', 'error', { reason: 'No file selected' })
      console.warn('Няма избран файл')
      return
    }

    if (!file.type.startsWith('image/')) {
      uploadDiagnostics.log('FILE_SELECT_ERROR', 'error', {
        reason: 'Invalid file type',
        fileType: file.type
      })
      toast.error('Моля, качете изображение')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      uploadDiagnostics.log('FILE_SELECT_ERROR', 'error', {
        reason: 'File too large',
        fileSize: file.size,
        maxSize: 10 * 1024 * 1024
      })
      toast.error('Файлът е твърде голям. Максимум 10MB.')
      return
    }

    console.log(`Стартиране на обработка на файл: ${file.name}, размер: ${Math.round(file.size / 1024)} KB`)
    uploadDiagnostics.log('FILE_PROCESSING_START', 'info', {
      fileName: file.name,
      fileSizeKB: Math.round(file.size / 1024)
    })
    setIsProcessing(true)

    if (fileReaderRef.current) {
      try {
        fileReaderRef.current.abort()
        uploadDiagnostics.log('FILE_READER_ABORT', 'info', { reason: 'Aborting previous read' })
      } catch (e) {
        console.warn('Не може да се прекъсне предишно четене')
        uploadDiagnostics.log('FILE_READER_ABORT_ERROR', 'warning', { error: e })
      }
    }

    const reader = new FileReader()
    fileReaderRef.current = reader
    uploadDiagnostics.log('FILE_READER_CREATED', 'info')

    reader.onload = async (e) => {
      uploadDiagnostics.log('FILE_READER_ONLOAD', 'start')
      
      if (!isMountedRef.current) {
        uploadDiagnostics.log('FILE_READER_ONLOAD_ABORT', 'warning', {
          reason: 'Component unmounted'
        })
        console.warn('Компонентът е unmounted, прекъсване')
        return
      }
      
      try {
        uploadDiagnostics.log('FILE_READER_RESULT_CHECK', 'info')
        const result = e.target?.result
        if (!result || typeof result !== 'string') {
          const error = new Error('Невалиден резултат от четене на файла')
          uploadDiagnostics.log('FILE_READER_INVALID_RESULT', 'error', {
            hasResult: !!result,
            resultType: typeof result
          }, error)
          throw error
        }
        
        const dataUrl = result as string
        if (!dataUrl.startsWith('data:image/')) {
          const error = new Error('Невалиден формат на изображението')
          uploadDiagnostics.log('FILE_READER_INVALID_FORMAT', 'error', {
            dataUrlStart: dataUrl.substring(0, 50)
          }, error)
          throw error
        }

        uploadDiagnostics.log('FILE_READER_SUCCESS', 'success', {
          dataUrlLength: dataUrl.length,
          dataUrlSizeKB: Math.round(dataUrl.length / 1024)
        })

        const originalSizeKB = Math.round(dataUrl.length / 1024)
        console.log(`📸 [UPLOAD] Оригинален размер на изображението: ${originalSizeKB} KB`)
        console.log(`📸 [UPLOAD] Оригинален файл: ${file.name}, тип: ${file.type}, размер: ${Math.round(file.size / 1024)} KB`)
        
        uploadDiagnostics.log('COMPRESS_START_1ST_PASS', 'start', {
          originalSizeKB,
          originalFileSize: Math.round(file.size / 1024),
          fileName: file.name,
          fileType: file.type,
          side
        })
        // First pass: High quality at max IRIS_MAX_DIMENSION – preserves iris detail for AI analysis
        let compressedDataUrl = await compressImage(dataUrl, IRIS_MAX_DIMENSION, 0.92)
        const afterFirstPassKB = Math.round(compressedDataUrl.length / 1024)
        uploadDiagnostics.log('COMPRESS_END_1ST_PASS', 'success', {
          compressedSizeKB: afterFirstPassKB,
          reductionPercent: Math.round(((originalSizeKB - afterFirstPassKB) / originalSizeKB) * 100)
        })
        
        console.log(`📸 [UPLOAD] Компресиран размер (1st pass): ${afterFirstPassKB} KB (намаление: ${Math.round(((originalSizeKB - afterFirstPassKB) / originalSizeKB) * 100)}%)`)
        
        // Second pass: Only if very large (>1MB), use slightly lower quality (0.88 = still very good quality)
        if (compressedDataUrl.length > SECOND_PASS_THRESHOLD_BYTES) {
          console.warn('⚠️ [UPLOAD] Изображението е все още голямо, допълнителна компресия...')
          uploadDiagnostics.log('COMPRESS_START_2ND_PASS', 'start', {
            currentSizeKB: afterFirstPassKB
          })
          compressedDataUrl = await compressImage(compressedDataUrl, IRIS_MAX_DIMENSION, 0.88)
          const afterSecondPassKB = Math.round(compressedDataUrl.length / 1024)
          uploadDiagnostics.log('COMPRESS_END_2ND_PASS', 'success', {
            finalSizeKB: afterSecondPassKB,
            totalReductionPercent: Math.round(((originalSizeKB - afterSecondPassKB) / originalSizeKB) * 100)
          })
          console.log(`📸 [UPLOAD] Допълнително компресиран (2nd pass): ${afterSecondPassKB} KB (общо намаление: ${Math.round(((originalSizeKB - afterSecondPassKB) / originalSizeKB) * 100)}%)`)
        }
        
        const finalSizeKB = Math.round(compressedDataUrl.length / 1024)
        console.log(`📸 [UPLOAD] ========== FINAL COMPRESSION RESULT ==========`)
        console.log(`📸 [UPLOAD] Original: ${originalSizeKB} KB → Final: ${finalSizeKB} KB`)
        console.log(`📸 [UPLOAD] Total reduction: ${Math.round(((originalSizeKB - finalSizeKB) / originalSizeKB) * 100)}%`)
        console.log(`📸 [UPLOAD] Checking against limit: ${finalSizeKB} KB vs ${MAX_FINAL_SIZE_KB} KB max`)
        
        // Allow up to 5MB – supports 1600px JPEG at q=0.92 for high-detail iris images
        if (compressedDataUrl.length > MAX_FINAL_SIZE_BYTES) {
          uploadDiagnostics.log('COMPRESS_ERROR_TOO_LARGE', 'error', {
            finalSizeKB,
            maxSizeKB: MAX_FINAL_SIZE_KB,
            originalSizeKB,
            fileName: file.name,
            fileType: file.type,
            side
          })
          console.error(`❌ [UPLOAD] Изображението е твърде голямо дори след компресия! (${finalSizeKB} KB > ${MAX_FINAL_SIZE_KB} KB)`)
          toast.error(`Изображението е твърде голямо (${finalSizeKB} KB). Моля, опитайте с по-малка снимка или по-ниска резолюция.`)
          setIsProcessing(false)
          return
        }
        
        console.log(`✅ [UPLOAD] Compression successful! Final size ${finalSizeKB} KB is within limit.`)
        
        if (!isMountedRef.current) {
          uploadDiagnostics.log('COMPONENT_UNMOUNTED_AFTER_COMPRESS', 'warning')
          console.warn('⚠️ [UPLOAD] Компонентът е unmounted, прекъсване')
          return
        }

        uploadDiagnostics.log('OPEN_CROP_EDITOR', 'success', {
          side,
          imageSizeKB: Math.round(compressedDataUrl.length / 1024)
        })
        console.log(`✅ [UPLOAD] Изображението е готово за crop редактиране`)
        setTempImageData(compressedDataUrl)
        setEditingSide(side)
        setIsProcessing(false)
      } catch (error) {
        uploadDiagnostics.log('FILE_PROCESSING_ERROR', 'error', {
          side,
          fileName: file.name,
          error: error instanceof Error ? error.message : String(error)
        }, error as Error)
        console.error('Грешка при обработка на изображението:', error)
        toast.error('Грешка при обработка на изображението')
        setIsProcessing(false)
      }
    }

    reader.onerror = (error) => {
      uploadDiagnostics.log('FILE_READER_ERROR', 'error', {
        side,
        fileName: file.name,
        error: reader.error?.message || 'Unknown error'
      }, reader.error || undefined)
      console.error('Грешка при четене на файла:', error)
      toast.error('Грешка при четене на файла')
      setIsProcessing(false)
    }

    reader.onabort = () => {
      uploadDiagnostics.log('FILE_READER_ABORTED', 'info', { side, fileName: file.name })
      console.log('Четенето е прекъснато')
      setIsProcessing(false)
    }

    try {
      uploadDiagnostics.log('FILE_READER_READ_START', 'start', {
        side,
        fileName: file.name
      })
      reader.readAsDataURL(file)
    } catch (error) {
      uploadDiagnostics.log('FILE_READER_READ_ERROR', 'error', {
        side,
        fileName: file.name,
        error: error instanceof Error ? error.message : String(error)
      }, error as Error)
      console.error('Грешка при стартиране на четене:', error)
      toast.error('Грешка при зареждане на изображението')
      setIsProcessing(false)
    }
  }

  const handleCropSave = async (croppedDataUrl: string) => {
    uploadDiagnostics.log('CROP_SAVE_START', 'start', {
      croppedDataUrlType: typeof croppedDataUrl,
      croppedDataUrlLength: croppedDataUrl?.length || 0,
      croppedDataUrlSizeKB: Math.round((croppedDataUrl?.length || 0) / 1024),
      editingSide,
      isMounted: isMountedRef.current
    })
    
    console.log('✂️ [UPLOAD] ========== handleCropSave CALLED ==========')
    console.log(`📊 [UPLOAD] croppedDataUrl type: ${typeof croppedDataUrl}`)
    console.log(`📊 [UPLOAD] croppedDataUrl length: ${croppedDataUrl?.length || 0}`)
    console.log(`📊 [UPLOAD] croppedDataUrl first 50 chars: ${croppedDataUrl?.substring(0, 50)}`)
    console.log(`📊 [UPLOAD] editingSide: ${editingSide}`)
    console.log(`📊 [UPLOAD] isMounted: ${isMountedRef.current}`)
    
    if (!editingSide) {
      uploadDiagnostics.log('CROP_SAVE_ERROR_NO_SIDE', 'error', {
        croppedDataUrlLength: croppedDataUrl?.length || 0
      })
      console.error('❌ [UPLOAD] CRITICAL: editingSide is null!')
      errorLogger.error('UPLOAD_CROP_SAVE', 'CRITICAL: editingSide is null!', undefined, {
        croppedDataUrlLength: croppedDataUrl?.length || 0,
        isMounted: isMountedRef.current
      })
      toast.error('Грешка: Липсва информация за страна')
      return
    }
    
    if (!croppedDataUrl || typeof croppedDataUrl !== 'string') {
      uploadDiagnostics.log('CROP_SAVE_ERROR_INVALID_DATA', 'error', {
        hasCroppedDataUrl: !!croppedDataUrl,
        type: typeof croppedDataUrl,
        editingSide
      })
      console.error('❌ [UPLOAD] CRITICAL: Invalid croppedDataUrl!')
      errorLogger.error('UPLOAD_CROP_SAVE', 'CRITICAL: Invalid croppedDataUrl!', undefined, {
        croppedDataUrl: !!croppedDataUrl,
        type: typeof croppedDataUrl,
        editingSide
      })
      toast.error('Грешка: Невалидни данни от crop редактора')
      return
    }
    
    if (!isMountedRef.current) {
      uploadDiagnostics.log('CROP_SAVE_ABORT_UNMOUNTED', 'warning')
      console.warn('⚠️ [UPLOAD] Component unmounted, aborting')
      return
    }
    
    setIsProcessing(true)
    
    try {
      uploadDiagnostics.log('CROP_SAVE_VALIDATION', 'start')
      console.log('🔍 [UPLOAD] Validating crop data...')
      
      if (!croppedDataUrl.startsWith('data:image/')) {
        const error = new Error('Невалиден формат на обработеното изображение (не е data URL)')
        uploadDiagnostics.log('CROP_SAVE_VALIDATION_INVALID_FORMAT', 'error', {
          dataUrlStart: croppedDataUrl.substring(0, 50)
        }, error)
        throw error
      }
      
      uploadDiagnostics.log('CROP_SAVE_VALIDATION_SUCCESS', 'success')
      
      console.log(`📊 [UPLOAD] Crop data size before compression: ${Math.round(croppedDataUrl.length / 1024)} KB`)
      console.log('🗜️ [UPLOAD] Starting high-quality compression (no visible loss)...')
      
      uploadDiagnostics.log('CROP_COMPRESS_1ST_PASS_START', 'start', {
        sizeBefore: Math.round(croppedDataUrl.length / 1024)
      })
      // First pass: High quality at IRIS_MAX_DIMENSION – preserves iris detail for AI analysis
      let finalImage = await compressImage(croppedDataUrl, IRIS_MAX_DIMENSION, 0.92)
      uploadDiagnostics.log('CROP_COMPRESS_1ST_PASS_SUCCESS', 'success', {
        sizeAfter: Math.round(finalImage.length / 1024)
      })
      console.log(`📊 [UPLOAD] Size after 1st pass: ${Math.round(finalImage.length / 1024)} KB`)

      // Allow up to 5MB – supports 1600px JPEG at q=0.92 for high-detail iris images
      if (finalImage.length > MAX_FINAL_SIZE_BYTES) {
        uploadDiagnostics.log('CROP_COMPRESS_ERROR_TOO_LARGE', 'error', {
          finalSize: Math.round(finalImage.length / 1024),
          maxSize: MAX_FINAL_SIZE_KB
        })
        console.error('❌ [UPLOAD] Image too large even after high-quality compression!')
        errorLogger.error('UPLOAD_CROP_SAVE', 'Image too large after compression', undefined, {
          finalSize: Math.round(finalImage.length / 1024),
          editingSide
        })
        toast.error(`Изображението е твърде голямо (${Math.round(finalImage.length / 1024)} KB). Моля, опитайте с по-малка снимка или по-ниска резолюция.`)
        setIsProcessing(false)
        setEditingSide(null)
        setTempImageData(null)
        return
      }
      
      if (!isMountedRef.current) {
        uploadDiagnostics.log('CROP_SAVE_ABORT_UNMOUNTED_AFTER_COMPRESS', 'warning')
        console.warn('⚠️ [UPLOAD] Component unmounted after compression, aborting')
        return
      }
      
      uploadDiagnostics.log('CREATE_IRIS_IMAGE_OBJECT', 'start', {
        side: editingSide,
        dataUrlLength: finalImage.length
      })
      
      const image: IrisImage = { 
        dataUrl: finalImage, 
        side: editingSide 
      }
      
      uploadDiagnostics.log('CREATE_IRIS_IMAGE_OBJECT_SUCCESS', 'success', {
        side: image.side,
        dataUrlLength: image.dataUrl.length,
        dataUrlSizeKB: Math.round(image.dataUrl.length / 1024)
      })
      
      console.log('✅ [UPLOAD] IrisImage object created:', {
        side: image.side,
        dataUrlLength: image.dataUrl.length,
        dataUrlType: typeof image.dataUrl,
        dataUrlStartsWith: image.dataUrl.substring(0, 20)
      })
      
      const savedSide = editingSide
      
      console.log(`💾 [UPLOAD] Saving ${savedSide} iris (final size: ${Math.round(finalImage.length / 1024)} KB)...`)
      console.log('🧹 [UPLOAD] Clearing temp data before saving to ref...')
      
      uploadDiagnostics.log('CLEAR_TEMP_DATA', 'info')
      setTempImageData(null)
      setEditingSide(null)
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      if (!isMountedRef.current) {
        uploadDiagnostics.log('CROP_SAVE_ABORT_UNMOUNTED_BEFORE_REF_SAVE', 'warning')
        console.warn('⚠️ [UPLOAD] Component unmounted before ref save, aborting')
        return
      }
      
      uploadDiagnostics.log('SAVE_TO_REF_START', 'start', {
        side: savedSide,
        imageSizeKB: Math.round(finalImage.length / 1024)
      })
      
      console.log(`💾 [UPLOAD] Setting ${savedSide} image in ref NOW...`)
      console.log(`📊 [UPLOAD] BEFORE REF UPDATE:`)
      console.log(`   leftImageRef.current: ${!!leftImageRef.current}`)
      console.log(`   rightImageRef.current: ${!!rightImageRef.current}`)
      
      if (savedSide === 'left') {
        console.log('💾 [UPLOAD] Setting leftImageRef.current...')
        leftImageRef.current = image
        uploadDiagnostics.log('SAVE_TO_REF_LEFT_SUCCESS', 'success', {
          dataUrlLength: image.dataUrl.length
        })
        console.log('✅ [UPLOAD] leftImageRef.current set')
      } else {
        console.log('💾 [UPLOAD] Setting rightImageRef.current...')
        rightImageRef.current = image
        uploadDiagnostics.log('SAVE_TO_REF_RIGHT_SUCCESS', 'success', {
          dataUrlLength: image.dataUrl.length
        })
        console.log('✅ [UPLOAD] rightImageRef.current set')
      }
      
      console.log(`📊 [UPLOAD] AFTER REF UPDATE:`)
      console.log(`   leftImageRef.current: ${!!leftImageRef.current}`)
      console.log(`   rightImageRef.current: ${!!rightImageRef.current}`)
      
      uploadDiagnostics.log('TRIGGER_RE_RENDER', 'info')
      setImagesVersion(v => v + 1)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      console.log(`💾 [UPLOAD] Ref update complete. Verifying...`)
      console.log(`📊 [UPLOAD] leftImageRef.current exists: ${!!leftImageRef.current}`)
      console.log(`📊 [UPLOAD] rightImageRef.current exists: ${!!rightImageRef.current}`)
      
      uploadDiagnostics.log('CROP_SAVE_COMPLETE', 'success', {
        side: savedSide,
        leftImageExists: !!leftImageRef.current,
        rightImageExists: !!rightImageRef.current
      })
      
      setIsProcessing(false)
      console.log(`✅ [UPLOAD] ${savedSide === 'left' ? 'Left' : 'Right'} iris saved successfully`)
      
      toast.success(`${savedSide === 'left' ? 'Ляв' : 'Десен'} ирис запазен успешно`)
    } catch (error) {
      uploadDiagnostics.log('CROP_SAVE_ERROR', 'error', {
        editingSide,
        isMounted: isMountedRef.current,
        croppedDataUrlLength: croppedDataUrl?.length || 0,
        error: error instanceof Error ? error.message : String(error)
      }, error as Error)
      console.error('❌ [UPLOAD] ERROR in handleCropSave:', error)
      errorLogger.error('UPLOAD_CROP_SAVE', 'Error in handleCropSave', error as Error, {
        editingSide,
        isMounted: isMountedRef.current,
        croppedDataUrlLength: croppedDataUrl?.length || 0
      })
      toast.error(`Грешка при запазване: ${error instanceof Error ? error.message : 'Неизвестна грешка'}`)
      setIsProcessing(false)
      setEditingSide(null)
      setTempImageData(null)
    }
  }

  const handleCropCancel = () => {
    setEditingSide(null)
    setTempImageData(null)
    setIsProcessing(false)
  }

  const handleEditImage = (side: 'left' | 'right') => {
    const image = side === 'left' ? leftImageRef.current : rightImageRef.current
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
    const leftImage = leftImageRef.current
    const rightImage = rightImageRef.current
    
    uploadDiagnostics.log('HANDLE_NEXT_START', 'start', {
      leftImageExists: !!leftImage,
      rightImageExists: !!rightImage,
      leftImageValid: leftImage?.dataUrl ? 'YES' : 'NO',
      rightImageValid: rightImage?.dataUrl ? 'YES' : 'NO',
      isProcessing,
      editingSide,
      isSaving
    })
    
    errorLogger.info('UPLOAD_NEXT', 'handleNext() called', {
      leftImage: !!leftImage,
      rightImage: !!rightImage,
      leftImageValid: leftImage?.dataUrl ? 'YES' : 'NO',
      rightImageValid: rightImage?.dataUrl ? 'YES' : 'NO',
      isProcessing,
      editingSide,
      isSaving
    })
    
    if (isSaving) {
      uploadDiagnostics.log('HANDLE_NEXT_ALREADY_SAVING', 'warning')
      errorLogger.warning('UPLOAD_NEXT', 'Already saving, ignoring duplicate call')
      return
    }
    
    if (!leftImage || !rightImage) {
      uploadDiagnostics.log('HANDLE_NEXT_MISSING_IMAGES', 'error', {
        leftImage: !!leftImage,
        rightImage: !!rightImage
      })
      errorLogger.error('UPLOAD_NEXT', 'CRITICAL: Missing images!', undefined, {
        leftImage: !!leftImage,
        rightImage: !!rightImage
      })
      toast.error('Моля, качете и двете снимки')
      return
    }
    
    if (!leftImage.dataUrl || !rightImage.dataUrl) {
      uploadDiagnostics.log('HANDLE_NEXT_MISSING_DATA_URLS', 'error', {
        leftHasDataUrl: !!leftImage?.dataUrl,
        rightHasDataUrl: !!rightImage?.dataUrl,
        leftDataUrlLength: leftImage?.dataUrl?.length || 0,
        rightDataUrlLength: rightImage?.dataUrl?.length || 0
      })
      errorLogger.error('UPLOAD_NEXT', 'CRITICAL: Image objects exist but dataUrl is missing!', undefined, {
        leftHasDataUrl: !!leftImage?.dataUrl,
        rightHasDataUrl: !!rightImage?.dataUrl,
        leftDataUrlLength: leftImage?.dataUrl?.length || 0,
        rightDataUrlLength: rightImage?.dataUrl?.length || 0
      })
      toast.error('Грешка: Липсват данни за изображенията')
      return
    }
    
    if (isProcessing) {
      uploadDiagnostics.log('HANDLE_NEXT_STILL_PROCESSING', 'warning')
      errorLogger.warning('UPLOAD_NEXT', 'Still processing image')
      toast.error('Моля, изчакайте обработката да завърши')
      return
    }
    
    if (editingSide !== null) {
      uploadDiagnostics.log('HANDLE_NEXT_STILL_EDITING', 'warning', { editingSide })
      errorLogger.warning('UPLOAD_NEXT', 'Still editing image')
      toast.error('Моля, завършете редакцията на текущото изображение')
      return
    }
    
    try {
      uploadDiagnostics.log('HANDLE_NEXT_VALIDATION_START', 'start')
      errorLogger.info('UPLOAD_NEXT', 'Starting save process')
      setIsSaving(true)
      
      uploadDiagnostics.log('HANDLE_NEXT_VALIDATION_DETAILS', 'info', {
        leftSize: Math.round(leftImage.dataUrl.length / 1024),
        rightSize: Math.round(rightImage.dataUrl.length / 1024),
        leftType: typeof leftImage.dataUrl,
        rightType: typeof rightImage.dataUrl,
        leftStartsWith: leftImage.dataUrl.substring(0, 20),
        rightStartsWith: rightImage.dataUrl.substring(0, 20)
      })
      
      errorLogger.info('UPLOAD_NEXT', 'Validating image data', {
        leftSize: Math.round(leftImage.dataUrl.length / 1024),
        rightSize: Math.round(rightImage.dataUrl.length / 1024),
        leftType: typeof leftImage.dataUrl,
        rightType: typeof rightImage.dataUrl,
        leftStartsWith: leftImage.dataUrl.substring(0, 20),
        rightStartsWith: rightImage.dataUrl.substring(0, 20)
      })
      
      if (typeof leftImage.dataUrl !== 'string' || typeof rightImage.dataUrl !== 'string') {
        const error = new Error('Невалиден тип данни на изображенията')
        uploadDiagnostics.log('HANDLE_NEXT_VALIDATION_INVALID_TYPE', 'error', {
          leftType: typeof leftImage.dataUrl,
          rightType: typeof rightImage.dataUrl
        }, error)
        throw error
      }
      
      if (leftImage.dataUrl.length < 100 || rightImage.dataUrl.length < 100) {
        const error = new Error('Изображенията са твърде малки или повредени')
        uploadDiagnostics.log('HANDLE_NEXT_VALIDATION_TOO_SMALL', 'error', {
          leftLength: leftImage.dataUrl.length,
          rightLength: rightImage.dataUrl.length
        }, error)
        throw error
      }
      
      if (!leftImage.dataUrl.startsWith('data:image/') || !rightImage.dataUrl.startsWith('data:image/')) {
        const error = new Error('Невалиден формат на изображенията (не са base64 data URL)')
        uploadDiagnostics.log('HANDLE_NEXT_VALIDATION_INVALID_FORMAT', 'error', {
          leftStartsWith: leftImage.dataUrl.substring(0, 20),
          rightStartsWith: rightImage.dataUrl.substring(0, 20)
        }, error)
        throw error
      }
      
      uploadDiagnostics.log('HANDLE_NEXT_VALIDATION_SUCCESS', 'success')
      errorLogger.info('UPLOAD_NEXT', 'Validation successful - all checks passed!')
      
      uploadDiagnostics.log('HANDLE_NEXT_CALL_ON_COMPLETE', 'start', {
        leftImageSide: leftImage.side,
        rightImageSide: rightImage.side,
        leftImageDataUrlLength: leftImage.dataUrl.length,
        rightImageDataUrlLength: rightImage.dataUrl.length
      })
      errorLogger.info('UPLOAD_NEXT', 'Calling onComplete() with validated images...')
      
      onComplete(leftImage, rightImage)
      
      uploadDiagnostics.log('HANDLE_NEXT_ON_COMPLETE_CALLED', 'success')
      errorLogger.info('UPLOAD_NEXT', 'onComplete() called successfully')
    } catch (error) {
      uploadDiagnostics.log('HANDLE_NEXT_ERROR', 'error', {
        leftImage: !!leftImage,
        rightImage: !!rightImage,
        leftDataUrl: leftImage?.dataUrl ? 'exists' : 'missing',
        rightDataUrl: rightImage?.dataUrl ? 'exists' : 'missing',
        error: error instanceof Error ? error.message : String(error)
      }, error as Error)
      errorLogger.error('UPLOAD_NEXT', 'Error during next transition', error as Error, {
        leftImage: !!leftImage,
        rightImage: !!rightImage,
        leftDataUrl: leftImage?.dataUrl ? 'exists' : 'missing',
        rightDataUrl: rightImage?.dataUrl ? 'exists' : 'missing'
      })
      toast.error(`Грешка при преминаване към анализ: ${error instanceof Error ? error.message : 'Неизвестна грешка'}`)
      setIsSaving(false)
    }
  }

  const removeImage = (side: 'left' | 'right') => {
    if (side === 'left') {
      leftImageRef.current = null
    } else {
      rightImageRef.current = null
    }
    setImagesVersion(v => v + 1)
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
            <h2 className="text-3xl font-bold mb-2">
              {isReanalysis ? 'Качване на Снимки за Повторен Анализ' : 'Качване на Снимки'}
            </h2>
            <p className="text-muted-foreground">
              {isReanalysis 
                ? 'Качете нови снимки на левия и десния си ирис за повторен анализ'
                : 'Качете ясни снимки на левия и десния си ирис'
              }
            </p>
          </motion.div>

          {isReanalysis && (
            <Card className="p-4 mb-6 bg-blue-500/10 border-blue-500/20">
              <div className="flex items-center gap-3">
                <div className="text-blue-500">ℹ️</div>
                <p className="text-sm font-medium">
                  Ще използваме вашите предишни данни от въпросника за повторен анализ с новите изображения.
                </p>
              </div>
            </Card>
          )}

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
              key={`left-${imagesVersion}`}
            >
              <Card className="p-6">
                <Label className="text-lg font-semibold mb-4 block">Ляв Ирис</Label>
                
                {!leftImageRef.current ? (
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
                      accept="image/*"
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
                      src={leftImageRef.current.dataUrl}
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
              key={`right-${imagesVersion}`}
            >
              <Card className="p-6">
                <Label className="text-lg font-semibold mb-4 block">Десен Ирис</Label>
                
                {!rightImageRef.current ? (
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
                      accept="image/*"
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
                      src={rightImageRef.current.dataUrl}
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
              disabled={!leftImageRef.current || !rightImageRef.current || isProcessing || editingSide !== null || isSaving}
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
