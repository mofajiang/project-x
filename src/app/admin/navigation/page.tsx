'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { IMEInput, IMETextarea } from '@/components/ui/IMEInput'
import {
  DEFAULT_NAV,
  DEFAULT_WIDGETS,
  parseNavItems,
  parseWidgets,
  type NavItem,
  type RightPanelWidget as Widget,
} from '@/lib/config'

type WidgetType = 'search' | 'about' | 'tags' | 'hotPosts' | 'custom' | 'links' | 'carousel'
type CarouselSlideType = 'image' | 'text' | 'markdown'

const SLIDE_TYPE_LABELS: Record<CarouselSlideType, string> = {
  image: '🖼 图片',
  text: '📝 文字/链接',
  markdown: '📄 Markdown',
}

const WIDGET_LABELS: Record<WidgetType, string> = {
  search: '🔍 搜索框',
  about: '👤 关于我',
  tags: '🏷️ 热门标签',
  hotPosts: '🔥 热门文章',
  custom: '📝 自定义文本',
  links: '🔗 自定义链接',
  carousel: '🎠 轮播图',
}

const ICON_OPTIONS = [
  { value: 'home', label: '🏠 首页' },
  { value: 'archive', label: '📅 归档' },
  { value: 'tag', label: '🏷️ 标签' },
  { value: 'link', label: '🔗 友链' },
  { value: 'user', label: '👤 用户' },
]

function normalizeWidget(widget: Widget): Widget {
  return {
    ...widget,
    mobileVisible: widget.mobileVisible ?? widget.type !== 'search',
  }
}

