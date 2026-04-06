import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function LegacyPostPage({ params }: { params: { slug: string } }) {
  redirect(`/post/${params.slug}`)
}
