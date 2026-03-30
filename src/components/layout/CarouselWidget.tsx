'use client'
import { useState, useEffect, useCallback } from 'react'
import type { CarouselSlide } from '@/lib/config'

interface Props {
  slides: CarouselSlide[]
  interval?: number
  title?: string
}

export function CarouselWidget({ slides, interval = 3000, title }: Props) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)

  const next = useCallback(() => {
    setCurrent(c => (c + 1) % slides.length)
  }, [slides.length])

  const prev = () => setCurrent(c => (c - 1 + slides.length) % slides.length)

  useEffect(() => {
    if (paused || slides.length <= 1) return
    const timer = setInterval(next, interval)
    return () => clearInterval(timer)
  }, [paused, interval, next, slides.length])

  if (!slides.length) return null

  const slide = slides[current]

  const inner = (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>
      {/* 图片 */}
      <img
        src={slide.image}
        alt={slide.title || ''}
        className="w-full h-full object-cover transition-opacity duration-500"
        key={current}
      />
      {/* 渐变遮罩 + 文字 */}
      {(slide.title || slide.desc) && (
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-6"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
          {slide.title && (
            <p className="text-sm font-bold text-white leading-snug line-clamp-2">{slide.title}</p>
          )}
          {slide.desc && (
            <p className="text-xs text-white/70 mt-0.5 line-clamp-1">{slide.desc}</p>
          )}
        </div>
      )}
      {/* 左右箭头 */}
      {slides.length > 1 && (
        <>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); prev() }}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.45)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); next() }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.45)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </>
      )}
      {/* 指示点 */}
      {slides.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.preventDefault(); e.stopPropagation(); setCurrent(i) }}
              className="rounded-full transition-all"
              style={{
                width: i === current ? 16 : 6,
                height: 6,
                background: i === current ? 'white' : 'rgba(255,255,255,0.5)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div
      className="rounded-2xl overflow-hidden mb-3"
      style={{ background: 'var(--bg-secondary)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {title && (
        <h2 className="font-extrabold text-[20px] px-4 pt-3 pb-1" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      )}
      {slide.link ? (
        <a href={slide.link} target="_blank" rel="noopener noreferrer" className="block">
          {inner}
        </a>
      ) : inner}
    </div>
  )
}
