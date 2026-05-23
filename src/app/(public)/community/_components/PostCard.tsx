'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import { LikeButton } from './LikeButton';
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
  post: Post;
  isAuthenticated: boolean;
  truncate?: boolean;
}

const ROLE_LABELS: Partial<Record<Role, string>> = {
  ADMIN: 'Owner',
  STAFF: 'Staff',
};

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

const TRUNCATE_LENGTH = 300;

export function PostCard({ post, isAuthenticated, truncate = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  const shouldTruncate = truncate && post.body.length > TRUNCATE_LENGTH;
  const displayBody =
    shouldTruncate && !expanded ? post.body.slice(0, TRUNCATE_LENGTH) + '…' : post.body;

  const roleLabel = ROLE_LABELS[post.author.role];

  return (
    <Card>
      <CardContent>
        {/* Author row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: 'primary.light',
              color: 'primary.main',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {getInitials(post.author.name)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {post.author.name ?? 'Unknown'}
              </Typography>
              {roleLabel && (
                <Chip label={roleLabel} size="small" variant="outlined" />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </Typography>
          </Box>
          {!post.isPublished && (
            <Chip label="Draft" size="small" variant="outlined" sx={{ color: 'text.secondary' }} />
          )}
        </Box>

        {/* Title */}
        {post.title && (
          <Typography variant="h6" sx={{ mb: 1, lineHeight: 1.35 }}>
            {post.title}
          </Typography>
        )}

        {/* Body */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ whiteSpace: 'pre-line' }}
        >
          {displayBody}
        </Typography>
        {shouldTruncate && !expanded && (
          <Button
            size="small"
            onClick={() => setExpanded(true)}
            sx={{ mt: 0.5, p: 0, minWidth: 0, fontWeight: 600 }}
          >
            Read more
          </Button>
        )}

        {/* Image */}
        {post.imageUrl && (
          <Box
            sx={{
              mt: 1.5,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt=""
              style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </Box>
        )}

        {/* Actions */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <LikeButton
            postId={post.id}
            initialLiked={post.hasLiked}
            initialCount={post._count.likes}
            disabled={!isAuthenticated}
          />
          <Link
            component={NextLink}
            href={`/community/${post.id}`}
            underline="none"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              color: 'text.secondary',
              fontSize: '0.875rem',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
            <span>{post._count.comments}</span>
          </Link>
          <Link
            component={NextLink}
            href={`/community/${post.id}`}
            underline="always"
            sx={{
              ml: 'auto',
              fontSize: '0.875rem',
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            View post
          </Link>
        </Box>
      </CardContent>
    </Card>
  );
}
