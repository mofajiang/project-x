'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Settings2, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Props = {
  initialMode: string
  initialEndpoint: string
  initialKey: string
  initialMapSource?: string
  initialStatsDisplay?: string
}

export function AdminVisitorMapSettings({ initialMode, initialEndpoint, initialKey, initialMapSource, initialStatsDisplay }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [updatingDb, setUpdatingDb] = useState(false)
  const [mode, setMode] = useState(initialMode || 'ip9')
  const [mapSource, setMapSource] = useState(initialMapSource || 'carto_positron')
  const defaultStatsOptions = ['总访问', '今日访问', '7 日访问', '14 日访问', '国家数', '精确坐标', '国家/省份落点', '最近时间']
  const [statsDisplay, setStatsDisplay] = useState<string[]>(() => {
    // 严格按 initialStatsDisplay 初始化
    if (!initialStatsDisplay) {
      // 第一次没有保存过配置时，显示为空（用户需要主动选择）
      return defaultStatsOptions
    }
    try {
      const parsed = JSON.parse(initialStatsDisplay)
      // 直接使用解析结果，即使为空数组；同时兼容旧的“7日访问”写法
      return Array.isArray(parsed)
        ? parsed.map((item: string) => item === '7日访问' ? '7 日访问' : item)
        : defaultStatsOptions
    } catch {
      return defaultStatsOptions
    }
  })
  const customDefaultEndpoint = 'https://example.com/api/geo?ip={ip}'
  const [endpoint, setEndpoint] = useState(initialEndpoint || (initialMode === 'custom' ? customDefaultEndpoint : ''))
  const [key, setKey] = useState(initialKey || '')

  const statsOptions = defaultStatsOptions
  const saveEndpoint = mode === 'custom' ? endpoint : ''
  const saveKey = mode === 'custom' ? key : ''

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          visitorGeoMode: mode, 
          visitorGeoKey: saveKey, 
          visitorGeoEndpoint: saveEndpoint,
          visitorMapSource: mapSource,
          visitorStatsDisplay: JSON.stringify(statsDisplay),
        }),
      })
      if (!res.ok) throw new Error('保存失败')
      toast.success('访客地图设置已保存')
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

  const updateOfflineDb = async () => {
    if (!confirm('确定更新离线数据库？这需要 MaxMind License Key（可用环境变量或下面输入框提供）。')) return
    setUpdatingDb(true)
    try {
      const res = await fetch('/api/admin/geoip/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key || undefined }),
      })
      if (!res.ok) throw new Error('更新失败')
      toast.success('离线数据库已更新')
    } catch {
      toast.error('离线数据库更新失败')
    } finally {
      setUpdatingDb(false)
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
        <div className="absolute right-0 mt-2 w-[320px] max-w-[calc(100vw-1rem)] rounded-2xl shadow-2xl p-4 z-[9999]" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>访客地图设置</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>参考 IP9 的 GET 配置方式来配置内置接口，支持离线数据库、IP9 或自定义接口</p>
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
                <option value="ipwho">ipwho.is</option>
                <option value="ipapi">ipapi.co</option>
                <option value="ipinfo">ipinfo.io</option>
                <option value="ip-api">ip-api.com</option>
                <option value="geolocation-db">geolocation-db.com</option>
                <option value="custom">自定义接口</option>
              </select>
            </label>

            {mode === 'custom' && (
              <label className="flex flex-col gap-1.5 text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>API Key（可选）</span>
                <input
                  value={key}
                  onChange={e => setKey(e.target.value)}
                  placeholder="可留空；填写后会自动加上 Authorization: Bearer"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5 text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>地图样式</span>
              <select
                value={mapSource}
                onChange={e => setMapSource(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                <option value="carto_positron">CARTO Positron（浅色）</option>
                <option value="carto_voyager">CARTO Voyager（详细）</option>
                <option value="arcgis_street">ArcGIS Street（街道）</option>
                <option value="arcgis_satellite">ArcGIS Satellite（卫星）</option>
                <option value="osm">OpenStreetMap（开放）</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>统计数据框显示</span>
              <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: 'var(--bg-hover)' }}>
                {statsOptions.map(option => (
                  <label key={option} className="flex items-center gap-2 cursor-pointer text-xs relative">
                    <input
                      type="checkbox"
                      checked={statsDisplay.includes(option)}
                      onChange={e => setStatsDisplay(prev => e.target.checked
                        ? (prev.includes(option) ? prev : [...prev, option])
                        : prev.filter(item => item !== option))}
                      className="w-4 h-4 rounded appearance-none cursor-pointer transition-colors flex-shrink-0"
                      style={{
                        background: statsDisplay.includes(option) ? 'var(--accent)' : 'var(--bg-secondary)',
                        border: `2px solid ${statsDisplay.includes(option) ? 'var(--accent)' : 'var(--border)'}`,
                        boxSizing: 'border-box',
                      }}
                    />
                    {statsDisplay.includes(option) && (
                      <span className="absolute left-0.5 top-0 text-white pointer-events-none select-none leading-4" style={{ fontSize: '11px', fontWeight: 'bold' }}>✓</span>
                    )}
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </label>

            <label className="flex flex-col gap-1.5 text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>GET 地址（支持 {'{ip}'}）</span>
              <input
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
                placeholder={customDefaultEndpoint}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                disabled={mode !== 'custom'}
                style={{ background: mode === 'custom' ? 'var(--bg-hover)' : 'var(--bg)', color: 'var(--text-primary)', opacity: mode === 'custom' ? 1 : 0.6 }}
              />
            </label>

            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              内置接口支持：IP9、ipwho.is、ipapi.co、ipinfo.io、ip-api.com、geolocation-db.com。自定义接口则支持 GET 地址与 <span style={{ color: 'var(--text-primary)' }}>{'{ip}'}</span> 占位符，接口如果需要鉴权，可额外填写 API Key。
            </p>

            <div className="rounded-2xl p-3" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>离线数据库更新</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>当前离线库：`geoip-lite` / MaxMind GeoLite2。更新需要 License Key，可在环境变量 `MAXMIND_LICENSE_KEY` 中配置。</p>
                </div>
              </div>
              <button
                type="button"
                onClick={updateOfflineDb}
                disabled={updatingDb}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-60"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {updatingDb ? <Loader2 size={14} className="animate-spin" /> : null}
                更新离线数据库
              </button>
            </div>

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