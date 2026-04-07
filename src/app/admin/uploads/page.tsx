'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ADMIN_PAGE_TITLE_CLASS } from '@/components/admin/adminUi'

type UploadFile = {
  name: string
  url: string
  size: number
  updatedAt: string
  ext: string
}

type StorageStatus = {
  configuredDriver: 'local' | 's3' | 'smms'
  activeDriver: 'local' | 's3' | 'smms'
  fallbackReason?: 's3_config_incomplete' | 'smms_config_incomplete'
  capabilities: {
    upload: boolean
    list: boolean
    download: boolean
    rename: boolean
    delete: boolean
  }
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export default function AdminUploadsPage() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [customName, setCustomName] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [listError, setListError] = useState('')
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null)

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    if (!k) return files
    return files.filter(f => f.name.toLowerCase().includes(k) || f.ext.toLowerCase().includes(k))
  }, [files, keyword])

  const fetchFiles = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/uploads', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        const message = data?.error || '获取失败'
        setListError(message)
        throw new Error(message)
      }
      setListError('')
      setFiles(Array.isArray(data.files) ? data.files : [])
    } catch (err: any) {
      const msg = String(err?.message || '')
      if (!msg.includes('不支持文件列表')) {
        toast.error(err?.message || '获取文件失败')
      }
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStorageStatus = async () => {
    try {
      const res = await fetch('/api/admin/storage/status', { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.activeDriver) {
        setStorageStatus(null)
        return
      }
      setStorageStatus(data)
    } catch {
      setStorageStatus(null)
    }
  }

  useEffect(() => {
    fetchFiles()
    fetchStorageStatus()
  }, [])

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const form = new FormData()
    form.append('file', file)
    if (customName.trim()) form.append('fileName', customName.trim())

    setUploading(true)
    try {
      const res = await fetch('/api/admin/uploads', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '上传失败')
      toast.success('上传成功')
      setCustomName('')
      fetchFiles()
    } catch (err: any) {
      toast.error(err?.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const deleteFile = async (name: string) => {
    if (!confirm(`确认删除 ${name} ?`)) return
    try {
      const res = await fetch(`/api/admin/uploads/${encodeURIComponent(name)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || '删除失败')
      toast.success('删除成功')
      fetchFiles()
    } catch (err: any) {
      toast.error(err?.message || '删除失败')
    }
  }

  const beginRename = (name: string) => {
    setEditingName(name)
    setRenameDraft(name)
  }

  const saveRename = async (name: string) => {
    const next = renameDraft.trim()
    if (!next) {
      toast.error('请输入新文件名')
      return
    }
    try {
      const res = await fetch(`/api/admin/uploads/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || '重命名失败')
      toast.success('已重命名')
      setEditingName(null)
      setRenameDraft('')
      fetchFiles()
    } catch (err: any) {
      toast.error(err?.message || '重命名失败')
    }
  }

  return (
    <div className='w-full max-w-6xl mx-auto'>
      <h1 className={ADMIN_PAGE_TITLE_CLASS} style={{ color: 'var(--text-primary)' }}>文件上传管理</h1>

      <div className='rounded-2xl p-4 mb-5' style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <div className='grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2'>
          <input
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            placeholder='可选：自定义文件名（不含扩展名也可）'
            className='px-3 py-2 rounded-lg border bg-transparent outline-none text-sm'
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
          <label className='px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer text-center' style={{ background: 'var(--accent)' }}>
            {uploading ? '上传中...' : '选择并上传'}
            <input type='file' className='hidden' onChange={uploadFile} disabled={uploading} />
          </label>
          <button
            onClick={fetchFiles}
            className='px-4 py-2 rounded-lg text-sm'
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          >
            刷新
          </button>
        </div>
        <p className='text-xs mt-2' style={{ color: 'var(--text-secondary)' }}>
          支持上传、下载、重命名(编辑)和删除，具体存储位置由后端存储配置决定。
        </p>
      </div>

      {storageStatus && (
        <div className='rounded-2xl p-4 mb-4 text-sm' style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-primary)' }}>
            当前存储：<b>{storageStatus.activeDriver.toUpperCase()}</b>（配置为 {storageStatus.configuredDriver.toUpperCase()}）
          </p>
          {!!storageStatus.fallbackReason && (
            <p className='mt-1' style={{ color: '#b45309' }}>
              {storageStatus.fallbackReason === 's3_config_incomplete'
                ? 'S3 配置不完整，系统已自动回退到本地存储。'
                : 'SM.MS Token 未配置，系统已自动回退到本地存储。'}
            </p>
          )}
          <div className='flex flex-wrap gap-2 mt-3 text-xs'>
            <span className='px-2 py-1 rounded-lg' style={{ background: storageStatus.capabilities.upload ? 'rgba(34,197,94,0.14)' : 'rgba(148,163,184,0.2)', color: storageStatus.capabilities.upload ? '#15803d' : '#475569' }}>上传</span>
            <span className='px-2 py-1 rounded-lg' style={{ background: storageStatus.capabilities.list ? 'rgba(34,197,94,0.14)' : 'rgba(148,163,184,0.2)', color: storageStatus.capabilities.list ? '#15803d' : '#475569' }}>列表</span>
            <span className='px-2 py-1 rounded-lg' style={{ background: storageStatus.capabilities.download ? 'rgba(34,197,94,0.14)' : 'rgba(148,163,184,0.2)', color: storageStatus.capabilities.download ? '#15803d' : '#475569' }}>下载</span>
            <span className='px-2 py-1 rounded-lg' style={{ background: storageStatus.capabilities.rename ? 'rgba(34,197,94,0.14)' : 'rgba(148,163,184,0.2)', color: storageStatus.capabilities.rename ? '#15803d' : '#475569' }}>重命名</span>
            <span className='px-2 py-1 rounded-lg' style={{ background: storageStatus.capabilities.delete ? 'rgba(34,197,94,0.14)' : 'rgba(148,163,184,0.2)', color: storageStatus.capabilities.delete ? '#15803d' : '#475569' }}>删除</span>
          </div>
        </div>
      )}

      <div className='rounded-2xl p-4 mb-4' style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder='搜索文件名或后缀'
          className='w-full px-3 py-2 rounded-lg border bg-transparent outline-none text-sm'
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        />
      </div>

      {!loading && !!listError && (
        <div className='rounded-2xl p-4 mb-4 text-sm' style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', color: '#b45309' }}>
          <p>{listError}</p>
          <p className='mt-1'>可到站点设置的存储配置切换为本地或 S3，以使用文件列表/重命名/删除能力。</p>
        </div>
      )}

      {loading ? (
        <div className='py-12 text-center' style={{ color: 'var(--text-secondary)' }}>加载中...</div>
      ) : filtered.length === 0 ? (
        <div className='py-12 text-center' style={{ color: 'var(--text-secondary)' }}>暂无文件</div>
      ) : (
        <div className='space-y-3'>
          {filtered.map(file => (
            <div key={file.name} className='rounded-xl p-4 border' style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0 flex-1'>
                  {editingName === file.name ? (
                    <div className='flex gap-2'>
                      <input
                        value={renameDraft}
                        onChange={e => setRenameDraft(e.target.value)}
                        className='flex-1 px-3 py-2 rounded-lg border bg-transparent outline-none text-sm'
                        style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                      />
                      <button onClick={() => saveRename(file.name)} className='px-3 py-2 rounded-lg text-sm text-white' style={{ background: 'var(--accent)' }}>保存</button>
                      <button onClick={() => setEditingName(null)} className='px-3 py-2 rounded-lg text-sm' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>取消</button>
                    </div>
                  ) : (
                    <p className='font-medium truncate' style={{ color: 'var(--text-primary)' }}>{file.name}</p>
                  )}
                  <p className='text-xs mt-1 break-all' style={{ color: 'var(--text-secondary)' }}>{window?.location?.origin ? `${window.location.origin}${file.url}` : file.url}</p>
                  <div className='flex flex-wrap gap-2 mt-2 text-xs' style={{ color: 'var(--text-secondary)' }}>
                    <span>类型: {file.ext || '未知'}</span>
                    <span>大小: {formatSize(file.size)}</span>
                    <span>更新时间: {new Date(file.updatedAt).toLocaleString('zh-CN', { hour12: false })}</span>
                  </div>
                </div>
                <div className='flex flex-col gap-2 shrink-0'>
                  {storageStatus?.capabilities.download !== false && (
                    <a
                      href={`/api/admin/uploads/${encodeURIComponent(file.name)}`}
                      className='px-3 py-2 rounded-lg text-sm text-center'
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    >下载</a>
                  )}
                  <a
                    href={file.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='px-3 py-2 rounded-lg text-sm text-center'
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >访问</a>
                  {storageStatus?.capabilities.rename !== false && (
                    <button onClick={() => beginRename(file.name)} className='px-3 py-2 rounded-lg text-sm' style={{ background: 'rgba(29,155,240,0.12)', color: 'var(--accent)' }}>编辑名称</button>
                  )}
                  {storageStatus?.capabilities.delete !== false && (
                    <button onClick={() => deleteFile(file.name)} className='px-3 py-2 rounded-lg text-sm text-white' style={{ background: '#64748b' }}>删除</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
