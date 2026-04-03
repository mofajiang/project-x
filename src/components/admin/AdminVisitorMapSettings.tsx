'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Settings2, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Props = {
  initialMode: string
  initialEndpoint: string
}

export function AdminVisitorMapSettings({ initialMode, initialEndpoint }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [mode, setMode] = useState(initialMode || 'ip9')
  const [endpoint, setEndpoint] = useState(initialEndpoint || '')

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorGeoMode: mode, visitorGeoKey: '', visitorGeoEndpoint: endpoint }),
      })
      if (!res.ok) throw new Error('保存失败')
      toast.success('访客地图接口已保存')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const clearLogs = async () => {
    if (!confirm('确定清除所有访客日志？此操作不可恢复。')) return
    setClearing(true)
    try {
      const res = await fetch('/api/admin/visitors', { method: 'DELETE' })
      if (!res.ok) throw new Error('清除失败')
      toast.success('访客日志已清除')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('清除失败')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
        style={{ background: open ? 'var(--bg-hover)' : 'transparent', color: 'var(--text-secondary)' }}
        title="访客地图设置"
      >
        <Settings2 size={16} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[320px] max-w-[calc(100vw-1rem)] rounded-2xl shadow-2xl p-4 z-20" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>访客地图设置</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>选择离线数据库、腾讯、IPStack、IPIP 或自定义接口</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>关闭</button>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>地理来源</span>
              <select
                value={mode}
                onChange={e => setMode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                <option value="offline">离线数据库</option>
                <option value="ip9">IP9 公共接口</option>
                <option value="custom">自定义接口</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>自定义接口</span>
              <input
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
                placeholder="https://example.com/geo?ip={ip}"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                disabled={mode !== 'custom'}
                style={{ background: mode === 'custom' ? 'var(--bg-hover)' : 'var(--bg)', color: 'var(--text-primary)', opacity: mode === 'custom' ? 1 : 0.6 }}
              />
            </label>

            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              推荐使用 IP9：<span style={{ color: 'var(--text-primary)' }}>https://ip9.com.cn/get?ip=&#123;ip&#125;</span>（公共接口，免费限频约 60 次/分钟）。
              自定义接口支持 <span style={{ color: 'var(--text-primary)' }}>{'{ip}'}</span> 占位符；不填时会自动追加 <span style={{ color: 'var(--text-primary)' }}>ip</span> 参数。
            </p>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              保存设置
            </button>

            <button
              type="button"
              onClick={clearLogs}
              disabled={clearing}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-60"
              style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}
            >
              {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              清除日志
            </button>
          </div>
        </div>
      )}
    </div>
  )
}