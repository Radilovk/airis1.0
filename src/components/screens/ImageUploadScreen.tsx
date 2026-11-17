import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle, ArrowRight, X, Crosshair, Eye, ImageSquare, Lightbulb, CaretDown, ArrowCounterClockwise, Warning } from '@phosphor-icons/react'
import PhotoGuide from '@/components/PhotoGuide'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { autoCalibrate } from '@/lib/iris-autocalibrate'
import { loadFaceTracker } from '@/lib/face-tracker'
import { cropEyesFromPhoto } from '@/lib/eye-crop'
import { autoFrameIris, type AutoFrameFail } from '@/lib/iris-autoframe'
import { errorLogger } from '@/lib/error-logger'
import { uploadDiagnostics } from '@/lib/upload-diagnostics'
import type { IrisGeometrySnapshot, IrisImage } from '@/types'

// Compression and size limit constants
// Iris images need ≥1600px width to preserve fine medical detail (lacunae, crypts, radial lines).
// Размерът, до който се свива снимката на окото.
export const IRIS_MAX_DIMENSION = 1600
// Окото се изрязва в пълна резолюция (до 4096 px, JPEG 0.95) — без смаляване.
const MAX_FINAL_SIZE_BYTES = 8 * 1024 * 1024
const MAX_FINAL_SIZE_KB = 8192

