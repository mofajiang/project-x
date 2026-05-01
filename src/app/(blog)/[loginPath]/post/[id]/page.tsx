import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { buildPostMetadata, getPostByPublicId, renderPostPage } from '@/app/(blog)/post/post-page'

export async function generateMetadata({ params }: { params: { loginPath: string; id: string } }) {
  const publicId = Number(params.id)
  if (!Number.isFinite(publicId)) return {}
  const post = await getPostByPublicId(publicId, params.loginPath, true)
  if (!post) return {}
  return buildPostMetadata(post)
}

export default async function UserPostPage({ params }: { params: { loginPath: string; id: string } }) {
  const publicId = Number(params.id)
  const session = await getSession()
  if (!Number.isFinite(publicId)) notFound()
  const post = await getPostByPublicId(publicId, params.loginPath, !session)
  if (!post) notFound()
  return renderPostPage(post, session)
}
