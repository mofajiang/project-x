'use client'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CarouselSlide } from '@/lib/config'

function SlideContent({ slide }: { slide: CarouselSlide }) {
  const type = slide.slideType || 'image'

  if (type === 'image') {
    if (!slide.image) return null
    return (
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <Image src={slide.image} alt={slide.title || ''} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 350px" />
        {(slide.title || slide.desc) && (
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)' }}>
            {slide.title && <p className="text-sm font-bold text-white leading-snug line-clamp-2">{slide.title}</p>}
            {slide.desc && <p className="text-xs text-white/70 mt-0.5 line-clamp-2">{slide.desc}</p>}
          </div>
        )}
      </div>
    )
  }

  if (type === 'text') {
    return (
      <div className="px-4 py-4 flex flex-col gap-2 min-h-[80px] justify-center">
        {slide.title && <p className="text-base font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>{slide.title}</p>}
        {slide.desc && <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{slide.desc}</p>}
        {slide.link && (
          <a href={slide.link} target="_blank" rel="noopener noreferrer"
            className="text-xs font-bold mt-1 self-start px-3 py-1 rounded-full transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onClick={e => e.stopPropagation()}
          >了解更多 →</a>
        )}
      </div>
    )
  }

  if (type === 'markdown') {
    return (
      <div className="px-4 py-4 prose prose-sm max-w-none"
        style={{
          color: 'var(--text-primary)',
          ['--tw-prose-body' as any]: 'var(--text-primary)',
          ['--tw-prose-headings' as any]: 'var(--text-primary)',
          ['--tw-prose-links' as any]: 'var(--accent)',
          ['--tw-prose-bold' as any]: 'var(--text-primary)',
          ['--tw-prose-bullets' as any]: 'var(--text-secondary)',
          ['--tw-prose-code' as any]: 'var(--accent)',
          ['--tw-prose-hr' as any]: 'var(--border)',
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{slide.markdown || ''}</ReactMarkdown>
      </div>
    )
  }

  return null
}

interface Props {
  slides: CarouselSlide[]
  interval?: number
  title?: string
}

export function CarouselWidget({ slides, interval = 3000, title }: Props) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)

  const validSlides = slides.filter(s => {
    const t = s.slideType || 'image'
    if (t === 'image') return !!s.image
    if (t === 'text') return !!(s.title || s.desc)
    if (t === 'markdown') return !!s.markdown
    return false
  })

  const next = useCallback(() => {
    setCurrent(c => (c + 1) % validSlides.length)
  }, [validSlides.length])

  const prev = () => setCurrent(c => (c - 1 + validSlides.length) % validSlides.length)

  useEffect(() => {
    if (paused || validSlides.length <= 1) return
    const timer = setInterval(next, interval)
    return () => clearInterval(timer)
  }, [paused, interval, next, validSlides.length])

  useEffect(() => {
    if (current >= validSlides.length && validSlides.length > 0) setCurrent(0)
  }, [validSlides.length, current])

  if (!validSlides.length) return null

  const slide = validSlides[current]
  const type = slide.slideType || 'image'
  const isImage = type === 'image'

  const content = (
    <div className="relative">
      <SlideContent slide={slide} />
      {validSlides.length > 1 && (
        <>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); prev() }}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity z-10"
            style={{ background: isImage ? 'rgba(0,0,0,0.45)' : 'var(--bg-hover)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isImage ? 'white' : 'var(--text-primary)'} strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); next() }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity z-10"
            style={{ background: isImage ? 'rgba(0,0,0,0.45)' : 'var(--bg-hover)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isImage ? 'white' : 'var(--text-primary)'} strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </>
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
      {isImage && slide.link ? (
        <a href={slide.link} target="_blank" rel="noopener noreferrer" className="block">{content}</a>
      ) : content}
      {/* 指示点 */}
      {validSlides.length > 1 && (
        <div className="flex gap-1.5 justify-center py-2">
          {validSlides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} className="rounded-full transition-all"
              style={{ width: i === current ? 16 : 6, height: 6, background: i === current ? 'var(--accent)' : 'var(--border)' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
