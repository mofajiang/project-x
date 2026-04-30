'use client'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ADMIN_CARD_CLASS } from '@/components/admin/adminUi'

interface Post {
  id: string
  title: string
  slug: string
  published: boolean
  pinned: boolean
  views: number
  likes: number
  createdAt: string
  publishedAt: string | null
  updatedAt: string
  _count: { comments: number }
  tags: { tag: { name: string } }[]
}

interface PageData {
  posts: Post[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function AdminPostsPage() {
  const [data, setData] = useState<PageData>({ posts: [], total: 0, page: 1, limit: 20, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [tag, setTag] = useState('')
  const [allTags, setAllTags] = useState<{ id: string; name: string; slug: string; _count: { posts: number } }[]>([])

  useEffect(() => {
    fetch('/api/admin/tags')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setAllTags(d)
      })
      .catch(() => {})
  }, [])

  const fetchPosts = useCallback(async (p: number, s: string, st: string, tg: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), search: s, status: st, tag: tg })
      const res = await fetch(`/api/admin/posts?${params}`)
      const json = await res.json()
      if (json && Array.isArray(json.posts)) {
        setData(json)
      } else {
        setData({ posts: [], total: 0, page: 1, limit: 20, totalPages: 0 })
      }
    } catch {
      setData({ posts: [], total: 0, page: 1, limit: 20, totalPages: 0 })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts(page, search, status, tag)
  }, [page, search, status, tag, fetchPosts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  const handleStatus = (s: string) => {
    setPage(1)
    setStatus(s)
  }

  const handleTag = (t: string) => {
    setPage(1)
    setTag(t)
  }

  const statusTabs = [
    { key: 'all', label: '全部' },
    { key: 'published', label: '已发布' },
    { key: 'draft', label: '草稿' },
  ]

  const deletePost = async (id: string, title: string) => {
    if (!confirm(`确定删除「${title}」？`)) return
    await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' })
    fetchPosts(page, search, status, tag)
    toast.success('已删除')
  }

  const renderPostCard = (post: Post) => (
    <div
      key={post.id}
      className={`${ADMIN_CARD_CLASS} flex flex-col gap-2`}
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/posts/${post.id}`}
            className="block truncate text-base font-medium leading-6"
            style={{ color: 'var(--text-primary)' }}
          >
            {post.title}
          </Link>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span>👁 {post.views}</span>
            <span>💬 {post._count.comments}</span>
            <span>❤️ {post.likes}</span>
            <span title={`更新：${formatDate(post.updatedAt)}`}>
              {post.published && post.publishedAt
                ? `发布 ${formatDate(post.publishedAt)}`
                : `创建 ${formatDate(post.createdAt)}`}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] leading-none"
            style={{
              background: post.published ? '#00BA7C22' : '#71767B22',
              color: post.published ? 'var(--green)' : 'var(--text-secondary)',
            }}
          >
            {post.published ? '已发布' : '草稿'}
          </span>
          {post.pinned && (
            <span className="text-[11px] leading-none" title="已置顶">
              📌
            </span>
          )}
        </div>
      </div>

      <div className="break-words text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
        {post.tags.map((t) => `#${t.tag.name}`).join(' ')}
      </div>

      <div className="flex gap-2 pt-1">
        <Link
          href={`/admin/posts/${post.id}`}
          className="min-h-9 flex-1 rounded-full px-3 py-2 text-center text-xs font-bold transition-colors hover:opacity-80"
          style={{ background: 'rgba(29,155,240,0.15)', color: 'var(--accent)' }}
        >
          编辑
        </Link>
        <button
          onClick={() => deletePost(post.id, post.title)}
          className="min-h-9 flex-1 rounded-full px-3 py-2 text-xs font-bold transition-colors hover:opacity-80"
          style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}
        >
          删除
        </button>
      </div>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div
        className="sticky top-0 z-20 -mx-1 mb-3 flex items-center justify-end gap-3 rounded-2xl px-3 py-2"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}
      >
        <Link
          href="/admin/posts/new"
          className="rounded-full px-4 py-2 text-sm font-bold text-white"
          style={{ background: 'var(--accent)' }}
        >
          + 新建文章
        </Link>
      </div>

