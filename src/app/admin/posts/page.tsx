'use client'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ADMIN_PAGE_TITLE_CLASS, ADMIN_CARD_CLASS } from '@/components/admin/adminUi'

interface Post {
  id: string
  title: string
  slug: string
  published: boolean
  views: number
  createdAt: string
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

  const fetchPosts = useCallback(async (p: number, s: string, st: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), search: s, status: st })
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

  useEffect(() => { fetchPosts(page, search, status) }, [page, search, status, fetchPosts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  const handleStatus = (s: string) => {
    setPage(1)
    setStatus(s)
  }

  const statusTabs = [
    { key: 'all', label: '全部' },
    { key: 'published', label: '已发布' },
    { key: 'draft', label: '草稿' },
  ]

  const deletePost = async (id: string, title: string) => {
    if (!confirm(`确定删除「${title}」？`)) return
    await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' })
    fetchPosts(page, search, status)
    toast.success('已删除')
  }

  const renderPostCard = (post: Post) => (
    <div key={post.id} className={`${ADMIN_CARD_CLASS} flex flex-col gap-2`} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/admin/posts/${post.id}`} className="font-medium text-base leading-6 block truncate" style={{ color: 'var(--text-primary)' }}>
            {post.title}
          </Link>
          <div className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1" style={{ color: 'var(--text-secondary)' }}>
            <span>浏览 {post.views}</span>
            <span>评论 {post._count.comments}</span>
            <span>{formatDate(post.createdAt)}</span>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[11px] shrink-0 leading-none" style={{ background: post.published ? '#00BA7C22' : '#71767B22', color: post.published ? 'var(--green)' : 'var(--text-secondary)' }}>
          {post.published ? '已发布' : '草稿'}
        </span>
      </div>

      <div className="text-xs leading-5 break-words" style={{ color: 'var(--text-secondary)' }}>
        {post.tags.map(t => `#${t.tag.name}`).join(' ')}
      </div>

      <div className="flex gap-2 pt-1">
        <Link href={`/admin/posts/${post.id}`}
          className="flex-1 text-center px-3 py-2 rounded-full text-xs font-bold transition-colors hover:opacity-80 min-h-9"
          style={{ background: 'rgba(29,155,240,0.15)', color: 'var(--accent)' }}>编辑</Link>
        <button onClick={() => deletePost(post.id, post.title)}
          className="flex-1 px-3 py-2 rounded-full text-xs font-bold transition-colors hover:opacity-80 min-h-9"
          style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}>删除</button>
      </div>
    </div>
  )

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className={ADMIN_PAGE_TITLE_CLASS} style={{ color: 'var(--text-primary)' }}>文章管理</h1>
        <Link href="/admin/posts/new"
          className="px-4 py-2 rounded-full text-sm font-bold text-white text-center"
          style={{ background: 'var(--accent)' }}>+ 新建文章</Link>
      </div>

      {/* 搜索 + 状态筛选 */}
      <div className="rounded-2xl p-3 sm:p-4 mb-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 flex-1 mb-3">
          <input
            type="text"
            placeholder="搜索文章标题..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="flex-1 px-4 py-2 rounded-full text-sm outline-none min-w-0"
            style={{ background: 'var(--bg-hover)', border: '1px solid transparent', color: 'var(--text-primary)' }}
          />
          <button type="submit"
            className="px-4 py-2 rounded-full text-sm font-bold text-white sm:w-auto w-full"
            style={{ background: 'var(--accent)' }}>搜索</button>
          {search && (
            <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}
              className="px-4 py-2 rounded-full text-sm sm:w-auto w-full"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>清除</button>
          )}
        </form>
        <div className="flex gap-1 p-1 rounded-full overflow-x-auto" style={{ background: 'var(--bg)' }}>
          {statusTabs.map(tab => (
            <button key={tab.key} onClick={() => handleStatus(tab.key)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
              style={{
                background: status === tab.key ? 'var(--accent)' : 'transparent',
                color: status === tab.key ? '#fff' : 'var(--text-secondary)',
              }}>{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        共 {data.total} 篇{search && `（搜索「${search}」）`}
      </div>

      {loading ? (
        <div className="text-center py-20" style={{ color: 'var(--text-secondary)' }}>加载中...</div>
      ) : data.posts.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--text-secondary)' }}>
          {search ? `未找到包含「${search}」的文章` : '暂无文章'}
        </div>
      ) : (
        <>
          <div className="sm:hidden flex flex-col gap-3">
            {data.posts.map(renderPostCard)}
          </div>

          <div className="hidden sm:block rounded-2xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th className="text-left px-4 py-3">标题</th>
                  <th className="text-left px-4 py-3">状态</th>
                  <th className="text-left px-4 py-3">浏览</th>
                  <th className="text-left px-4 py-3">评论</th>
                  <th className="text-left px-4 py-3">创建时间</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.posts.map(post => (
                  <tr key={post.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                      <div className="font-medium">{post.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {post.tags.map(t => `#${t.tag.name}`).join(' ')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs"
                        style={{ background: post.published ? '#00BA7C22' : '#71767B22', color: post.published ? 'var(--green)' : 'var(--text-secondary)' }}>
                        {post.published ? '已发布' : '草稿'}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{post.views}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{post._count.comments}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatDate(post.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-center">
                        <Link href={`/admin/posts/${post.id}`}
                          className="px-3 py-1 rounded-full text-xs font-bold transition-colors hover:opacity-80"
                          style={{ background: 'rgba(29,155,240,0.15)', color: 'var(--accent)' }}>编辑</Link>
                        <button onClick={() => deletePost(post.id, post.title)}
                          className="px-3 py-1 rounded-full text-xs font-bold transition-colors hover:opacity-80"
                          style={{ background: 'rgba(249,24,128,0.12)', color: 'var(--red)' }}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-full text-sm"
                style={{
                  background: 'var(--bg-secondary)',
                  color: page === 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  opacity: page === 1 ? 0.4 : 1,
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                }}>‹ 上一页</button>

              <div className="flex gap-1">
                {Array.from({ length: data.totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === data.totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`e-${idx}`} className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>…</span>
                    ) : (
                      <button key={p} onClick={() => setPage(p as number)}
                        className="w-9 h-9 rounded-full text-sm font-medium"
                        style={{
                          background: page === p ? 'var(--accent)' : 'var(--bg-secondary)',
                          color: page === p ? '#fff' : 'var(--text-primary)',
                          border: '1px solid var(--border)',
                        }}>{p}</button>
                    )
                  )}
              </div>

              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="px-4 py-2 rounded-full text-sm"
                style={{
                  background: 'var(--bg-secondary)',
                  color: page === data.totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  opacity: page === data.totalPages ? 0.4 : 1,
                  cursor: page === data.totalPages ? 'not-allowed' : 'pointer',
                }}>下一页 ›</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
