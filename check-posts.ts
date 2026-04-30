// List the first post from database
import { prisma } from '@/lib/prisma'

async function main() {
  const post = await prisma.post.findFirst()
  if (post) {
    console.log('First post:', post.id, post.title)
  } else {
    console.log('No posts found in database')
  }
  await prisma.$disconnect()
}

main()
