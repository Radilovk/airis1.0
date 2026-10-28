import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle, ArrowRight, X, Crop, Crosshair, Eye, ImageSquare, Lightbulb, CaretDown } from '@phosphor-icons/react'
import PhotoGuide from '@/components/PhotoGuide'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import IrisCropEditor from '@/components/iris/IrisCropEditor'
import IrisCalibrator from '@/components/iris/IrisCalibrator'
import { loadFaceTracker } from '@/lib/face-tracker'
import { cropEyesFromPhoto } from '@/lib/eye-crop'
import { autoFrameIris } from '@/lib/iris-autoframe'
import { errorLogger } from '@/lib/error-logger'
import { uploadDiagnostics } from '@/lib/upload-diagnostics'
import type { QualityReport } from '@/lib/iris-quality'
import type { IrisGeometrySnapshot, IrisImage } from '@/types'

// Compression and size limit constants
// Iris images need ≥1600px width to preserve fine medical detail (lacunae, crypts, radial lines).
// Shared with IrisCropEditor – keep in sync.
export const IRIS_MAX_DIMENSION = 1600
const SECOND_PASS_THRESHOLD_BYTES = 3 * 1024 * 1024 // 3 MB – only re-compress truly large files
const MAX_FINAL_SIZE_BYTES = 5 * 1024 * 1024        // 5 MB – supports 1600px JPEG at q=0.92
const MAX_FINAL_SIZE_KB = 5120

interface ImageUploadScreenProps {
  /**
   * Връща `false`, ако родителят е отказал прехода — тогава екранът връща
   * бутона в работно състояние. Без това отказ в родителя оставяше „Запазване…"
   * завинаги: `catch` тук не се задейства, защото няма изключение.
   */
  onComplete: (left: IrisImage, right: IrisImage) => void | boolean | Promise<void | boolean>
  initialLeft?: IrisImage | null
  initialRight?: IrisImage | null
  isReanalysis?: boolean
}

