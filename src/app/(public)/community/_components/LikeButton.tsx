'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';

interface Props {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  disabled?: boolean;
}

export function LikeButton({ postId, initialLiked, initialCount, disabled }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (disabled || loading) return;
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);
    setLoading(true);
    try {
      const res = await fetch(`/api/community/posts/${postId}/like`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const data = (await res.json()) as { liked: boolean; count: number };
      setLiked(data.liked);
      setCount(data.count);
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="small"
      onClick={handleClick}
      disabled={disabled}
      startIcon={liked ? <FavoriteIcon sx={{ fontSize: '16px !important' }} /> : <FavoriteBorderIcon sx={{ fontSize: '16px !important' }} />}
      sx={{
        color: liked ? '#e11d48' : 'text.secondary',
        minWidth: 0,
        p: '2px 8px',
        fontSize: '0.875rem',
        '&:hover': { color: '#e11d48', bgcolor: '#fce7ef' },
        '&.Mui-disabled': { opacity: 0.6, color: 'text.secondary' },
      }}
      aria-label={liked ? 'Unlike post' : 'Like post'}
    >
      {count}
    </Button>
  );
}
