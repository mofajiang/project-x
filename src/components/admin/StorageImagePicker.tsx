'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'

type UploadFile = {
  name: string
  url: string
  ext: string
  size: number
  updatedAt: string
}

type Props = {
  onSelect: (url: string) => void
  buttonText?: string
  className?: string
  // Segmented mode: when provided, shows [local | cloud] pill control
  onLocalClick?: () => void
  localLoading?: boolean
  localButtonText?: string
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'])

export function StorageImagePicker({ onSelect, buttonText = '从云存储选择', className = '', onLocalClick, localLoading, localButtonText }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [error, setError] = useState('')
  const [files, setFiles] = useState<UploadFile[]>([])

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    const imageFiles = files.filter(f => IMAGE_EXTS.has((f.ext || '').toLowerCase()))
    if (!k) return imageFiles
    return imageFiles.filter(f => f.name.toLowerCase().includes(k) || f.url.toLowerCase().includes(k))
  }, [files, keyword])

  const openPicker = async () => {
    setOpen(true)
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/uploads', { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || '读取文件失败')
      setFiles(Array.isArray(data?.files) ? data.files : [])
    } catch (err: any) {
      const msg = err?.message || '读取文件失败'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {onLocalClick ? (
        <div className="flex rounded-full overflow-hidden text-sm font-medium" style={{ border: '1px solid var(--border)', width: 'fit-content' }}>
          <button
            type="button"
            onClick={onLocalClick}
            disabled={localLoading}
            className="px-3 py-1.5 disabled:opacity-50 transition-colors"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          >
            {localLoading ? '上传中…' : (localButtonText || '本地上传')}
          </button>
          <div style={{ width: 1, flexShrink: 0, background: 'var(--border)' }} />
          <button
            type="button"
            onClick={openPicker}
            className="px-3 py-1.5 transition-colors"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          >
            ☁️ 云存储
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          className={className || 'px-3 py-2 rounded-full text-sm font-medium'}
          style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        >
          {buttonText}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border p-4"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>选择云存储图片</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                关闭
              </button>
            </div>

            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="搜索文件名或 URL"
              className="w-full px-3 py-2 rounded-xl border outline-none text-sm mb-3"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'transparent' }}
            />

            {loading ? (
              <div className="py-8 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>加载中...</div>
            ) : error ? (
              <div className="py-6 text-sm text-center" style={{ color: '#ef4444' }}>{error}</div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>没有可选图片</div>
            ) : (
              <div className="max-h-[60vh] overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filtered.map(file => (
                  <button
                    key={file.url}
                    type="button"
                    onClick={() => {
                      onSelect(file.url)
                      setOpen(false)
                    }}
                    className="text-left rounded-xl border p-2 transition-colors"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                  >
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={file.url} alt={file.name} className="w-10 h-10 rounded object-cover" loading="lazy" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{file.url}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
