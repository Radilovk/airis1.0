import IridologyOverlay from './IridologyOverlay'

interface IrisWithOverlayProps {
  imageDataUrl: string
  side: 'left' | 'right'
  size?: number
  className?: string
}

export default function IrisWithOverlay({ 
  imageDataUrl, 
  side, 
  size = 400,
  className = '' 
}: IrisWithOverlayProps) {
  return (
    <div className={`relative inline-block ${className}`} style={{ width: size, height: size }}>
      <img
        src={imageDataUrl}
        alt={`${side === 'left' ? 'Ляв' : 'Десен'} ирис`}
        className="absolute inset-0 w-full h-full object-cover rounded-lg"
      />
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: side === 'right' ? 'scaleX(-1)' : 'none'
        }}
      >
        <IridologyOverlay size={size} className="opacity-60" />
      </div>
    </div>
  )
}