/** Защо окото не можа да се изреже — обяснение към човека и какво да направи. */
const FRAME_FAIL_TEXT: Record<AutoFrameFail, string> = {
  unreadable: 'Снимката не може да се отвори. Изберете друга снимка от галерията.',
  not_found: 'Не намерихме окото на тази снимка. Изберете снимка, на която окото е отблизо, на фокус и при добра светлина.',
  too_small: 'Окото е твърде далеч — ирисът е малък и детайлите се губят. Изберете по-близка снимка, на която окото заема голяма част от кадъра.',
  cut_off: 'Ирисът е отрязан от края на снимката. Изберете снимка, на която цялото око е в кадъра.',
}

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
    // Ръчно изрязване няма — снимката отива направо към разпознаването.
    void handleCropSaveRef.current?.(next.dataUrl, next.side)
  }, [editingSide, calibrating])
  // Ефектът по-горе е деклариран преди `handleCropSave`; достъпва го през ref.
  const handleCropSaveRef = useRef<((d: string, s: 'left' | 'right') => Promise<void>) | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const isMountedRef = useRef(true)
  
  const leftInputRef = useRef<HTMLInputElement>(null)
  const rightInputRef = useRef<HTMLInputElement>(null)
  const bothInputRef = useRef<HTMLInputElement>(null)
  // Окото не става за анализ → искаме нова снимка (с причината), без ръчни стъпки.
  const [retake, setRetake] = useState<{ left?: string; right?: string }>({})
  // Двете очи са готови → анализът тръгва сам след кратко отброяване (може да се спре).
  const [countdown, setCountdown] = useState<number | null>(null)
  const autoStartRef = useRef<'idle' | 'running' | 'stopped' | 'done'>(isReanalysis ? 'stopped' : 'idle')
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
          // Другото око от същата снимка — само ако за него не е избрана отделна снимка.
          const others = eyes.filter(e => e.side !== side && !(e.side === 'left' ? leftImageRef.current : rightImageRef.current)
            && !photoQueueRef.current.some(q => q.side === e.side))
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

        if (!isMountedRef.current) return
        // Окото се намира и изрязва от ОРИГИНАЛА в пълна резолюция (без смаляване).
        // Ако не става — нова снимка, с обяснение защо. Ръчно нагласяне няма.
        const framed = await autoFrameIris(source).catch(() => ({ fail: 'unreadable' as AutoFrameFail }))
        uploadDiagnostics.log('AUTO_FRAME', 'dataUrl' in framed ? 'success' : 'info', {
          side,
          result: 'dataUrl' in framed ? `ok ${framed.confidence.toFixed(2)}` : framed.fail,
        })
        if (!('dataUrl' in framed)) {
          if (side === 'left') leftImageRef.current = null
          else rightImageRef.current = null
          setRetake(r => ({ ...r, [side]: FRAME_FAIL_TEXT[framed.fail] }))
          setImagesVersion(v => v + 1)
          setIsProcessing(false)
          return
        }
        if (editingSideRef.current || calibratingRef.current) {
          pendingCropRef.current = { side, dataUrl: framed.dataUrl, auto: true }
          setIsProcessing(false)
          return
        }
        setIsProcessing(false)
        await handleCropSave(framed.dataUrl, side)
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
      // Без смаляване: изрезът вече е в пълна резолюция и JPEG 0.95.
      const finalImage = croppedDataUrl
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
        toast.error('Снимката е необичайно голяма. Изберете снимка от галерията на телефона (не скенер или RAW файл).')
        setIsProcessing(false)
        setEditingSide(null)
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

      // Зеницата и ирисът се разпознават автоматично. Ако разпознаването е
      // сигурно и снимката става за анализ, резултатът се приема без ръчна
      // стъпка; иначе се отваря един екран с кръговете.
      setIsProcessing(true)
      const auto = await autoCalibrate(image.dataUrl, savedSide).catch(() => null)
      setIsProcessing(false)
      if (!isMountedRef.current) return
      const sideName = savedSide === 'left' ? 'Лявото' : 'Дясното'
      if (auto?.confident) {
        setRetake(r => ({ ...r, [savedSide]: undefined }))
        const target = savedSide === 'left' ? leftImageRef : rightImageRef
        if (target.current) target.current = { ...target.current, geometry: auto.geometry, quality: auto.quality }
        setImagesVersion(v => v + 1)
        toast.success(`${sideName} око е разпознато · качество ${auto.quality.score}/100`, {
          description: 'Зеницата и ирисът са намерени автоматично. Ако нещо не е наред — „Коригирай“.',
        })
      } else {
        // Снимката не става за сигурен анализ → нова снимка на същото око, с причината.
        // Ръчните кръгове остават само като резервен вариант („Нагласи ръчно“).
        const why = auto?.reason && !/кръг/i.test(auto.reason)
          ? auto.reason
          : 'Зеницата и ръбът на ириса не се виждат достатъчно ясно (размазване, отблясък или клепач). Изберете по-ясна снимка, отблизо и при добра светлина.'
        setRetake(r => ({ ...r, [savedSide]: why }))
        toast.warning(`${sideName} око: нужна е по-ясна снимка`, {
          description: why,
          duration: 10000,
          action: { label: 'Избери друга', onClick: () => askRetake(savedSide) },
        })
      }
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
    }
  }

  handleCropSaveRef.current = handleCropSave

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
        toast.error(missing === 'left' ? 'Лявото око не е разпознато. Изберете по-ясна снимка.' : 'Дясното око не е разпознато. Изберете по-ясна снимка.')
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

  /** Нова снимка на едно око: махаме негодната и отваряме избора (докосването е на човека). */
  const askRetake = (side: 'left' | 'right') => {
    if (side === 'left') leftImageRef.current = null
    else rightImageRef.current = null
    setRetake(r => ({ ...r, [side]: undefined }))
    setImagesVersion(v => v + 1)
    const input = side === 'left' ? leftInputRef.current : rightInputRef.current
    input?.click()
  }

  /**
   * Галерията се отваря ВЕДНЪЖ: първата избрана снимка е лявото око, втората — дясното
   * (телефоните подават снимките в реда на избиране). Една снимка → първото празно място;
   * ако на нея са двете очи (снимка на лицето), AI ги намира и разпределя сам.
   */
  const handlePickedFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter(f => f.type.startsWith('image/'))
    if (!files.length) return
    if (files.length > 2) toast.info('Взехме първите две снимки: лявото и дясното око.')
    const jobs: { side: 'left' | 'right'; file: File }[] = files.length >= 2
      ? [{ side: 'left', file: files[0] }, { side: 'right', file: files[1] }]
      : [{ side: !leftImageRef.current ? 'left' : !rightImageRef.current ? 'right' : 'left', file: files[0] }]
    for (const j of jobs) setRetake(r => ({ ...r, [j.side]: undefined }))
    photoQueueRef.current.push(...jobs)
    setImagesVersion(v => v + 1)
  }

  const removeImage = (side: 'left' | 'right') => {
    if (side === 'left') {
      leftImageRef.current = null
    } else {
      rightImageRef.current = null
    }
    setRetake(r => ({ ...r, [side]: undefined }))
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
  const bothReady = leftReady && rightReady && !isProcessing && !calibrating && !isSaving

  useEffect(() => {
    if (!bothReady) {
      if (autoStartRef.current === 'running') { autoStartRef.current = 'idle'; setCountdown(null) }
      return
    }
    if (autoStartRef.current !== 'idle') return
    autoStartRef.current = 'running'
    setCountdown(3)
  }, [bothReady])

  useEffect(() => {
    if (countdown === null || autoStartRef.current !== 'running') return
    if (countdown <= 0) {
      autoStartRef.current = 'done'
      setCountdown(null)
      void handleNext()
      return
    }
    const t = setTimeout(() => setCountdown(c => (c === null ? null : c - 1)), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleNext се взима пресен при всяка стъпка
  }, [countdown])

  const stopAutoStart = () => {
    autoStartRef.current = 'stopped'
    setCountdown(null)
  }

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
                : 'Изберете от галерията две снимки наведнъж: първо на лявото, после на дясното око. Окото се намира, изрязва и нагласява само. Анализът започва автоматично.'}
            </p>
          </motion.div>

          <UploadStepper step={step} />

          {(!left || !right) && !isProcessing && (
            <Card className="mb-6 overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5">
              {/* Галерия, не камера: без `capture`, само снимки. `multiple` — двете очи с едно отваряне. */}
              <input ref={bothInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { handlePickedFiles(e.target.files); e.target.value = '' }} />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 sm:mx-0">
                  <ImageSquare size={30} weight="duotone" className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-center font-semibold sm:text-left">
                    {!left && !right ? 'Изберете двете снимки от галерията' : !left ? 'Остава лявото око' : 'Остава дясното око'}
                  </p>
                  {!left && !right ? (
                    <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <li><strong className="text-foreground">1.</strong> <span>Изберете снимка на вашето ляво око.</span></li>
                      <li><strong className="text-foreground">2.</strong> <span>После изберете снимка на вашето дясно око.</span></li>
                      <li className="text-xs">Галерията се отваря веднъж — докоснете двете снимки една след друга, в този ред.</li>
                    </ol>
                  ) : (
                    <p className="mt-1 text-center text-sm text-muted-foreground sm:text-left">
                      {!left ? 'Изберете снимка на вашето ляво око.' : 'Изберете снимка на вашето дясно око.'}
                    </p>
                  )}
                </div>
                <Button size="lg" className="h-12 w-full gap-2 sm:w-auto" onClick={() => bothInputRef.current?.click()}>
                  <ImageSquare size={20} weight="bold" /> {!left && !right ? 'Избери двете снимки' : 'Избери снимка'}
                </Button>
              </div>
            </Card>
          )}

          {/* Отворено, докато няма снимки — указанията трябват ПРЕДИ снимането. */}
          <details
            key={left || right ? 'has-photo' : 'empty'}
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

          {countdown !== null && (
            <Card className="mb-6 flex items-center gap-4 border-primary/40 bg-primary/10 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold tabular-nums text-primary-foreground">
                {countdown}
              </div>
              <div className="flex-1">
                <p className="font-semibold">Двете очи са разпознати</p>
                <p className="text-sm text-muted-foreground">Анализът започва автоматично.</p>
              </div>
              <Button variant="outline" onClick={stopAutoStart}>Спри</Button>
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
                  onCalibrate={() => {}}
                  onRemove={() => removeImage(side)}
                  retakeReason={retake[side]}
                  onRetake={() => askRetake(side)}
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
                {!leftReady ? 'Нужна е нова снимка на лявото око.' : 'Нужна е нова снимка на дясното око.'}
              </p>
            )}
            <Button
              size="lg"
              onClick={handleNext}
              disabled={!leftReady || !rightReady || isProcessing || editingSide !== null || isSaving || countdown !== null}
              className="gap-2"
            >
              {isSaving ? 'Запазване...' : 'Започни анализ'}
              <ArrowRight size={20} weight="bold" />
            </Button>
          </motion.div>
        </div>
      </div>

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
  needsRetake,
}: {
  image: IrisImage | null
  onOpen: () => void
  needsRetake?: boolean
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
      {calibrated ? `Готово${q ? ` · ${q.score}/100` : ''}` : needsRetake ? 'Нужна е по-ясна снимка' : 'Проверяваме…'}
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

/** Кръговете на зеницата и ириса върху снимката (object-contain). */
function DetectedOverlay({ geometry }: { geometry: IrisGeometrySnapshot }) {
  const W = geometry.imageWidth
  const H = geometry.imageHeight
  if (!W || !H) return null
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 h-full w-full">
      <ellipse
        cx={geometry.limbus.cx}
        cy={geometry.limbus.cy}
        rx={geometry.limbus.r}
        ry={geometry.limbus.ry ?? geometry.limbus.r}
        fill="none"
        stroke="rgba(251,191,36,0.95)"
        strokeWidth={Math.max(3, W / 140)}
      />
      <circle
        cx={geometry.pupil.cx}
        cy={geometry.pupil.cy}
        r={geometry.pupil.r}
        fill="none"
        stroke="rgba(56,189,248,0.95)"
        strokeWidth={Math.max(3, W / 140)}
      />
    </svg>
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
  onRemove,
  retakeReason,
  onRetake,
}: {
  side: 'left' | 'right'
  image: IrisImage | null
  active: boolean
  disabled: boolean
  galleryRef: React.RefObject<HTMLInputElement | null>
  onFile: (file: File) => void
  onDrop: (e: React.DragEvent) => void
  onCalibrate: () => void
  onRemove: () => void
  retakeReason?: string
  onRetake: () => void
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
        {image && <CalibrationStatus image={image} onOpen={onCalibrate} needsRetake={!!retakeReason} />}
      </div>

      {/* Без `capture`: той отваря опростения режим на камерата (на много
          Android телефони — по-ниска резолюция и без обработката на телефона).
          Без него телефонът предлага галерия или камера по избор. */}
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" disabled={disabled} onChange={pick} />

      {!image && retakeReason && (
        <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
          <p className="flex items-start gap-2 text-sm">
            <Warning size={18} weight="fill" className="mt-0.5 shrink-0 text-amber-600" />
            <span><strong>Нужна е по-ясна снимка.</strong> {retakeReason}</span>
          </p>
        </div>
      )}
      {!image ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-5 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Eye size={34} weight="duotone" className="text-primary" />
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Изберете снимка на окото от галерията. Окото се намира, изрязва и нагласява само.
          </p>
          <Button size="lg" className="h-12 w-full gap-2" disabled={disabled} onClick={() => galleryRef.current?.click()}>
            <ImageSquare size={20} weight="bold" /> Избери снимка
          </Button>
          <p className="mt-3 hidden text-xs text-muted-foreground md:block">или пуснете файла тук</p>
        </div>
      ) : (
        <>
          {/* Снимката с намерените граници — човекът вижда какво е разпознато. */}
          <div className="relative block h-60 w-full overflow-hidden rounded-2xl bg-black">
            <img src={image.dataUrl} alt={label} className="absolute inset-0 h-full w-full object-contain" />
            {image.geometry && <DetectedOverlay geometry={image.geometry} />}
          </div>
          {retakeReason && !image.geometry ? (
            <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
              <p className="flex items-start gap-2 text-sm">
                <Warning size={18} weight="fill" className="mt-0.5 shrink-0 text-amber-600" />
                <span><strong>Нужна е по-ясна снимка.</strong> {retakeReason}</span>
              </p>
              <Button className="mt-3 h-11 w-full gap-2" onClick={onRetake} disabled={disabled}>
                <ArrowCounterClockwise size={18} weight="bold" /> Избери друга снимка
              </Button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-1.5" onClick={onRetake} disabled={disabled}>
                <ImageSquare size={16} weight="bold" /> Смени
              </Button>
              <Button variant="outline" className="gap-1.5 text-rose-600 hover:text-rose-700" onClick={onRemove}>
                <X size={16} weight="bold" /> Премахни
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
