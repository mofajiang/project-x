'use client'

import { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import toast from 'react-hot-toast'
import { ADMIN_PAGE_TITLE_CLASS } from '@/components/admin/adminUi'
import { getErrorMessage } from '@/lib/converters';

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

type StorageConfig = {
  storageDriver: 'local' | 's3' | 'smms'
  storageS3Endpoint: string
  storageS3Region: string
  storageS3Bucket: string
  storageS3AccessKeyId: string
  storageS3SecretAccessKey: string
  storageS3Prefix: string
  storageS3ForcePathStyle: boolean
  storagePublicBaseUrl: string
  storageSmmsToken: string
}

const STORAGE_DRIVER_OPTIONS = [
  { value: 'local', label: '本地存储' },
  { value: 's3', label: 'S3 兼容存储' },
  { value: 'smms', label: 'SM.MS 图床' },
] as const

function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function extIcon(ext: string) {
  const e = ext.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'].includes(e)) return '🖼'
  if (['mp4', 'webm', 'mov'].includes(e)) return '🎬'
  if (['mp3', 'wav', 'ogg'].includes(e)) return '🎵'
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(e)) return '📄'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return '🗜'
  return '📁'
}

export default function AdminUploadsPage() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [batchDownloading, setBatchDownloading] = useState(false)
  const [savingStorage, setSavingStorage] = useState(false)
  const [testingStorage, setTestingStorage] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [keyword, setKeyword] = useState('')
  const [customName, setCustomName] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [listError, setListError] = useState('')
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({})
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null)
  const [storageConfig, setStorageConfig] = useState<StorageConfig>({
    storageDriver: 'local',
    storageS3Endpoint: '',
    storageS3Region: 'auto',
    storageS3Bucket: '',
    storageS3AccessKeyId: '',
    storageS3SecretAccessKey: '',
    storageS3Prefix: 'uploads/',
    storageS3ForcePathStyle: false,
    storagePublicBaseUrl: '',
    storageSmmsToken: '',
  })

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    if (!k) return files
    return files.filter(f => f.name.toLowerCase().includes(k) || f.ext.toLowerCase().includes(k))
  }, [files, keyword])

  const selectedFiles = useMemo(
    () => filtered.filter(f => !!selectedMap[f.name]),
    [filtered, selectedMap]
  )
  const allSelectedInView = filtered.length > 0 && filtered.every(f => !!selectedMap[f.name])

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
      const nextFiles = Array.isArray(data.files) ? data.files : []
      setFiles(nextFiles)
      setSelectedMap(prev => {
        const names = new Set(nextFiles.map((f: UploadFile) => f.name))
        const next: Record<string, boolean> = {}
        for (const key of Object.keys(prev)) {
          if (names.has(key)) next[key] = prev[key]
        }
        return next
      })
    } catch (err: unknown) {
      const msg = String(getErrorMessage(err) || '')
      if (!msg.includes('不支持文件列表')) {
        toast.error(getErrorMessage(err) || '获取文件失败')
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

  const fetchStorageConfig = async () => {
    try {
      const res = await fetch('/api/admin/config', { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) return
      setStorageConfig({
        storageDriver: (data.storageDriver || 'local') as 'local' | 's3' | 'smms',
        storageS3Endpoint: data.storageS3Endpoint || '',
        storageS3Region: data.storageS3Region || 'auto',
        storageS3Bucket: data.storageS3Bucket || '',
        storageS3AccessKeyId: data.storageS3AccessKeyId || '',
        storageS3SecretAccessKey: data.storageS3SecretAccessKey || '',
        storageS3Prefix: data.storageS3Prefix || 'uploads/',
        storageS3ForcePathStyle: !!data.storageS3ForcePathStyle,
        storagePublicBaseUrl: data.storagePublicBaseUrl || '',
        storageSmmsToken: data.storageSmmsToken || '',
      })
    } catch {}
  }

  useEffect(() => {
    fetchFiles()
    fetchStorageStatus()
    fetchStorageConfig()
  }, [])

  const saveStorageConfig = async () => {
    setSavingStorage(true)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storageConfig),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || '保存失败')
      toast.success('存储设置已保存')
      await fetchStorageStatus()
      await fetchFiles()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || '保存失败')
    } finally {
      setSavingStorage(false)
    }
  }

  const testStorage = async () => {
    setTestingStorage(true)
    try {
      const res = await fetch('/api/admin/storage/test', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || '测试失败')
      toast.success(data?.message || '测试成功')
      await fetchStorageStatus()
      await fetchFiles()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || '测试失败')
    } finally {
      setTestingStorage(false)
    }
  }

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
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || '上传失败')
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
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || '删除失败')
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
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || '重命名失败')
    }
  }

  const toggleSelect = (name: string, checked: boolean) => {
    setSelectedMap(prev => ({ ...prev, [name]: checked }))
  }

  const toggleSelectAllInView = (checked: boolean) => {
    setSelectedMap(prev => {
      const next = { ...prev }
      for (const file of filtered) next[file.name] = checked
      return next
    })
  }

  const handleBatchDelete = async () => {
    if (!selectedFiles.length) {
      toast.error('请先选择文件')
      return
    }
    if (!confirm(`确认批量删除 ${selectedFiles.length} 个文件吗？`)) return

    setBatchDeleting(true)
    try {
      const results = await Promise.allSettled(
        selectedFiles.map(file =>
          fetch(`/api/admin/uploads/${encodeURIComponent(file.name)}`, { method: 'DELETE' })
        )
      )
      const success = results.filter(r => r.status === 'fulfilled').length
      const failed = results.length - success
      if (failed === 0) toast.success(`已删除 ${success} 个文件`)
      else toast.error(`删除完成：成功 ${success}，失败 ${failed}`)
      await fetchFiles()
    } finally {
      setBatchDeleting(false)
    }
  }

  const handleBatchDownload = async () => {
    if (!selectedFiles.length) {
      toast.error('请先选择文件')
      return
    }
    setBatchDownloading(true)
    try {
      const zip = new JSZip()
      for (const file of selectedFiles) {
        const res = await fetch(`/api/admin/uploads/${encodeURIComponent(file.name)}`)
        if (!res.ok) throw new Error(`下载失败: ${file.name}`)
        const blob = await res.blob()
        zip.file(file.name, blob)
      }

      const archive = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a')
      const url = URL.createObjectURL(archive)
      a.href = url
      a.download = `uploads-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`已打包下载 ${selectedFiles.length} 个文件`)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || '批量下载失败')
    } finally {
      setBatchDownloading(false)
    }
  }

  return (
    <div className='w-full max-w-7xl mx-auto'>
      <div className='grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4'>
        <section className='rounded-2xl p-4' style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className='rounded-2xl p-3 mb-3' style={{ background: 'linear-gradient(135deg, rgba(29,155,240,0.15), rgba(34,197,94,0.08))' }}>
            <div className='grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2'>
              <input
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder='自定义文件名（可选）'
                className='px-3 py-2 rounded-xl border bg-transparent outline-none text-sm'
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              <label className='px-4 py-2 rounded-xl text-sm font-medium text-white cursor-pointer text-center' style={{ background: 'var(--accent)' }}>
                {uploading ? '上传中...' : '上传文件'}
                <input type='file' className='hidden' onChange={uploadFile} disabled={uploading} />
              </label>
              <button
                onClick={fetchFiles}
                className='px-4 py-2 rounded-xl text-sm'
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                刷新
              </button>
            </div>
          </div>

          <div className='rounded-xl p-3 mb-3 flex items-center gap-2' style={{ background: 'var(--bg-hover)' }}>
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder='搜索文件名 / 后缀'
              className='w-full px-3 py-2 rounded-lg border bg-transparent outline-none text-sm'
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
            <span className='text-xs shrink-0' style={{ color: 'var(--text-secondary)' }}>{filtered.length} 项</span>
          </div>

          <div className='rounded-xl p-3 mb-3 flex flex-wrap items-center gap-2' style={{ background: 'var(--bg-hover)' }}>
            <label className='inline-flex items-center gap-2 text-xs' style={{ color: 'var(--text-secondary)' }}>
              <input type='checkbox' checked={allSelectedInView} onChange={e => toggleSelectAllInView(e.target.checked)} />
              当前视图全选
            </label>
            <span className='text-xs' style={{ color: 'var(--text-secondary)' }}>已选 {selectedFiles.length}</span>
            <button
              onClick={() => setViewMode(v => (v === 'list' ? 'grid' : 'list'))}
              className='px-3 py-1.5 rounded-lg text-xs'
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              {viewMode === 'list' ? '切换网格' : '切换列表'}
            </button>
            {storageStatus?.capabilities.download !== false && (
              <button
                onClick={handleBatchDownload}
                disabled={batchDownloading || selectedFiles.length === 0}
                className='px-3 py-1.5 rounded-lg text-xs text-white disabled:opacity-50'
                style={{ background: '#0ea5e9' }}
              >
                {batchDownloading ? '打包中...' : '批量下载'}
              </button>
            )}
            {storageStatus?.capabilities.delete !== false && (
              <button
                onClick={handleBatchDelete}
                disabled={batchDeleting || selectedFiles.length === 0}
                className='px-3 py-1.5 rounded-lg text-xs text-white disabled:opacity-50'
                style={{ background: '#64748b' }}
              >
                {batchDeleting ? '删除中...' : '批量删除'}
              </button>
            )}
          </div>

          {!loading && !!listError && (
            <div className='rounded-xl p-3 mb-3 text-sm' style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', color: '#b45309' }}>
              <p>{listError}</p>
            </div>
          )}

          {viewMode === 'list' ? (
            <div className='rounded-xl overflow-hidden border' style={{ borderColor: 'var(--border)' }}>
              <div className='grid grid-cols-[36px_1fr_120px_180px_220px] gap-2 px-4 py-3 text-xs font-medium' style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                <span></span>
                <span>文件名</span>
                <span>大小</span>
                <span>更新时间</span>
                <span>操作</span>
              </div>

              {loading ? (
                <div className='py-12 text-center text-sm' style={{ color: 'var(--text-secondary)' }}>加载中...</div>
              ) : filtered.length === 0 ? (
                <div className='py-12 text-center text-sm' style={{ color: 'var(--text-secondary)' }}>暂无文件</div>
              ) : (
                <div className='divide-y' style={{ borderColor: 'var(--border)' }}>
                  {filtered.map(file => (
                    <div key={file.name} className='grid grid-cols-[36px_1fr_120px_180px_220px] gap-2 px-4 py-3 items-center text-sm'>
                      <label className='inline-flex items-center justify-center'>
                        <input type='checkbox' checked={!!selectedMap[file.name]} onChange={e => toggleSelect(file.name, e.target.checked)} />
                      </label>
                      <div className='min-w-0'>
                        {editingName === file.name ? (
                          <div className='flex gap-2'>
                            <input
                              value={renameDraft}
                              onChange={e => setRenameDraft(e.target.value)}
                              className='flex-1 px-3 py-2 rounded-lg border bg-transparent outline-none text-sm'
                              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                            />
                            <button onClick={() => saveRename(file.name)} className='px-3 py-2 rounded-lg text-xs text-white' style={{ background: 'var(--accent)' }}>保存</button>
                            <button onClick={() => setEditingName(null)} className='px-3 py-2 rounded-lg text-xs' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>取消</button>
                          </div>
                        ) : (
                          <div className='flex items-center gap-2 min-w-0'>
                            <span>{extIcon(file.ext)}</span>
                            <div className='min-w-0'>
                              <p className='truncate font-medium' style={{ color: 'var(--text-primary)' }}>{file.name}</p>
                              <p className='truncate text-xs' style={{ color: 'var(--text-secondary)' }}>{file.url}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <span className='text-xs' style={{ color: 'var(--text-secondary)' }}>{formatSize(file.size)}</span>
                      <span className='text-xs' style={{ color: 'var(--text-secondary)' }}>{new Date(file.updatedAt).toLocaleString('zh-CN', { hour12: false })}</span>
                      <div className='flex items-center gap-1'>
                        {storageStatus?.capabilities.download !== false && (
                          <a href={`/api/admin/uploads/${encodeURIComponent(file.name)}`} className='px-2 py-1 rounded text-xs' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>下载</a>
                        )}
                        <a href={file.url} target='_blank' rel='noopener noreferrer' className='px-2 py-1 rounded text-xs' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>访问</a>
                        {storageStatus?.capabilities.rename !== false && (
                          <button onClick={() => beginRename(file.name)} className='px-2 py-1 rounded text-xs' style={{ background: 'rgba(29,155,240,0.12)', color: 'var(--accent)' }}>重命名</button>
                        )}
                        {storageStatus?.capabilities.delete !== false && (
                          <button onClick={() => deleteFile(file.name)} className='px-2 py-1 rounded text-xs text-white' style={{ background: '#64748b' }}>删除</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'>
              {loading ? (
                <div className='col-span-full py-12 text-center text-sm' style={{ color: 'var(--text-secondary)' }}>加载中...</div>
              ) : filtered.length === 0 ? (
                <div className='col-span-full py-12 text-center text-sm' style={{ color: 'var(--text-secondary)' }}>暂无文件</div>
              ) : (
                filtered.map(file => (
                  <div key={file.name} className='rounded-xl p-3 border' style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
                    <div className='flex items-start justify-between gap-2'>
                      <label className='inline-flex items-center gap-2 text-xs' style={{ color: 'var(--text-secondary)' }}>
                        <input type='checkbox' checked={!!selectedMap[file.name]} onChange={e => toggleSelect(file.name, e.target.checked)} />
                        选择
                      </label>
                      <span className='text-xs' style={{ color: 'var(--text-secondary)' }}>{formatSize(file.size)}</span>
                    </div>
                    <div className='mt-2 flex items-center gap-2 min-w-0'>
                      <span>{extIcon(file.ext)}</span>
                      <p className='truncate font-medium text-sm' style={{ color: 'var(--text-primary)' }}>{file.name}</p>
                    </div>
                    <p className='text-xs mt-1 truncate' style={{ color: 'var(--text-secondary)' }}>{file.url}</p>
                    <p className='text-xs mt-1' style={{ color: 'var(--text-secondary)' }}>{new Date(file.updatedAt).toLocaleString('zh-CN', { hour12: false })}</p>
                    <div className='mt-3 flex flex-wrap gap-1'>
                      {storageStatus?.capabilities.download !== false && (
                        <a href={`/api/admin/uploads/${encodeURIComponent(file.name)}`} className='px-2 py-1 rounded text-xs' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>下载</a>
                      )}
                      <a href={file.url} target='_blank' rel='noopener noreferrer' className='px-2 py-1 rounded text-xs' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>访问</a>
                      {storageStatus?.capabilities.rename !== false && (
                        <button onClick={() => beginRename(file.name)} className='px-2 py-1 rounded text-xs' style={{ background: 'rgba(29,155,240,0.12)', color: 'var(--accent)' }}>重命名</button>
                      )}
                      {storageStatus?.capabilities.delete !== false && (
                        <button onClick={() => deleteFile(file.name)} className='px-2 py-1 rounded text-xs text-white' style={{ background: '#64748b' }}>删除</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        <aside className='rounded-2xl p-4 h-fit sticky top-4' style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <h2 className='text-base font-bold mb-2' style={{ color: 'var(--text-primary)' }}>存储设置</h2>
          <p className='text-xs mb-3' style={{ color: 'var(--text-secondary)' }}>上传管理页内直接配置与测试</p>

          <div className='space-y-3'>
            <div>
              <label className='block text-xs mb-1' style={{ color: 'var(--text-secondary)' }}>存储类型</label>
              <select
                value={storageConfig.storageDriver}
                onChange={e => setStorageConfig(s => ({ ...s, storageDriver: e.target.value as 'local' | 's3' | 'smms' }))}
                className='w-full px-3 py-2 rounded-xl text-sm outline-none'
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
              >
                {STORAGE_DRIVER_OPTIONS.map(item => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            {storageStatus && (
              <div className='rounded-xl p-3 text-xs' style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                <p>配置驱动：{storageStatus.configuredDriver.toUpperCase()}</p>
                <p>当前生效：{storageStatus.activeDriver.toUpperCase()}</p>
                {!!storageStatus.fallbackReason && (
                  <p className='mt-1' style={{ color: '#b45309' }}>
                    {storageStatus.fallbackReason === 's3_config_incomplete'
                      ? 'S3 配置不完整，系统已回退本地。'
                      : 'SM.MS Token 未配置，系统已回退本地。'}
                  </p>
                )}
                <div className='flex flex-wrap gap-1 mt-2'>
                  <span className='px-2 py-1 rounded-lg' style={{ background: storageStatus.capabilities.upload ? 'rgba(34,197,94,0.14)' : 'rgba(148,163,184,0.2)', color: storageStatus.capabilities.upload ? '#15803d' : '#475569' }}>上传</span>
                  <span className='px-2 py-1 rounded-lg' style={{ background: storageStatus.capabilities.list ? 'rgba(34,197,94,0.14)' : 'rgba(148,163,184,0.2)', color: storageStatus.capabilities.list ? '#15803d' : '#475569' }}>列表</span>
                  <span className='px-2 py-1 rounded-lg' style={{ background: storageStatus.capabilities.download ? 'rgba(34,197,94,0.14)' : 'rgba(148,163,184,0.2)', color: storageStatus.capabilities.download ? '#15803d' : '#475569' }}>下载</span>
                  <span className='px-2 py-1 rounded-lg' style={{ background: storageStatus.capabilities.rename ? 'rgba(34,197,94,0.14)' : 'rgba(148,163,184,0.2)', color: storageStatus.capabilities.rename ? '#15803d' : '#475569' }}>重命名</span>
                  <span className='px-2 py-1 rounded-lg' style={{ background: storageStatus.capabilities.delete ? 'rgba(34,197,94,0.14)' : 'rgba(148,163,184,0.2)', color: storageStatus.capabilities.delete ? '#15803d' : '#475569' }}>删除</span>
                </div>
              </div>
            )}

            {storageConfig.storageDriver === 's3' && (
              <div className='space-y-2'>
                <input value={storageConfig.storageS3Endpoint} onChange={e => setStorageConfig(s => ({ ...s, storageS3Endpoint: e.target.value }))} placeholder='Endpoint' className='w-full px-3 py-2 rounded-xl text-sm outline-none' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
                <input value={storageConfig.storageS3Region} onChange={e => setStorageConfig(s => ({ ...s, storageS3Region: e.target.value }))} placeholder='Region (auto)' className='w-full px-3 py-2 rounded-xl text-sm outline-none' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
                <input value={storageConfig.storageS3Bucket} onChange={e => setStorageConfig(s => ({ ...s, storageS3Bucket: e.target.value }))} placeholder='Bucket' className='w-full px-3 py-2 rounded-xl text-sm outline-none' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
                <input value={storageConfig.storageS3Prefix} onChange={e => setStorageConfig(s => ({ ...s, storageS3Prefix: e.target.value }))} placeholder='Key Prefix (uploads/)' className='w-full px-3 py-2 rounded-xl text-sm outline-none' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
                <input value={storageConfig.storageS3AccessKeyId} onChange={e => setStorageConfig(s => ({ ...s, storageS3AccessKeyId: e.target.value }))} placeholder='Access Key' className='w-full px-3 py-2 rounded-xl text-sm outline-none' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
                <input type='password' value={storageConfig.storageS3SecretAccessKey} onChange={e => setStorageConfig(s => ({ ...s, storageS3SecretAccessKey: e.target.value }))} placeholder='Secret Key' className='w-full px-3 py-2 rounded-xl text-sm outline-none' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
                <input value={storageConfig.storagePublicBaseUrl} onChange={e => setStorageConfig(s => ({ ...s, storagePublicBaseUrl: e.target.value }))} placeholder='公网访问前缀 https://cdn.example.com' className='w-full px-3 py-2 rounded-xl text-sm outline-none' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
                <label className='flex items-center gap-2 text-xs' style={{ color: 'var(--text-primary)' }}>
                  <input type='checkbox' checked={storageConfig.storageS3ForcePathStyle} onChange={e => setStorageConfig(s => ({ ...s, storageS3ForcePathStyle: e.target.checked }))} />
                  使用 Path-Style
                </label>
              </div>
            )}

            {storageConfig.storageDriver === 'smms' && (
              <div className='space-y-2'>
                <input type='password' value={storageConfig.storageSmmsToken} onChange={e => setStorageConfig(s => ({ ...s, storageSmmsToken: e.target.value }))} placeholder='SM.MS Token' className='w-full px-3 py-2 rounded-xl text-sm outline-none' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
                <p className='text-xs' style={{ color: 'var(--text-secondary)' }}>SM.MS 模式仅支持上传，不支持列表/重命名/删除。</p>
              </div>
            )}

            <div className='grid grid-cols-2 gap-2 pt-2'>
              <button onClick={saveStorageConfig} disabled={savingStorage} className='px-3 py-2 rounded-xl text-sm text-white disabled:opacity-50' style={{ background: 'var(--accent)' }}>
                {savingStorage ? '保存中...' : '保存设置'}
              </button>
              <button onClick={testStorage} disabled={testingStorage} className='px-3 py-2 rounded-xl text-sm disabled:opacity-50' style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                {testingStorage ? '测试中...' : '测试连接'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
