import { useState, useCallback } from 'react'

export interface IrisUnwrapResult {
  overlay: string   // base64 JPEG – original image with detected circles
  mapped: string    // base64 JPEG – unwrapped iris with minute/ring grid
  found: boolean
}

export interface UseIrisUnwrapReturn {
  unwrapImages: (leftDataUrl: string | null, rightDataUrl: string | null) => Promise<void>
  leftResult: IrisUnwrapResult | null
  rightResult: IrisUnwrapResult | null
  isLoading: boolean
  error: string | null
  backendAvailable: boolean
}

// Read at module load time – Vite replaces import.meta.env at build time so
// this value is effectively a constant and is safe outside the hook body.
const BACKEND_URL: string = (import.meta.env.VITE_IRIS_BACKEND_URL as string) || ''

/**
 * Hook for calling the method1/app.py Python backend (POST /process).
 *
 * The backend URL is read from the VITE_IRIS_BACKEND_URL env variable.
 * When the variable is not set the hook is a no-op and backendAvailable
 * stays false, so the rest of the app continues to work without it.
 *
 * The unwrapped ("mapped") image uses the new coordinate system:
 *   X-axis = minute 0–60 (clockwise from 12 o'clock)
 *   Y-axis = ring R0–R11 (from pupil boundary to outer iris edge)
 */
export function useIrisUnwrap(): UseIrisUnwrapReturn {
  const [leftResult, setLeftResult] = useState<IrisUnwrapResult | null>(null)
  const [rightResult, setRightResult] = useState<IrisUnwrapResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const backendAvailable = BACKEND_URL.length > 0

  const unwrapImages = useCallback(
    async (leftDataUrl: string | null, rightDataUrl: string | null) => {
      if (!backendAvailable) return
      if (!leftDataUrl && !rightDataUrl) return

      setIsLoading(true)
      setError(null)

      try {
        const formData = new FormData()

        const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
          const res = await fetch(dataUrl)
          return res.blob()
        }

        if (rightDataUrl) {
          const blob = await dataUrlToBlob(rightDataUrl)
          formData.append('image_right', blob, 'right.jpg')
        }
        if (leftDataUrl) {
          const blob = await dataUrlToBlob(leftDataUrl)
          formData.append('image_left', blob, 'left.jpg')
        }

        const response = await fetch(`${BACKEND_URL}/process`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Backend responded with ${response.status}`)
        }

        const data = await response.json()

        if (data.R) {
          setRightResult(
            data.R.found
              ? { overlay: data.R.overlay, mapped: data.R.mapped, found: true }
              : { overlay: '', mapped: '', found: false }
          )
        }
        if (data.L) {
          setLeftResult(
            data.L.found
              ? { overlay: data.L.overlay, mapped: data.L.mapped, found: true }
              : { overlay: '', mapped: '', found: false }
          )
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setIsLoading(false)
      }
    },
    [backendAvailable]
  )

  return {
    unwrapImages,
    leftResult,
    rightResult,
    isLoading,
    error,
    backendAvailable,
  }
}
