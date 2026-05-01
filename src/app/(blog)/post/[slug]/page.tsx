import { getSession } from '@/lib/auth'
import { buildPostMetadata, ensurePostFound, getPostBySlug, renderPostPage } from '../post-page'

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await getPostBySlug(params.slug, true)
  if (!post) return {}
  return buildPostMetadata(post)
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const session = await getSession()
  const post = ensurePostFound(await getPostBySlug(params.slug, !session))
  return renderPostPage(post, session)
}
