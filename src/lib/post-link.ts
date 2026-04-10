type PostLinkInput = {
  slug?: string | null
  publicId?: number | null
  username?: string | null
  author?: { username?: string | null } | null
}

export function getPostPath(post: PostLinkInput): string {
  const username = post.username || post.author?.username || ''
  if (username && post.publicId) {
    return `/${encodeURIComponent(username)}/post/${post.publicId}`
  }
  if (post.slug) {
    return `/post/${encodeURIComponent(post.slug)}`
  }
  return '/'
}

export function getPostUrl(post: PostLinkInput, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}${getPostPath(post)}`
}
