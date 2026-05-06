'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/lib/converters'

interface GuestbookMsg {
  id: string
  content: string
  guestName: string
  guestWebsite: string | null
  author: { username: string; avatar: string | null; displayName: string | null } | null
  createdAt: string
}

export default function GuestbookPage() {
  const [messages, setMessages] = useState<GuestbookMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20

  // 表单
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchMessages = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/guestbook?page=${p}&pageSize=${pageSize}`)
      const data = await res.json()
      if (res.ok) {
        setMessages(data.messages || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMessages(page)
  }, [page, fetchMessages])

  const submit = async () => {
    const trimmedName = name.trim()
    const trimmedContent = content.trim()
    if (!trimmedName) {
      toast.error('请填写昵称')
      return
    }
    if (!trimmedContent) {
      toast.error('请填写留言内容')
      return
    }
    if (trimmedContent.length > 1000) {
      toast.error('留言不能超过1000字')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: trimmedName,
          guestEmail: email.trim() || undefined,
          guestWebsite: website.trim() || undefined,
          content: trimmedContent,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '提交失败')
      toast.success(data.message?.approved === false ? '留言已提交，审核后显示' : '留言成功')
      setName('')
      setEmail('')
      setWebsite('')
      setContent('')
      // 刷新第一页
      if (page === 1) {
        fetchMessages(1)
      } else {
        setPage(1)
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60_000) return '刚刚'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* 顶部标题栏 */}
      <div
        className="sticky top-0 z-10 px-4 py-4 backdrop-blur-md"
        style={{ background: 'var(--bg-blur)', borderBottom: '1px solid var(--border)' }}
      >
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          留言板
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          欢迎留下足迹，说点什么吧。
        </p>
      </div>

      <div className="mx-auto max-w-2xl px-3 py-6 sm:px-4 sm:py-8">
        {/* 移动端返回按钮 */}
        <div className="mb-6 sm:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            <span aria-hidden="true">←</span>
            返回首页
          </Link>
        </div>

        {/* 提交表单 */}
        <div
          className="mb-8 overflow-hidden rounded-2xl border"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
        >
          <div className="px-5 py-5">
            <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              写留言
            </h2>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="昵称 *"
                  className="w-full rounded-xl px-3.5 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-primary)',
                    border: '1px solid transparent',
                  }}
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱（选填）"
                  type="email"
                  className="w-full rounded-xl px-3.5 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-primary)',
                    border: '1px solid transparent',
                  }}
                />
              </div>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="网站（选填）"
                className="w-full rounded-xl px-3.5 py-2 text-sm outline-none"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="留言内容 *"
                rows={4}
                maxLength={1000}
                className="w-full resize-none rounded-xl px-3.5 py-2 text-sm outline-none"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
              />
              <button
                onClick={submit}
                disabled={submitting}
                className="self-end rounded-full px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
                style={{ background: 'var(--accent)' }}
              >
                {submitting ? '提交中...' : '发布留言'}
              </button>
            </div>
          </div>
        </div>

        {/* 留言列表 */}
        {loading ? (
          <div className="py-20 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            <p>加载中...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-20 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            <p>暂无留言，来坐沙发吧</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="rounded-2xl border p-4"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start gap-3">
                  {/* 头像 */}
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {msg.author?.avatar ? (
                      <Image
                        src={msg.author.avatar}
                        alt=""
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      (msg.author?.displayName || msg.guestName)[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {msg.author?.displayName || msg.guestName}
                      </span>
                      {msg.guestWebsite ? (
                        <a
                          href={msg.guestWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline hover:no-underline"
                          style={{ color: 'var(--accent)' }}
                        >
                          网站
                        </a>
                      ) : null}
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    <p
                      className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-full px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-30"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  上一页
                </button>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-full px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-30"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        )}

        {/* 总留言数 */}
        {total > 0 && (
          <p className="mt-6 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
            共 {total} 条留言
          </p>
        )}
      </div>
    </div>
  )
}