      {/* 搜索 + 状态筛选 */}
      <div
        className="mb-4 rounded-2xl p-3 sm:p-4"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <form onSubmit={handleSearch} className="mb-3 flex flex-1 flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="搜索文章标题..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="min-w-0 flex-1 rounded-full px-4 py-2 text-sm outline-none"
            style={{ background: 'var(--bg-hover)', border: '1px solid transparent', color: 'var(--text-primary)' }}
          />
          <button
            type="submit"
            className="w-full rounded-full px-4 py-2 text-sm font-bold text-white sm:w-auto"
            style={{ background: 'var(--accent)' }}
          >
            搜索
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                setSearch('')
                setPage(1)
              }}
              className="w-full rounded-full px-4 py-2 text-sm sm:w-auto"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
            >
              清除
            </button>
          )}
        </form>
        <div className="flex gap-1 overflow-x-auto rounded-full p-1" style={{ background: 'var(--bg)' }}>
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleStatus(tab.key)}
              className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: status === tab.key ? 'var(--accent)' : 'transparent',
                color: status === tab.key ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => handleTag('')}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={{
                background: tag === '' ? 'var(--accent)' : 'var(--bg-hover)',
                color: tag === '' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              全部标签
            </button>
            {allTags.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTag(tag === t.slug ? '' : t.slug)}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  background: tag === t.slug ? 'var(--accent)' : 'var(--bg-hover)',
                  color: tag === t.slug ? '#fff' : 'var(--text-secondary)',
                }}
              >
                #{t.name} <span style={{ opacity: 0.6 }}>{t._count.posts}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        共 {data.total} 篇{search && `（搜索「${search}」）`}
        {tag && `（标签「${allTags.find((t) => t.slug === tag)?.name ?? tag}」）`}
      </div>

      {loading ? (
        <div className="py-20 text-center" style={{ color: 'var(--text-secondary)' }}>
          加载中...
        </div>
      ) : data.posts.length === 0 ? (
        <div className="py-20 text-center" style={{ color: 'var(--text-secondary)' }}>
          {search ? `未找到包含「${search}」的文章` : '暂无文章'}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:hidden">{data.posts.map(renderPostCard)}</div>

          <div
            className="hidden overflow-hidden rounded-2xl sm:block"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th className="px-4 py-3 text-left">标题</th>
                  <th className="px-4 py-3 text-left">状态</th>
                  <th className="px-4 py-3 text-left">浏览</th>
                  <th className="px-4 py-3 text-left">评论</th>
                  <th className="px-4 py-3 text-left">点赞</th>
                  <th className="px-4 py-3 text-left">时间</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.posts.map((post) => (
                  <tr
                    key={post.id}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                      <div className="flex items-center gap-1 font-medium">
                        {post.pinned && <span title="已置顶">📌</span>}
                        {post.title}
                      </div>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {post.tags.map((t) => `#${t.tag.name}`).join(' ')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={{
                          background: post.published ? '#00BA7C22' : '#71767B22',
                          color: post.published ? 'var(--green)' : 'var(--text-secondary)',
                        }}
                      >
                        {post.published ? '已发布' : '草稿'}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {post.views}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {post._count.comments}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {post.likes}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                      <div title={`创建：${formatDate(post.createdAt)}\n更新：${formatDate(post.updatedAt)}`}>
                        {post.published && post.publishedAt ? formatDate(post.publishedAt) : formatDate(post.createdAt)}
                      </div>
                      {post.published && post.publishedAt && post.publishedAt !== post.createdAt && (
                        <div className="text-xs opacity-60" title={`创建：${formatDate(post.createdAt)}`}>
                          创建 {formatDate(post.createdAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <Link
                          href={`/admin/posts/${post.id}`}
                          className="rounded-full px-3 py-1 text-xs font-bold transition-colors hover:opacity-80"
                          style={{ background: 'rgba(29,155,240,0.15)', color: 'var(--accent)' }}
                        >
                          编辑
                        </Link>
                        <button
                          onClick={() => deletePost(post.id, post.title)}
                          className="rounded-full px-3 py-1 text-xs font-bold transition-colors hover:opacity-80"
                          style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {data.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-full px-4 py-2 text-sm"
                style={{
                  background: 'var(--bg-secondary)',
                  color: page === 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  opacity: page === 1 ? 0.4 : 1,
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                ‹ 上一页
              </button>

              <div className="flex gap-1">
                {Array.from({ length: data.totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === data.totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`e-${idx}`} className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className="h-9 w-9 rounded-full text-sm font-medium"
                        style={{
                          background: page === p ? 'var(--accent)' : 'var(--bg-secondary)',
                          color: page === p ? '#fff' : 'var(--text-primary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {p}
                      </button>
                    )
                  )}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="rounded-full px-4 py-2 text-sm"
                style={{
                  background: 'var(--bg-secondary)',
                  color: page === data.totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  opacity: page === data.totalPages ? 0.4 : 1,
                  cursor: page === data.totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                下一页 ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
