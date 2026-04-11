'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'

interface MomentsImageGridProps {
  images: string[]
  title?: string
  priority?: boolean
}

/** 图片 lightbox 查看器 */
function ImageLightbox({ images, index, onClose }: { images: string[]; index: number; onClose: () => void }) {
  const [current, setCurrent] = useState(index)
  const touchStartX = useRef<number | null>(null)

  const goPrev = useCallback(() => setCurrent((i) => (i - 1 + images.length) % images.length), [images.length])
  const goNext = useCallback(() => setCurrent((i) => (i + 1) % images.length), [images.length])

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handler)
    }
  }, [onClose, goPrev, goNext])

  const shareCurrent = async () => {
    const url = images[current]
    if (navigator.share) {
      try {
        await navigator.share({ url })
        return
      } catch {
        // ignore canceled share
      }
    }
    await navigator.clipboard.writeText(url)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 py-4 text-white">
        <div>
          <div className="text-sm font-semibold">图片</div>
          <div className="text-xs text-white/60">
            {current + 1} / {images.length}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation()
              shareCurrent()
            }}
            aria-label="分享图片"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
              <path d="M12 16V3" />
              <path d="m7 8 5-5 5 5" />
            </svg>
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            aria-label="关闭"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {images.length > 1 && (
        <>
          <button
            className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation()
              goPrev()
            }}
            aria-label="上一张"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation()
              goNext()
            }}
            aria-label="下一张"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      <div
        className="max-h-[92vh] max-w-[96vw] px-14 py-16 sm:px-20"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current
          const end = e.changedTouches[0]?.clientX ?? null
          touchStartX.current = null
          if (start == null || end == null) return
          const delta = end - start
          if (Math.abs(delta) < 40) return
          if (delta > 0) goPrev()
          else goNext()
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[current]}
          alt={`图片 ${current + 1}`}
          className="max-h-[calc(92vh-120px)] max-w-full rounded-2xl object-contain shadow-2xl"
          style={{ display: 'block' }}
        />
      </div>

      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-4 pb-5 pt-12">
          <div className="mx-auto flex max-w-xl items-center justify-center gap-2 overflow-x-auto">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrent(i)
                }}
                className={`relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border transition-all ${current === i ? 'scale-105' : 'opacity-60'}`}
                style={{ borderColor: current === i ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.18)' }}
                aria-label={`查看第 ${i + 1} 张图片`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`缩略图 ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * X(Twitter) 风格图片网格，支持 lightbox 点击查看
 * - 1 张：16:9 全宽
 * - 2 张：左右各半，4:3
 * - 3 张：左侧大图，右侧两张叠放
 * - 4 张：2×2
 * - 5-9 张：3 列方格
 */
export function MomentsImageGrid({ images, title = '', priority = false }: MomentsImageGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const count = images.length
  if (count === 0) return null

  const open = (i: number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setLightboxIndex(i)
  }

  const cell = (src: string, i: number, aspect: string, sizes: string, p?: boolean) => (
    <div
      key={i}
      className="relative cursor-pointer select-none overflow-hidden transition-opacity hover:opacity-90"
      style={{ aspectRatio: aspect }}
      onClick={open(i)}
    >
      <Image
        src={src}
        alt={`${title} ${i + 1}`}
        fill
        className="object-cover"
        priority={p}
        sizes={sizes}
        quality={85}
      />
    </div>
  )

  let grid: React.ReactNode
  if (count === 1) {
    grid = (
      <div
        className="relative cursor-pointer overflow-hidden rounded-2xl transition-opacity hover:opacity-90"
        style={{ aspectRatio: '16/9', border: '1px solid var(--border)' }}
        onClick={open(0)}
      >
        <Image
          src={images[0]}
          alt={title}
          fill
          className="object-cover"
          priority={priority}
          sizes="(max-width: 640px) calc(100vw - 32px), 560px"
          quality={85}
        />
      </div>
    )
  } else if (count === 2) {
    grid = (
      <div
        className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-2xl"
        style={{ border: '1px solid var(--border)' }}
      >
        {images.map((src, i) => cell(src, i, '4/3', '(max-width: 640px) 50vw, 280px', priority && i === 0))}
      </div>
    )
  } else if (count === 3) {
    grid = (
      <div
        className="grid gap-0.5 overflow-hidden rounded-2xl"
        style={{ border: '1px solid var(--border)', gridTemplateColumns: '2fr 1fr', gridTemplateRows: 'auto' }}
      >
        <div
          className="relative row-span-2 cursor-pointer select-none overflow-hidden transition-opacity hover:opacity-90"
          style={{ aspectRatio: '2/3' }}
          onClick={open(0)}
        >
          <Image
            src={images[0]}
            alt={`${title} 1`}
            fill
            className="object-cover"
            priority={priority}
            sizes="(max-width: 640px) 55vw, 360px"
            quality={85}
          />
        </div>
        {[1, 2].map((i) => cell(images[i], i, '4/3', '(max-width: 640px) 40vw, 200px', false))}
      </div>
    )
  } else if (count === 4) {
    grid = (
      <div
        className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-2xl"
        style={{ border: '1px solid var(--border)' }}
      >
        {images.map((src, i) => cell(src, i, '4/3', '(max-width: 640px) 50vw, 280px', priority && i < 2))}
      </div>
    )
  } else {
    grid = (
      <div
        className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-2xl"
        style={{ border: '1px solid var(--border)' }}
      >
        {images.map((src, i) => cell(src, i, '1/1', '(max-width: 640px) 33vw, 185px', priority && i < 3))}
      </div>
    )
  }

  return (
    <>
      <div className="mt-2.5">{grid}</div>
      {lightboxIndex !== null && (
        <ImageLightbox images={images} index={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  )
}
