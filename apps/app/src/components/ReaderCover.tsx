import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { assetUrl } from '../lib/assets'
import type { ReaderCover as ReaderCoverMetadata } from '../lib/readers'

interface ReaderCoverProps {
  readerId: string
  hskLevel: number
  cover?: ReaderCoverMetadata
  children?: ReactNode
  eager?: boolean
  className?: string
}

function readerCoverFallbackSignature(readerId: string, hskLevel: number): number {
  let hash = hskLevel * 97
  for (const character of readerId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return hash % 360
}

export default function ReaderCover({
  readerId,
  hskLevel,
  cover,
  children,
  eager = false,
  className = '',
}: ReaderCoverProps) {
  const [failed, setFailed] = useState(false)
  const hue = readerCoverFallbackSignature(readerId, hskLevel)
  const hasImage = Boolean(cover && !failed)
  const imageBase = cover ? assetUrl(cover.image) : ''

  return (
    <div
      className={`reader-cover relative isolate aspect-[2/3] overflow-hidden bg-surface-raised ${className}`}
      data-cover-fallback={`${hskLevel}-${hue}`}
      style={
        {
          '--reader-cover-accent': cover?.accent ?? `hsl(${hue} 42% 42%)`,
          '--reader-cover-hue': hue,
          '--reader-cover-angle': `${(hue + 135) % 360}deg`,
        } as CSSProperties
      }
    >
      <div
        aria-hidden="true"
        className="reader-cover__fallback absolute inset-0"
      >
        <span className="reader-cover__fallback-number">{hskLevel}</span>
      </div>

      {hasImage && cover ? (
        <img
          className="reader-cover__image absolute inset-0 h-full w-full object-cover"
          src={`${imageBase}-480.webp`}
          srcSet={`${imageBase}-480.webp 480w, ${imageBase}-960.webp 960w`}
          sizes="(min-width: 1024px) 19rem, (min-width: 640px) 44vw, 92vw"
          width={480}
          height={720}
          style={{ objectPosition: cover.focalPosition }}
          alt={cover.alt}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : null}

      {children ? (
        <div className="reader-cover__content absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5">
          {children}
        </div>
      ) : null}
    </div>
  )
}
