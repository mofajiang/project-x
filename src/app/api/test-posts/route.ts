import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const post = await prisma.post.findFirst()
    if (!post) {
      // Create a test post
      const user = await prisma.user.findFirst()
      if (!user) {
        return NextResponse.json({ error: 'No users found' }, { status: 400 })
      }
      const rows = await prisma.$queryRawUnsafe<{ nextId: number }[]>(
        `SELECT COALESCE(MAX(publicId), 0) + 1 as nextId FROM Post`
      )
      const newPost = await prisma.post.create({
        data: {
          publicId: Number(rows[0]?.nextId) || 1,
          title: 'Test Post',
          slug: 'test-post-' + Date.now(),
          content: 'This is a test post for testing comments',
          published: true,
          authorId: user.id,
        },
      })
      return NextResponse.json({ postId: newPost.id, title: newPost.title })
    }
    return NextResponse.json({ postId: post.id, title: post.title })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
