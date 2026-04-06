'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { IMEInput } from '@/components/ui/IMEInput'

export default function SubmitFriendLinkPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    url: '',
    description: '',
    email: '',
    favicon: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [reciprocal, setReciprocal] = useState<{ status: 'checking' | 'found' | 'not-found' | null }>({ status: null })

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const checkReciprocal = async () => {
    if (!form.url.trim()) {
      toast.error('请先输入网站 URL')
      return
    }

    setReciprocal({ status: 'checking' })

    try {
      const res = await fetch('/api/friend-links/check-reciprocal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.url }),
      })

      const data = await res.json()

      if (data.found) {
        setReciprocal({ status: 'found' })
        toast.success('✅ 已检测到互链')
      } else {
        setReciprocal({ status: 'not-found' })
        toast('⚠️ 未检测到互链', { icon: '⚠️' })
      }
    } catch {
      toast.error('检查失败，请重试')
      setReciprocal({ status: null })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error('请输入网站名称')
      return
    }
    if (!form.url.trim()) {
      toast.error('请输入网站 URL')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/friend-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || '提交失败')
        return
      }

      toast.success('✅ 提交成功！')
      setForm({ name: '', url: '', description: '', email: '', favicon: '' })
      setReciprocal({ status: null })

      // 重定向到查询状态页面
      setTimeout(() => {
        router.push(`/links/status/${data.id}`)
      }, 1500)
    } catch (error) {
      toast.error('网络错误，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* 返回按钮 */}
        <Link
          href="/links"
          className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full transition-colors"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          返回
        </Link>

        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          {/* 标题 */}
          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              申请友情链接
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              欢迎互换友链，我们会在 12 小时内进行审核。
            </p>
          </div>

          {/* 提交表单 */}
          <form onSubmit={handleSubmit} className="px-6 pb-8 space-y-6">
            {/* 网站名称 */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                网站名称 *
              </label>
              <IMEInput
                type="text"
                placeholder="例：XX 个人博客"
                value={form.name}
                onValueChange={v => handleChange('name', v)}
                className="w-full px-4 py-2 rounded-lg bg-transparent outline-none border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* 网站 URL */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                网站 URL *
              </label>
              <div className="flex gap-2">
                <IMEInput
                  type="url"
                  placeholder="https://example.com"
                  value={form.url}
                  onValueChange={v => handleChange('url', v)}
                  className="flex-1 px-4 py-2 rounded-lg bg-transparent outline-none border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  onBlur={checkReciprocal}
                />
                <button
                  type="button"
                  onClick={checkReciprocal}
                  className="px-4 py-2 rounded-lg font-medium transition-all"
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    opacity: reciprocal.status === 'checking' ? 0.7 : 1,
                  }}
                  disabled={reciprocal.status === 'checking'}
                >
                  {reciprocal.status === 'checking' ? '检查中...' : '检查互链'}
                </button>
              </div>

              {/* 互链状态提示 */}
              {reciprocal.status === 'found' && (
                <div className="mt-2 p-3 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)' }}>
                  <p className="text-sm" style={{ color: '#22c55e' }}>
                    ✅ 已检测到您网站上指向我方的链接，审核优先级更高
                  </p>
                </div>
              )}
              {reciprocal.status === 'not-found' && (
                <div className="mt-2 p-3 rounded-lg" style={{ background: 'rgba(249,115,22,0.1)' }}>
                  <p className="text-sm" style={{ color: '#f97316' }}>
                    ⚠️ 未检测到您网站上指向我方的链接。建议先在您的网站上添加本站链接，再提交申请。
                  </p>
                </div>
              )}
            </div>

            {/* 网站描述 */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                网站描述
              </label>
              <IMEInput
                type="text"
                placeholder="请用简短的语句介绍你的网站（可选）"
                value={form.description}
                onValueChange={v => handleChange('description', v)}
                className="w-full px-4 py-2 rounded-lg bg-transparent outline-none border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                maxLength={100}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {form.description.length}/100
              </p>
            </div>

            {/* 邮箱 */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                邮箱（可选）
              </label>
              <IMEInput
                type="email"
                placeholder="用于接收审核结果通知"
                value={form.email}
                onValueChange={v => handleChange('email', v)}
                className="w-full px-4 py-2 rounded-lg bg-transparent outline-none border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* 头像 URL */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                头像 URL（可选）
              </label>
              <IMEInput
                type="url"
                placeholder="https://example.com/avatar.png"
                value={form.favicon}
                onValueChange={v => handleChange('favicon', v)}
                className="w-full px-4 py-2 rounded-lg bg-transparent outline-none border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                留空则自动从网站抓取图标
              </p>
            </div>

            {/* 须知 */}
            <div className="p-4 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
              <p className="text-xs leading-relaxed mb-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                📝 申请须知：
              </p>
              <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                <li>✓ 网站需在线正常访问，内容积极向上</li>
                <li>✓ 网站应已添加本站友链</li>
                <li>✓ 我们会在 24 小时内审核您的申请</li>
                <li>✓ 审核通过后，您的网站将出现在本站友链栏</li>
              </ul>
            </div>

            {/* 提交按钮 */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 rounded-lg font-bold text-white transition-all disabled:opacity-50"
                style={{ background: 'var(--accent)' }}
              >
                {submitting ? '提交中...' : '提交申请'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 py-3 rounded-lg font-bold transition-all"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
