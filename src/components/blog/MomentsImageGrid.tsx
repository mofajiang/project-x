import Image from 'next/image'

interface MomentsImageGridProps {
  images: string[]
  title?: string
  priority?: boolean
}

/**
 * 微信朋友圈风格图片网格
 * - 1 张：正方形居中，最宽 280px
 * - 2 张：2列等宽
 * - 3 张：3列等宽
 * - 4 张：2×2
 * - 5-9 张：最多3列行
 */
export function MomentsImageGrid({ images, title = '', priority = false }: MomentsImageGridProps) {
  const count = images.length
  if (count === 0) return null

  if (count === 1) {
    return (
      <div className="mt-2.5 flex justify-center">
        <div
          className="overflow-hidden rounded-2xl"
          style={{ border: '1px solid var(--border)', width: '100%', maxWidth: 280 }}
        >
          <Image
            src={images[0]}
            alt={title}
            width={280}
            height={280}
            className="h-full w-full object-cover"
            style={{ aspectRatio: '1/1', display: 'block' }}
            priority={priority}
            sizes="280px"
            quality={85}
          />
        </div>
      </div>
    )
  }

  const cols = count === 4 ? 2 : Math.min(count, 3)
  return (
    <div className="mt-2.5 overflow-hidden rounded-2xl" style={{ border: '1px solid var(--border)' }}>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {images.map((src, i) => (
          <div key={i} className="overflow-hidden" style={{ aspectRatio: '1/1' }}>
            <Image
              src={src}
              alt={`${title} ${i + 1}`}
              width={200}
              height={200}
              className="h-full w-full object-cover"
              priority={priority && i < 3}
              sizes={`(max-width: 640px) ${Math.floor(100 / cols)}vw, ${Math.floor(600 / cols)}px`}
              quality={80}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
