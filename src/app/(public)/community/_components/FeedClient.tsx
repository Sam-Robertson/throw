'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { PostCard } from './PostCard';
import type { Role } from '@prisma/client';

interface Post {
  id: string;
  title: string | null;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  isPublished: boolean;
  author: { name: string | null; role: Role };
  _count: { likes: number; comments: number };
  hasLiked: boolean;
}

interface Props {
  initialPosts: Post[];
  isAuthenticated: boolean;
}

const LIMIT = 10;

export function FeedClient({ initialPosts, isAuthenticated }: Props) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts.length === LIMIT);

  async function loadMore() {
    setLoading(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(`/api/community/posts?page=${nextPage}&limit=${LIMIT}`);
      if (!res.ok) throw new Error('Failed');
      const data = (await res.json()) as { posts: Post[] };
      setPosts((prev) => [...prev, ...data.posts]);
      setPage(nextPage);
      setHasMore(data.posts.length === LIMIT);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack spacing={2}>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} isAuthenticated={isAuthenticated} truncate />
      ))}

      {hasMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
          <Button variant="outlined" onClick={loadMore} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </Box>
      )}
    </Stack>
  );
}
