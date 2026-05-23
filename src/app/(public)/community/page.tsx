import NextLink from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { FeedClient } from './_components/FeedClient';

export const metadata = { title: 'Community — Throw' };

export default async function CommunityPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role;
  const isAuthenticated = !!userId;
  const isStaffOrAdmin = role === 'ADMIN' || role === 'STAFF';

  const where = isStaffOrAdmin ? {} : { isPublished: true };

  const posts = await prisma.communityPost.findMany({
    where,
    include: {
      author: { select: { name: true, role: true } },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  let likedPostIds = new Set<string>();
  if (userId) {
    const likes = await prisma.communityLike.findMany({
      where: { userId, postId: { in: posts.map((p) => p.id) } },
      select: { postId: true },
    });
    likedPostIds = new Set(likes.map((l) => l.postId));
  }

  const postsWithLiked = posts.map((post) => ({
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    hasLiked: likedPostIds.has(post.id),
  }));

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 5, md: 7 }, px: { xs: 3, md: 4 } }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h2" sx={{ fontWeight: 700 }}>
          Community
        </Typography>
        {isStaffOrAdmin && (
          <Button component={NextLink} href="/admin/community/new" variant="contained" size="small">
            New Post
          </Button>
        )}
      </Box>

      {/* Auth banner */}
      {!isAuthenticated && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          action={
            <Button component={NextLink} href="/login" size="small" variant="outlined" color="info">
              Login
            </Button>
          }
        >
          Sign in to like and comment.
        </Alert>
      )}

      {/* Feed */}
      {postsWithLiked.length === 0 ? (
        <Typography sx={{ textAlign: 'center' }} color="text.secondary">
          No posts yet. Check back soon!
        </Typography>
      ) : (
        <FeedClient initialPosts={postsWithLiked} isAuthenticated={isAuthenticated} />
      )}
    </Container>
  );
}