export default function AdminNavigationPage() {
  const [navItems, setNavItems] = useState<NavItem[]>(DEFAULT_NAV)
  const [widgets, setWidgets] = useState<Widget[]>(DEFAULT_WIDGETS.map(normalizeWidget))
  const [saving, setSaving] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyConfigData = (data: Record<string, any>) => {
    setNavItems(parseNavItems(data.navItems || '[]'))
    setWidgets(parseWidgets(data.rightPanelWidgets || '[]').map((item) => normalizeWidget(item)))
  }

  useEffect(() => {
    fetch('/api/admin/config', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data) applyConfigData(data)
      })
  }, [])

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/admin/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ navItems, rightPanelWidgets: widgets }),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      applyConfigData(data)
      toast.success('导航与组件已保存')
    } else {
      toast.error('保存失败')
    }
  }

  const addNavItem = () => setNavItems((v) => [...v, { label: '新菜单', href: '/', icon: 'home' }])
  const removeNavItem = (i: number) => setNavItems((v) => v.filter((_, idx) => idx !== i))
  const moveNavItem = (i: number, dir: -1 | 1) => {
    const next = [...navItems]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setNavItems(next)
  }
  const updateNavItem = (i: number, field: keyof NavItem, val: string) =>
    setNavItems((v) => v.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)))

  const updateWidget = (i: number, next: Partial<Widget>) =>
    setWidgets((v) => v.map((item, idx) => (idx === i ? { ...item, ...next } : item)))

  const sectionTitleClass = 'text-base sm:text-lg font-bold leading-tight tracking-tight'
  const sectionHintClass = 'text-[10px] sm:text-xs leading-relaxed text-balance'
  const mobileCardClass = 'rounded-2xl p-2.5 sm:p-6'
  const mobileSubCardClass = 'rounded-xl p-2 sm:p-4'

  return (
    <div>
      <div className="grid max-w-4xl grid-cols-1 items-start gap-3 sm:gap-5">
        <div
          className={`${mobileCardClass} flex flex-col gap-3 sm:gap-4`}
          style={{ background: 'var(--bg-secondary)' }}
        >
          <div className="flex flex-col gap-1.5">
            <h2 className={sectionTitleClass} style={{ color: 'var(--text-primary)' }}>
              前台导航和右侧栏
            </h2>
            <p className={sectionHintClass} style={{ color: 'var(--text-secondary)' }}>
              这里单独管理博客首页的导航菜单与右侧栏组件，不再放在站点设置里。
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5 sm:gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  导航菜单
                </h3>
                <button
                  onClick={addNavItem}
                  className="min-h-10 w-full rounded-full px-3 py-2 text-sm font-medium sm:w-auto"
                  style={{ background: 'rgba(29,155,240,0.15)', color: 'var(--accent)' }}
                >
                  + 添加
                </button>
              </div>
              <div className="flex flex-col gap-2 sm:gap-3">
                {navItems.map((item, i) => (
                  <div
                    key={i}
                    className={`${mobileSubCardClass} flex flex-col gap-2 sm:gap-3`}
                    style={{ background: 'var(--bg-hover)' }}
                  >
                    <div className="flex items-center gap-1 self-start sm:flex-col sm:gap-0.5">
                      <button
                        onClick={() => moveNavItem(i, -1)}
                        disabled={i === 0}
                        className="flex h-8 w-8 items-center justify-center rounded text-xs disabled:opacity-30 sm:h-5 sm:w-5"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveNavItem(i, 1)}
                        disabled={i === navItems.length - 1}
                        className="flex h-8 w-8 items-center justify-center rounded text-xs disabled:opacity-30 sm:h-5 sm:w-5"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        ↓
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[92px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <select
                        value={item.icon}
                        onChange={(e) => updateNavItem(i, 'icon', e.target.value)}
                        className="w-full rounded-lg px-2 py-2 text-sm outline-none"
                        style={{
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          minWidth: 90,
                        }}
                      >
                        {ICON_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <IMEInput
                        value={item.label}
                        onValueChange={(v) => updateNavItem(i, 'label', v)}
                        placeholder="标签"
                        className="w-full flex-1 rounded-lg px-2 py-2 text-sm outline-none"
                        style={{
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                        }}
                      />
                      <IMEInput
                        value={item.href}
                        onValueChange={(v) => updateNavItem(i, 'href', v)}
                        placeholder="/about"
                        className="w-full flex-1 rounded-lg px-2 py-2 text-sm outline-none"
                        style={{
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                        }}
                      />
                      <button
                        onClick={() => removeNavItem(i)}
                        className="flex h-10 w-full items-center justify-center rounded-full sm:h-7 sm:w-7"
                        style={{ color: '#F4212E' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(244,33,46,0.1)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  右侧栏组件
                </h3>
                <button
                  onClick={() =>
                    setWidgets((v) => [
                      ...v,
                      normalizeWidget({ type: 'custom', enabled: true, mobileVisible: true, title: '', content: '' }),
                    ])
                  }
                  className="min-h-10 w-full rounded-full px-3 py-2 text-sm font-medium sm:w-auto"
                  style={{ background: 'rgba(29,155,240,0.15)', color: 'var(--accent)' }}
                >
                  + 添加
                </button>
              </div>
              <p className={`${sectionHintClass} mt-1`} style={{ color: 'var(--text-secondary)' }}>
                配置前台右侧栏显示的组件
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:gap-3">
                {widgets.map((w, i) => (
                  <div
                    key={i}
                    className={`${mobileSubCardClass} relative flex flex-col gap-2 sm:gap-3`}
                    style={{ background: 'var(--bg-hover)' }}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:pr-10">
                      <div className="flex flex-shrink-0 items-center gap-1 self-start sm:flex-col sm:gap-0.5">
                        <button
                          onClick={() => {
                            const a = [...widgets]
                            if (i > 0) {
                              ;[a[i - 1], a[i]] = [a[i], a[i - 1]]
                              setWidgets(a)
                            }
                          }}
                          disabled={i === 0}
                          className="flex h-8 w-8 items-center justify-center text-xs disabled:opacity-30 sm:h-5 sm:w-5"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => {
                            const a = [...widgets]
                            if (i < a.length - 1) {
                              ;[a[i], a[i + 1]] = [a[i + 1], a[i]]
                              setWidgets(a)
                            }
                          }}
                          disabled={i === widgets.length - 1}
                          className="flex h-8 w-8 items-center justify-center text-xs disabled:opacity-30 sm:h-5 sm:w-5"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          ↓
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label
                          className="inline-flex items-center gap-2 text-xs font-medium"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <input
                            type="checkbox"
                            checked={w.enabled}
                            onChange={(e) => updateWidget(i, { enabled: e.target.checked })}
                            className="h-4 w-4 flex-shrink-0"
                          />
                          启用
                        </label>
                        <label
                          className="inline-flex items-center gap-2 text-xs font-medium"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <input
                            type="checkbox"
                            checked={w.mobileVisible !== false}
                            onChange={(e) => updateWidget(i, { mobileVisible: e.target.checked })}
                            className="h-4 w-4 flex-shrink-0"
                          />
                          手机端显示
                        </label>
                      </div>
                      <select
                        value={w.type}
                        onChange={(e) =>
                          updateWidget(i, {
                            type: e.target.value as WidgetType,
                            mobileVisible: e.target.value === 'search' ? false : true,
                          })
                        }
                        className="w-full flex-1 rounded-lg px-2 py-2 text-sm outline-none"
                        style={{
                          background: 'var(--bg-hover)',
                          color: 'var(--text-primary)',
                          border: '1px solid transparent',
                        }}
                      >
                        {(Object.keys(WIDGET_LABELS) as WidgetType[]).map((t) => (
                          <option key={t} value={t}>
                            {WIDGET_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => setWidgets((v) => v.filter((_, j) => j !== i))}
                      className="absolute right-2 top-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ color: '#F4212E' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(244,33,46,0.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      ×
                    </button>
                    <IMEInput
                      value={w.title || ''}
                      onValueChange={(v) => setWidgets((arr) => arr.map((x, j) => (j === i ? { ...x, title: v } : x)))}
                      placeholder={'标题（留空用默认）'}
                      className="w-full rounded-lg px-2 py-2 text-sm outline-none"
                      style={{
                        background: 'var(--bg-hover)',
                        color: 'var(--text-primary)',
                        border: '1px solid transparent',
                      }}
                    />
                    {w.type === 'search' && (
                      <p className="text-[10px] sm:text-xs" style={{ color: 'var(--text-secondary)' }}>
                        搜索默认在手机端隐藏，避免和底部搜索重复；可在这里单独开启。
                      </p>
                    )}
                    {w.type === 'custom' && (
                      <IMETextarea
                        value={w.content || ''}
                        onValueChange={(v) =>
                          setWidgets((arr) => arr.map((x, j) => (j === i ? { ...x, content: v } : x)))
                        }
                        placeholder="自定义内容"
                        rows={3}
                        className="w-full resize-none rounded-lg px-2 py-2 text-sm outline-none"
                        style={{
                          background: 'var(--bg-hover)',
                          color: 'var(--text-primary)',
                          border: '1px solid transparent',
                        }}
                      />
                    )}
                    {w.type === 'carousel' && (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-2 rounded-xl p-2.5 sm:flex-row sm:items-center sm:gap-2 sm:rounded-none sm:p-0">
                          <div className="flex items-center gap-2 sm:flex-1">
                            <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                              自动切换
                            </span>
                            <input
                              type="number"
                              min={500}
                              max={30000}
                              step={500}
                              value={w.interval || 3000}
                              onChange={(e) =>
                                setWidgets((arr) =>
                                  arr.map((x, j) => (j === i ? { ...x, interval: Number(e.target.value) } : x))
                                )
                              }
                              className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                              style={{
                                background: 'var(--bg-hover)',
                                color: 'var(--text-primary)',
                                border: '1px solid transparent',
                              }}
                            />
                          </div>
                          <p className={sectionHintClass} style={{ color: 'var(--text-secondary)' }}>
                            单位毫秒，建议 3000 以上
                          </p>
                        </div>

                        {(w.slides || []).map((sl, si) => {
                          const stype = sl.slideType || 'image'
                          return (
                            <div
                              key={si}
                              className="flex flex-col gap-2 rounded-xl p-3"
                              style={{ background: 'var(--bg-secondary)' }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className="shrink-0 text-xs font-bold"
                                    style={{ color: 'var(--text-secondary)' }}
                                  >
                                    幻灯片 #{si + 1}
                                  </span>
                                  <span
                                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                                    style={{ background: 'rgba(29,155,240,0.12)', color: 'var(--accent)' }}
                                  >
                                    {SLIDE_TYPE_LABELS[stype]}
                                  </span>
                                </div>
                                <button
                                  onClick={() =>
                                    setWidgets((arr) =>
                                      arr.map((x, j) => {
                                        if (j !== i) return x
                                        return { ...x, slides: (x.slides || []).filter((_, k) => k !== si) }
                                      })
                                    )
                                  }
                                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs"
                                  style={{ color: '#F4212E', background: 'rgba(244,33,46,0.1)' }}
                                >
                                  ×
                                </button>
                              </div>

                              <select
                                value={stype}
                                onChange={(e) =>
                                  setWidgets((arr) =>
                                    arr.map((x, j) => {
                                      if (j !== i) return x
                                      const ss = [...(x.slides || [])]
                                      ss[si] = { ...ss[si], slideType: e.target.value as CarouselSlideType }
                                      return { ...x, slides: ss }
                                    })
                                  )
                                }
                                className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                style={{
                                  background: 'var(--bg-hover)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid transparent',
                                }}
                              >
                                {(Object.keys(SLIDE_TYPE_LABELS) as CarouselSlideType[]).map((t) => (
                                  <option key={t} value={t}>
                                    {SLIDE_TYPE_LABELS[t]}
                                  </option>
                                ))}
                              </select>

                              {stype === 'image' && (
                                <IMEInput
                                  value={sl.image || ''}
                                  onValueChange={(v) =>
                                    setWidgets((arr) =>
                                      arr.map((x, j) => {
                                        if (j !== i) return x
                                        const ss = [...(x.slides || [])]
                                        ss[si] = { ...ss[si], image: v }
                                        return { ...x, slides: ss }
                                      })
                                    )
                                  }
                                  placeholder="图片 URL（必填）"
                                  className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                  style={{
                                    background: 'var(--bg-hover)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid transparent',
                                  }}
                                />
                              )}
                              {(stype === 'image' || stype === 'text') && (
                                <IMEInput
                                  value={sl.title || ''}
                                  onValueChange={(v) =>
                                    setWidgets((arr) =>
                                      arr.map((x, j) => {
                                        if (j !== i) return x
                                        const ss = [...(x.slides || [])]
                                        ss[si] = { ...ss[si], title: v }
                                        return { ...x, slides: ss }
                                      })
                                    )
                                  }
                                  placeholder="标题（可选）"
                                  className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                  style={{
                                    background: 'var(--bg-hover)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid transparent',
                                  }}
                                />
                              )}
                              {stype === 'text' && (
                                <IMETextarea
                                  value={sl.desc || ''}
                                  onValueChange={(v) =>
                                    setWidgets((arr) =>
                                      arr.map((x, j) => {
                                        if (j !== i) return x
                                        const ss = [...(x.slides || [])]
                                        ss[si] = { ...ss[si], desc: v }
                                        return { ...x, slides: ss }
                                      })
                                    )
                                  }
                                  placeholder="正文内容"
                                  rows={3}
                                  className="w-full resize-none rounded-lg px-2.5 py-2 text-sm outline-none"
                                  style={{
                                    background: 'var(--bg-hover)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid transparent',
                                  }}
                                />
                              )}
                              {stype === 'markdown' && (
                                <IMETextarea
                                  value={sl.markdown || ''}
                                  onValueChange={(v) =>
                                    setWidgets((arr) =>
                                      arr.map((x, j) => {
                                        if (j !== i) return x
                                        const ss = [...(x.slides || [])]
                                        ss[si] = { ...ss[si], markdown: v }
                                        return { ...x, slides: ss }
                                      })
                                    )
                                  }
                                  placeholder="# 标题&#10;正文内容，支持 Markdown 格式"
                                  rows={5}
                                  className="w-full resize-none rounded-lg px-2.5 py-2 font-mono text-sm outline-none"
                                  style={{
                                    background: 'var(--bg-hover)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid transparent',
                                  }}
                                />
                              )}
                              {(stype === 'image' || stype === 'text') && (
                                <IMEInput
                                  value={sl.link || ''}
                                  onValueChange={(v) =>
                                    setWidgets((arr) =>
                                      arr.map((x, j) => {
                                        if (j !== i) return x
                                        const ss = [...(x.slides || [])]
                                        ss[si] = { ...ss[si], link: v }
                                        return { ...x, slides: ss }
                                      })
                                    )
                                  }
                                  placeholder="跳转链接（可选）"
                                  className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                  style={{
                                    background: 'var(--bg-hover)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid transparent',
                                  }}
                                />
                              )}
                            </div>
                          )
                        })}
                        <button
                          onClick={() =>
                            setWidgets((arr) =>
                              arr.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      slides: [
                                        ...(x.slides || []),
                                        { slideType: 'image', image: '', title: '', desc: '', link: '' },
                                      ],
                                    }
                                  : x
                              )
                            )
                          }
                          className="min-h-10 self-stretch rounded-full px-3 py-2 text-xs"
                          style={{ background: 'rgba(29,155,240,0.15)', color: 'var(--accent)' }}
                        >
                          + 添加幻灯片
                        </button>
                      </div>
                    )}
                    {w.type === 'links' && (
                      <div className="flex flex-col gap-2">
                        {(w.links || []).map((lk, li) => (
                          <div
                            key={li}
                            className="flex flex-col gap-2 rounded-xl p-3"
                            style={{ background: 'var(--bg-secondary)' }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                自定义链接 #{li + 1}
                              </span>
                              <button
                                onClick={() =>
                                  setWidgets((arr) =>
                                    arr.map((x, j) => {
                                      if (j !== i) return x
                                      return { ...x, links: (x.links || []).filter((_, k) => k !== li) }
                                    })
                                  )
                                }
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs"
                                style={{ color: '#F4212E', background: 'rgba(244,33,46,0.1)' }}
                              >
                                ×
                              </button>
                            </div>
                            <IMEInput
                              value={lk.label}
                              onValueChange={(v) =>
                                setWidgets((arr) =>
                                  arr.map((x, j) => {
                                    if (j !== i) return x
                                    const ls = [...(x.links || [])]
                                    ls[li] = { ...ls[li], label: v }
                                    return { ...x, links: ls }
                                  })
                                )
                              }
                              placeholder="名称"
                              className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                              style={{
                                background: 'var(--bg-hover)',
                                color: 'var(--text-primary)',
                                border: '1px solid transparent',
                              }}
                            />
                            <IMEInput
                              value={lk.url}
                              onValueChange={(v) =>
                                setWidgets((arr) =>
                                  arr.map((x, j) => {
                                    if (j !== i) return x
                                    const ls = [...(x.links || [])]
                                    ls[li] = { ...ls[li], url: v }
                                    return { ...x, links: ls }
                                  })
                                )
                              }
                              placeholder="https://"
                              className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                              style={{
                                background: 'var(--bg-hover)',
                                color: 'var(--text-primary)',
                                border: '1px solid transparent',
                              }}
                            />
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <IMEInput
                                value={lk.desc || ''}
                                onValueChange={(v) =>
                                  setWidgets((arr) =>
                                    arr.map((x, j) => {
                                      if (j !== i) return x
                                      const ls = [...(x.links || [])]
                                      ls[li] = { ...ls[li], desc: v }
                                      return { ...x, links: ls }
                                    })
                                  )
                                }
                                placeholder="简介（可选）"
                                className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                style={{
                                  background: 'var(--bg-hover)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid transparent',
                                }}
                              />
                              <IMEInput
                                value={lk.avatar || ''}
                                onValueChange={(v) =>
                                  setWidgets((arr) =>
                                    arr.map((x, j) => {
                                      if (j !== i) return x
                                      const ls = [...(x.links || [])]
                                      ls[li] = { ...ls[li], avatar: v }
                                      return { ...x, links: ls }
                                    })
                                  )
                                }
                                placeholder="头像URL（可选）"
                                className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                                style={{
                                  background: 'var(--bg-hover)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid transparent',
                                }}
                              />
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() =>
                            setWidgets((arr) =>
                              arr.map((x, j) =>
                                j === i ? { ...x, links: [...(x.links || []), { label: '', url: '' }] } : x
                              )
                            )
                          }
                          className="min-h-10 self-stretch rounded-full px-3 py-2 text-xs"
                          style={{ background: 'rgba(29,155,240,0.15)', color: 'var(--accent)' }}
                        >
                          + 添加链接
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="sticky bottom-3 z-10 mt-6 bg-transparent pt-2 md:static">
            <button
              onClick={save}
              disabled={saving}
              className="min-h-11 w-full rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-50 sm:w-auto"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
