import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatTime } from '@/lib/utils'

export const metadata: Metadata = {
  title: '友链申请状态',
  robots: { index: false },
}

type StatusTone = {
  label: string
  color: string
  bg: string
  desc: string
}

const STATUS_MAP: Record<string, StatusTone> = {
  pending: {
    label: '待审核',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.14)',
    desc: '你的申请已提交成功，系统可能正在进行 AI 审核或等待人工确认。',
  },
  approved: {
    label: '已通过',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.14)',
    desc: '恭喜，友链已通过审核，通常会显示在友链页面。',
  },
  rejected: {
    label: '未通过',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.14)',
    desc: '当前申请未通过，你可以根据原因调整后再次提交。',
  },
}

export default async function FriendLinkStatusPage({ params }: { params: { id: string } }) {
  const link = await prisma.friendLink.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      url: true,
      status: true,
      rejectionReason: true,
      hasReciprocal: true,
      reciprocalChecked: true,
      aiScore: true,
      createdAt: true,
      approvedAt: true,
      updatedAt: true,
    },
  })

  if (!link) notFound()

  const tone = STATUS_MAP[link.status] || STATUS_MAP.pending

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="rounded-2xl p-6 sm:p-8" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>申请编号：{link.id}</p>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>友链申请状态</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>站点：{link.name} · {link.url}</p>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold mb-4" style={{ color: tone.color, background: tone.bg }}>
            <span className="w-2 h-2 rounded-full" style={{ background: tone.color }} />
            {tone.label}
          </div>

          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{tone.desc}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl p-3" style={{ background: 'var(--bg-hover)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>提交时间</p>
              <p className="font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{formatTime(link.createdAt)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--bg-hover)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>最后更新</p>
              <p className="font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{formatTime(link.updatedAt)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--bg-hover)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>互链检测</p>
              <p className="font-medium mt-1" style={{ color: link.hasReciprocal ? '#22c55e' : 'var(--text-primary)' }}>
                {link.reciprocalChecked ? (link.hasReciprocal ? '已检测到互链' : '未检测到互链') : '未检测'}
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--bg-hover)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>AI 风险分</p>
              <p className="font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{link.aiScore}</p>
            </div>
          </div>

          {link.status === 'approved' && (
            <div className="mt-5 p-4 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
              你的友链已通过审核，可前往友链页面查看。
            </div>
          )}

          {link.status === 'rejected' && (
            <div className="mt-5 p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              拒绝原因：{link.rejectionReason || '未提供原因'}
            </div>
          )}

          {link.status === 'pending' && (
            <div className="mt-5 p-4 rounded-xl text-sm" style={{ background: 'rgba(29,155,240,0.1)', color: 'var(--text-primary)' }}>
              提示：友链列表只展示“已通过”状态，当前待审核时不会显示在公开列表中。
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link href="/links" className="px-4 py-2.5 rounded-lg text-center font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
              查看友链列表
            </Link>
            <Link href="/links/submit" className="px-4 py-2.5 rounded-lg text-center font-medium" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
              再提交一个
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