export default function ImageUploadScreen({ onComplete, initialLeft = null, initialRight = null, isReanalysis = false }: ImageUploadScreenProps) {
  const leftImageRef = useRef<IrisImage | null>(initialLeft)
  const rightImageRef = useRef<IrisImage | null>(initialRight)
  const [, setImagesVersion] = useState(0)
  const [editingSide, setEditingSide] = useState<'left' | 'right' | null>(null)
  /**
   * ОПАШКА ЗА ВТОРАТА СНИМКА.
   *
   * `handleFileSelect` правеше `setEditingSide(side)` безусловно. Ако
   * потребителят избере втората снимка, докато модалът на първата е още
   * отворен, второто извикване ПРЕЗАПИСВАШЕ първото и първото око се губеше
   * тихо — без съобщение и без следа. Открито при пълен тест в браузъра.
   *
   * Сега втората изчаква тук и се отваря сама, щом първата приключи.
   */
  const pendingCropRef = useRef<{ side: 'left' | 'right'; dataUrl: string; auto?: boolean } | null>(null)
  // `handleFileSelect` е async и не вижда актуалния state, затова огледални ref-ове.
  const editingSideRef = useRef<'left' | 'right' | null>(null)
  const calibratingRef = useRef<unknown>(null)
  const [tempImageData, setTempImageData] = useState<string | null>(null)
  // Стъпката „калибриране" се показва веднага след изрязването: там се измерва
  // геометрията и се решава дали снимката изобщо става за анализ.
  const [calibrating, setCalibrating] = useState<{ side: 'left' | 'right'; dataUrl: string } | null>(null)

  editingSideRef.current = editingSide
  calibratingRef.current = calibrating

  // Източва опашката, щом и двата модала са затворени.
  useEffect(() => {
    if (editingSide || calibrating) return
    const next = pendingCropRef.current
    if (!next) return
    pendingCropRef.current = null
    if (next.auto) {
      void handleCropSaveRef.current?.(next.dataUrl, next.side)
      return
    }
    setTempImageData(next.dataUrl)
    setEditingSide(next.side)
  }, [editingSide, calibrating])
  // Ефектът по-горе е деклариран преди `handleCropSave`; достъпва го през ref.
  const handleCropSaveRef = useRef<((d: string, s: 'left' | 'right') => Promise<void>) | null>(null)
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

  /**
   * Опашка за снимки, които чакат реда си: другото око от снимка на двете очи.
   * `handleFileSelect` прекъсва предишното четене, затова следващата тръгва,
   * щом текущата излезе от обработка — оттам нататък опашката на калибратора
   * я поема.
   */
  const photoQueueRef = useRef<{ side: 'left' | 'right'; file: File }[]>([])

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

    // Снимка от камерата на телефона в пълна резолюция е 3–15 MB; окото се
    // изрязва от нея, а не се качва цялата.
    if (file.size > 40 * 1024 * 1024) {
      uploadDiagnostics.log('FILE_SELECT_ERROR', 'error', {
        reason: 'File too large',
        fileSize: file.size,
        maxSize: 40 * 1024 * 1024
      })
      toast.error('Файлът е твърде голям. Максимум 40MB.')
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

        // AI: на снимката е лицето или двете очи → всяко око се изрязва от
        // оригинала в пълна резолюция; другото око отива в своето място.
        let source = dataUrl
        const eyes = await cropEyesFromPhoto(dataUrl).catch(() => null)
        if (eyes) {
          uploadDiagnostics.log('AI_EYES_FOUND', 'success', { side, eyes: eyes.map(e => ({ side: e.side, irisPx: e.irisPx })) })
          const mine = eyes.find(e => e.side === side)
          const others = eyes.filter(e => e.side !== side && !(e.side === 'left' ? leftImageRef.current : rightImageRef.current))
          photoQueueRef.current.push(...others.map(e => ({ side: e.side, file: e.file })))
          if (others.length && mine) toast.info('На снимката са и двете очи — изрязахме всяко поотделно.')
          const smallest = Math.min(...eyes.map(e => e.irisPx))
          if (smallest < 300) {
            toast.warning('Окото е дребно на снимката', {
              description: 'Анализът ще види по-малко детайли. Снимайте едно око отблизо — вижте „Как да снимате“.',
              duration: 8000,
            })
          }
          if (!mine) {
            // Вижда се само другото око — то отива на своето място.
            setIsProcessing(false)
            setImagesVersion(v => v + 1)
            return
          }
          source = mine.dataUrl
        }

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
        let compressedDataUrl = await compressImage(source, IRIS_MAX_DIMENSION, 0.92)
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
        // Окото се търси автоматично. При уверено откриване снимката се
        // центрира сама и ръчният редактор се прескача. Търси се в ПЪЛНАТА
        // резолюция: смалена до 1600 px снимка губи по-голямата част от
        // пикселите на ириса, ако окото не е запълвало кадъра.
        const framed = await autoFrameIris(source).catch(() => null)
        uploadDiagnostics.log('AUTO_FRAME', framed ? 'success' : 'info', {
          side,
          confidence: framed?.confidence ?? 0,
        })

        if (editingSideRef.current || calibratingRef.current) {
          // Другото око е в процес — това изчаква реда си, вместо да го изтрие.
          pendingCropRef.current = framed
            ? { side, dataUrl: framed.dataUrl, auto: true }
            : { side, dataUrl: compressedDataUrl }
          uploadDiagnostics.log('CROP_QUEUED', 'info', { side })
          toast.info(
            `${side === 'left' ? 'Лявата' : 'Дясната'} снимка е приета — ще се отвори веднага след другата.`
          )
          setIsProcessing(false)
          return
        }
        if (framed) {
          setIsProcessing(false)
          toast.success(`${side === 'left' ? 'Лявото' : 'Дясното'} око е намерено и центрирано`, {
            description: 'Проверете кръговете и потвърдете.',
          })
          await handleCropSave(framed.dataUrl, side)
          return
        }
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

  const handleCropSave = async (croppedDataUrl: string, sideOverride?: 'left' | 'right') => {
    // При автоматично центриране няма отворен редактор и `editingSide` е null.
    const activeSide = sideOverride ?? editingSide
    uploadDiagnostics.log('CROP_SAVE_START', 'start', {
      croppedDataUrlType: typeof croppedDataUrl,
      croppedDataUrlLength: croppedDataUrl?.length || 0,
      croppedDataUrlSizeKB: Math.round((croppedDataUrl?.length || 0) / 1024),
      activeSide,
      isMounted: isMountedRef.current
    })
    
    console.log('✂️ [UPLOAD] ========== handleCropSave CALLED ==========')
    console.log(`📊 [UPLOAD] croppedDataUrl type: ${typeof croppedDataUrl}`)
    console.log(`📊 [UPLOAD] croppedDataUrl length: ${croppedDataUrl?.length || 0}`)
    console.log(`📊 [UPLOAD] croppedDataUrl first 50 chars: ${croppedDataUrl?.substring(0, 50)}`)
    console.log(`📊 [UPLOAD] activeSide: ${activeSide}`)
    console.log(`📊 [UPLOAD] isMounted: ${isMountedRef.current}`)
    
    if (!activeSide) {
      uploadDiagnostics.log('CROP_SAVE_ERROR_NO_SIDE', 'error', {
        croppedDataUrlLength: croppedDataUrl?.length || 0
      })
      console.error('❌ [UPLOAD] CRITICAL: activeSide is null!')
      errorLogger.error('UPLOAD_CROP_SAVE', 'CRITICAL: activeSide is null!', undefined, {
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
        activeSide
      })
      console.error('❌ [UPLOAD] CRITICAL: Invalid croppedDataUrl!')
      errorLogger.error('UPLOAD_CROP_SAVE', 'CRITICAL: Invalid croppedDataUrl!', undefined, {
        croppedDataUrl: !!croppedDataUrl,
        type: typeof croppedDataUrl,
        activeSide
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
      const finalImage = await compressImage(croppedDataUrl, IRIS_MAX_DIMENSION, 0.92)
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
          activeSide
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
        side: activeSide,
        dataUrlLength: finalImage.length
      })
      
      const image: IrisImage = { 
        dataUrl: finalImage, 
        side: activeSide 
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
      
      const savedSide = activeSide
      
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

      // Веднага след изрязването минаваме през калибрирането. Дотогава снимката
      // е записана, но НЯМА геометрия — а без геометрия анализът не тръгва.
      setCalibrating({ side: savedSide, dataUrl: image.dataUrl })
    } catch (error) {
      uploadDiagnostics.log('CROP_SAVE_ERROR', 'error', {
        activeSide,
        isMounted: isMountedRef.current,
        croppedDataUrlLength: croppedDataUrl?.length || 0,
        error: error instanceof Error ? error.message : String(error)
      }, error as Error)
      console.error('❌ [UPLOAD] ERROR in handleCropSave:', error)
      errorLogger.error('UPLOAD_CROP_SAVE', 'Error in handleCropSave', error as Error, {
        activeSide,
        isMounted: isMountedRef.current,
        croppedDataUrlLength: croppedDataUrl?.length || 0
      })
      toast.error(`Грешка при запазване: ${error instanceof Error ? error.message : 'Неизвестна грешка'}`)
      setIsProcessing(false)
      setEditingSide(null)
      setTempImageData(null)
    }
  }

  handleCropSaveRef.current = handleCropSave

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
      
      if (!leftImage.geometry || !rightImage.geometry) {
        const missing = !leftImage.geometry ? 'left' : 'right'
        uploadDiagnostics.log('HANDLE_NEXT_MISSING_GEOMETRY', 'warning', { missing })
        setIsSaving(false)
        toast.error(
          `${missing === 'left' ? 'Левият' : 'Десният'} ирис не е настроен. Отворете настройката на снимката.`
        )
        setCalibrating({
          side: missing as 'left' | 'right',
          dataUrl: missing === 'left' ? leftImage.dataUrl : rightImage.dataUrl,
        })
        return
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
      
      const accepted = await onComplete(leftImage, rightImage)
      if (accepted === false) {
        uploadDiagnostics.log('HANDLE_NEXT_ON_COMPLETE_REJECTED', 'error')
        setIsSaving(false)
        return
      }

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

  /** Потвърдена калибрация → геометрията се закача за снимката. */
  const handleCalibrationConfirm = (geometry: IrisGeometrySnapshot, quality: QualityReport) => {
    if (!calibrating) return
    const target = calibrating.side === 'left' ? leftImageRef : rightImageRef
    if (target.current) {
      target.current = {
        ...target.current,
        geometry,
        quality: {
          verdict: quality.verdict,
          score: quality.score,
          issueCodes: quality.issues.map(i => i.code),
        },
      }
    }
    setCalibrating(null)
    setImagesVersion(v => v + 1)
    toast.success(
      `${calibrating.side === 'left' ? 'Ляв' : 'Десен'} ирис е настроен · качество ${quality.score}/100`
    )
  }

  /** „Друга снимка" → изчистваме текущата и връщаме потребителя към избора. */
  const handleCalibrationRetake = () => {
    if (!calibrating) return
    const side = calibrating.side
    if (side === 'left') leftImageRef.current = null
    else rightImageRef.current = null
    setCalibrating(null)
    setImagesVersion(v => v + 1)
    setTimeout(() => {
      const input = side === 'left' ? leftInputRef.current : rightInputRef.current
      input?.click()
    }, 120)
  }

  /** Затваряне без потвърждение — снимката остава, но без геометрия. */
  const handleCalibrationCancel = () => {
    setCalibrating(null)
    toast.info('Настройката е отложена. Анализът изисква настроена снимка.')
  }

  /** Повторно отваряне на калибратора за вече качена снимка. */
  const openCalibrator = (side: 'left' | 'right') => {
    const image = side === 'left' ? leftImageRef.current : rightImageRef.current
    if (!image) return
    setCalibrating({ side, dataUrl: image.dataUrl })
  }

  const removeImage = (side: 'left' | 'right') => {
    if (side === 'left') {
      leftImageRef.current = null
    } else {
      rightImageRef.current = null
    }
    setImagesVersion(v => v + 1)
  }

  useEffect(() => {
    if (isProcessing || photoQueueRef.current.length === 0) return
    const next = photoQueueRef.current.shift()!
    void handleFileSelect(next.side, next.file)
  })
  // AI моделът (~4 MB) се тегли още тук, за да е готов, когато дойде снимката.
  useEffect(() => {
    void loadFaceTracker()
  }, [])

  const left = leftImageRef.current
  const right = rightImageRef.current
  const leftReady = !!left?.geometry
  const rightReady = !!right?.geometry
  // Следващата стъпка е винаги една: първо лявото око, после дясното, после анализ.
  const step = !leftReady ? 0 : !rightReady ? 1 : 2

  return (
    <>
      <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="max-w-4xl w-full">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <h2 className="text-3xl font-bold mb-2">
              {isReanalysis ? 'Нови снимки за повторен анализ' : 'Снимки на двата ириса'}
            </h2>
            <p className="text-muted-foreground">
              {isReanalysis
                ? 'Ще използваме предишните ви отговори от въпросника.'
                : 'Окото се намира и центрира само. Вие само проверявате кръговете.'}
            </p>
          </motion.div>

          <UploadStepper step={step} />

          {/* Отворено, докато няма снимки — указанията трябват ПРЕДИ снимането. */}
          <details
            key={left || right ? 'has-photo' : 'empty'}
            open={!left && !right}
            className="group mb-6 rounded-2xl border bg-card px-4 py-3"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-semibold">
              <span className="flex items-center gap-2">
                <Lightbulb size={18} weight="duotone" className="text-primary" />
                Как да снимате окото
              </span>
              <CaretDown size={16} className="text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 pb-1">
              <PhotoGuide />
            </div>
          </details>

          {isProcessing && (
            <Card className="p-4 mb-6 bg-primary/10">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
                <p className="text-sm font-medium">Търсим окото и го центрираме…</p>
              </div>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {(['left', 'right'] as const).map((side, i) => (
              <motion.div
                key={side}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
              >
                <EyeSlot
                  side={side}
                  image={side === 'left' ? left : right}
                  active={step === i}
                  disabled={isProcessing}
                  galleryRef={side === 'left' ? leftInputRef : rightInputRef}
                  onFile={file => handleFileSelect(side, file)}
                  onDrop={e => !isProcessing && handleDrop(side, e)}
                  onCalibrate={() => openCalibrator(side)}
                  onCrop={() => handleEditImage(side)}
                  onRemove={() => removeImage(side)}
                />
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end"
          >
            {left && right && (!leftReady || !rightReady) && (
              <p className="text-sm text-muted-foreground sm:mr-auto">
                Потвърдете кръговете на {!leftReady ? 'лявото' : 'дясното'} око, за да е точен анализът.
              </p>
            )}
            <Button
              size="lg"
              onClick={handleNext}
              disabled={!left || !right || isProcessing || editingSide !== null || isSaving}
              className="gap-2"
            >
              {isSaving ? 'Запазване...' : 'Започни анализ'}
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

      {calibrating && (
        <IrisCalibrator
          key={`${calibrating.side}-${calibrating.dataUrl.length}`}
          imageDataUrl={calibrating.dataUrl}
          side={calibrating.side}
          onConfirm={handleCalibrationConfirm}
          onRetake={handleCalibrationRetake}
          onCancel={handleCalibrationCancel}
        />
      )}
    </>
  )
}

/**
 * Малка лента под всяка снимка: показва дали ирисът е калибриран и с какво
 * качество, и дава бърз достъп обратно до калибратора.
 */
function CalibrationStatus({
  image,
  onOpen,
}: {
  image: IrisImage | null
  onOpen: () => void
}) {
  if (!image) return null

  const q = image.quality
  const calibrated = !!image.geometry
  const tone = !calibrated
    ? 'border-amber-300 bg-amber-50 text-amber-900'
    : q && q.score >= 70
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : q && q.score >= 45
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : 'border-rose-300 bg-rose-50 text-rose-900'

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors hover:brightness-[0.97] ${tone}`}
    >
      {calibrated ? <CheckCircle size={14} weight="fill" /> : <Crosshair size={14} weight="bold" />}
      {calibrated ? `Готово${q ? ` · ${q.score}/100` : ''}` : 'Провери кръговете'}
    </button>
  )
}

const STEPS = ['Ляво око', 'Дясно око', 'Анализ']

function UploadStepper({ step }: { step: number }) {
  return (
    <ol className="mb-5 flex items-center justify-center gap-1.5 text-xs sm:gap-2 sm:text-sm">
      {STEPS.map((label, i) => {
        const done = i < step
        const current = i === step
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span className={`h-px w-3 sm:w-10 ${done || current ? 'bg-primary' : 'bg-border'}`} />}
            <span
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-medium transition-colors sm:px-3 ${
                current ? 'bg-primary text-primary-foreground shadow' : done ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              {done ? <CheckCircle size={16} weight="fill" /> : <span className="tabular-nums">{i + 1}</span>}
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Едно око: празно — два ясни бутона (снимай / от галерията) и място за
 * пускане на файл; заредено — снимката с винаги видими действия.
 */
function EyeSlot({
  side,
  image,
  active,
  disabled,
  galleryRef,
  onFile,
  onDrop,
  onCalibrate,
  onCrop,
  onRemove,
}: {
  side: 'left' | 'right'
  image: IrisImage | null
  active: boolean
  disabled: boolean
  galleryRef: React.RefObject<HTMLInputElement | null>
  onFile: (file: File) => void
  onDrop: (e: React.DragEvent) => void
  onCalibrate: () => void
  onCrop: () => void
  onRemove: () => void
}) {
  const label = side === 'left' ? 'Ляво око' : 'Дясно око'
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    e.target.value = ''
  }

  return (
    <Card
      className={`p-5 transition-shadow ${active ? 'ring-2 ring-primary shadow-lg shadow-primary/10' : ''}`}
      onDrop={onDrop}
      onDragOver={e => e.preventDefault()}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{label}</h3>
        {image && <CalibrationStatus image={image} onOpen={onCalibrate} />}
      </div>

      {/* Без `capture`: той отваря опростения режим на камерата (на много
          Android телефони — по-ниска резолюция и без обработката на телефона).
          Без него телефонът предлага галерия или камера по избор. */}
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" disabled={disabled} onChange={pick} />

      {!image ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-5 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Eye size={34} weight="duotone" className="text-primary" />
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Снимайте окото с <strong className="text-foreground">обичайната камера</strong> на телефона, после изберете снимката тук. Окото се намира и изрязва само.
          </p>
          <Button size="lg" className="h-12 w-full gap-2" disabled={disabled} onClick={() => galleryRef.current?.click()}>
            <ImageSquare size={20} weight="bold" /> Избери снимка
          </Button>
          <p className="mt-3 hidden text-xs text-muted-foreground md:block">или пуснете файла тук</p>
        </div>
      ) : (
        <>
          <button type="button" onClick={onCalibrate} className="block w-full overflow-hidden rounded-2xl bg-black">
            <img src={image.dataUrl} alt={label} className="mx-auto h-60 w-full object-contain" />
          </button>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button variant={image.geometry ? 'outline' : 'default'} className="gap-1.5" onClick={onCalibrate}>
              <Crosshair size={16} weight="bold" /> Настрой
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={onCrop}>
              <Crop size={16} weight="bold" /> Изрежи
            </Button>
            <Button variant="outline" className="gap-1.5 text-rose-600 hover:text-rose-700" onClick={onRemove}>
              <X size={16} weight="bold" /> Премахни
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
