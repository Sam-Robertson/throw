'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';

import { useInboxCount } from '../_components/InboxCountContext';
import { md3 } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConversationSummary {
  id: string;
  channel: string;
  subject: string | null;
  adminUnread: number;
  lastMessageAt: string | null;
  user: { id: string; name: string | null; email: string };
  messages: Array<{ body: string; direction: string; createdAt: string; isRead: boolean }>;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  subject: string | null;
  isRead: boolean;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  channel: string;
  adminUnread: number;
  lastMessageAt: string | null;
  user: { id: string; name: string | null; email: string; phone: string | null };
  messages: Message[];
}

interface SegmentTab {
  value: string;   // "customers" | "leads" | "instructors" | "plan:{slug}"
  label: string;
  unread: number;
}

interface MembershipPlan {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// ContactRow
// ---------------------------------------------------------------------------

function ContactRow({
  conv, selected, onClick,
}: {
  conv: ConversationSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const preview = conv.messages[0]?.body ?? '';
  const name = conv.user.name ?? conv.user.email;

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        px: 2,
        py: 1.5,
        cursor: 'pointer',
        bgcolor: selected ? md3.primaryContainer : 'transparent',
        borderLeft: '3px solid',
        borderLeftColor: selected ? md3.primary : 'transparent',
        '&:hover': { bgcolor: selected ? md3.primaryContainer : 'action.hover' },
        transition: 'background-color 120ms',
      }}
    >
      <Badge
        badgeContent={conv.adminUnread || undefined}
        color="error"
        max={9}
        sx={{ flexShrink: 0, '& .MuiBadge-badge': { fontSize: '0.625rem', minWidth: 16, height: 16 } }}
      >
        <Avatar
          sx={{
            width: 38,
            height: 38,
            fontSize: '0.8125rem',
            fontWeight: 600,
            bgcolor: selected ? md3.primary : md3.primaryContainer,
            color: selected ? 'white' : md3.primary,
          }}
        >
          {initials(conv.user.name, conv.user.email)}
        </Avatar>
      </Badge>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: conv.adminUnread ? 700 : 500,
              flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0, fontSize: '0.7rem' }}>
            {formatTime(conv.lastMessageAt)}
          </Typography>
        </Box>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: conv.adminUnread ? 'text.primary' : 'text.secondary',
            fontWeight: conv.adminUnread ? 600 : 400,
          }}
        >
          {preview || <Box component="span" sx={{ fontStyle: 'italic', opacity: 0.5 }}>No messages yet</Box>}
        </Typography>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === 'outbound';
  return (
    <Box sx={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start', mb: 1 }}>
      <Box
        sx={{
          maxWidth: '70%',
          px: 2,
          py: 1,
          borderRadius: isOut ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          bgcolor: isOut ? md3.primary : md3.surfaceVariant,
          color: isOut ? 'white' : 'text.primary',
        }}
      >
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
          {msg.body}
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: 'block', textAlign: isOut ? 'right' : 'left', opacity: 0.6, mt: 0.5, fontSize: '0.65rem' }}
        >
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Typography>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// InboxPage
// ---------------------------------------------------------------------------

const STATIC_TABS: SegmentTab[] = [
  { value: 'customers', label: 'All customers', unread: 0 },
  { value: 'leads',     label: 'Leads',          unread: 0 },
  { value: 'instructors', label: 'Instructors',  unread: 0 },
];

export default function InboxPage() {
  const [segment, setSegment] = useState('customers');
  const [tabs, setTabs] = useState<SegmentTab[]>(STATIC_TABS);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ConversationDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const { refresh: refreshBadge } = useInboxCount();

  // Load membership plans → build dynamic segment tabs
  useEffect(() => {
    fetch('/api/admin/membership-plans')
      .then((r) => r.json())
      .then((plans: MembershipPlan[]) => {
        const planTabs: SegmentTab[] = (plans as MembershipPlan[])
          .filter((p) => p.isActive)
          .map((p) => ({ value: `plan:${p.slug}`, label: p.name, unread: 0 }));
        setTabs([...STATIC_TABS, ...planTabs]);
      })
      .catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Load conversations for current segment
  const loadConversations = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ segment });
    if (debouncedSearch) params.set('q', debouncedSearch);
    const res = await fetch(`/api/admin/inbox?${params}`);
    if (res.ok) {
      const data: ConversationSummary[] = await res.json();
      setConversations(data);
      // Update unread badge on this tab
      const unread = data.reduce((sum, c) => sum + c.adminUnread, 0);
      setTabs((prev) =>
        prev.map((t) => (t.value === segment ? { ...t, unread } : t))
      );
    }
    setLoading(false);
  }, [segment, debouncedSearch]);

  useEffect(() => {
    setSelectedId(null);
    setThread(null);
    loadConversations();
  }, [loadConversations]);

  // Load thread when selection changes
  useEffect(() => {
    if (!selectedId) { setThread(null); return; }
    setThreadLoading(true);
    Promise.all([
      fetch(`/api/admin/inbox/${selectedId}`, { method: 'PATCH' }),
      fetch(`/api/admin/inbox/${selectedId}`).then((r) => r.json()),
    ]).then(([, data]) => {
      setThread(data as ConversationDetail);
      setThreadLoading(false);
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedId ? { ...c, adminUnread: 0 } : c))
      );
      setTabs((prev) =>
        prev.map((t) =>
          t.value === segment ? { ...t, unread: Math.max(0, t.unread - 1) } : t
        )
      );
      refreshBadge();
    });
  }, [selectedId, segment, refreshBadge]);

  // Scroll to bottom on new messages
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length]);

  async function sendReply() {
    if (!replyBody.trim() || !selectedId || !thread) return;
    setSending(true);
    const res = await fetch(`/api/admin/inbox/${selectedId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: replyBody.trim() }),
    });
    if (res.ok) {
      const msg: Message = await res.json();
      setThread((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg], lastMessageAt: msg.createdAt } : prev
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? { ...c, lastMessageAt: msg.createdAt, messages: [{ body: msg.body, direction: 'outbound', createdAt: msg.createdAt, isRead: true }] }
            : c
        )
      );
      setReplyBody('');
    }
    setSending(false);
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>

      {/* ── Segment tabs — full width across the top ──────────────── */}
      <Box
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          bgcolor: 'background.default',
        }}
      >
        <Tabs
          value={segment}
          onChange={(_, v: string) => setSegment(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 2,
            minHeight: 44,
            '& .MuiTab-root': {
              minHeight: 44,
              fontSize: '0.8125rem',
              fontWeight: 500,
              py: 0,
              px: 1.75,
              textTransform: 'none',
              letterSpacing: 0,
            },
            '& .MuiTab-root.Mui-selected': { fontWeight: 700 },
            '& .MuiTabs-indicator': { height: 2 },
          }}
        >
          {tabs.map((t) => (
            <Tab
              key={t.value}
              value={t.value}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {t.label}
                  {t.unread > 0 && (
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 18,
                        height: 18,
                        px: 0.5,
                        borderRadius: '9px',
                        bgcolor: 'error.main',
                        color: 'white',
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        lineHeight: 1,
                      }}
                    >
                      {t.unread > 99 ? '99+' : t.unread}
                    </Box>
                  )}
                </Box>
              }
            />
          ))}
        </Tabs>
      </Box>

      {/* ── Below tabs: left list + right thread ──────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Left panel */}
        <Box
          sx={{
            width: { xs: selectedId ? 0 : '100%', sm: 300, md: 320 },
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            transition: 'width 200ms',
          }}
        >
          {/* Search */}
          <Box sx={{ px: 1.5, py: 1.25, flexShrink: 0 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, fontSize: '0.8125rem' } }}
            />
          </Box>

          <Divider />

          {/* Contact list */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
                <CircularProgress size={26} />
              </Box>
            ) : conversations.length === 0 ? (
              <Box sx={{ px: 3, pt: 6, textAlign: 'center' }}>
                <MoveToInboxOutlinedIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1.5 }} />
                <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', mb: 0.5 }}>
                  No conversations yet
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Messages with this group will appear here.
                </Typography>
              </Box>
            ) : (
              conversations.map((conv) => (
                <ContactRow
                  key={conv.id}
                  conv={conv}
                  selected={conv.id === selectedId}
                  onClick={() => setSelectedId(conv.id)}
                />
              ))
            )}
          </Box>
        </Box>

        {/* Right panel */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {!selectedId || (!thread && !threadLoading) ? (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                px: 4,
                textAlign: 'center',
              }}
            >
              <MoveToInboxOutlinedIcon sx={{ fontSize: 72, color: 'text.disabled', opacity: 0.3 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Stay close to your customers
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 360 }}>
                Message them via SMS. All from one inbox.
              </Typography>
            </Box>
          ) : threadLoading ? (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={32} />
            </Box>
          ) : thread ? (
            <>
              {/* Thread header */}
              <Box
                sx={{
                  px: 3, py: 1.75,
                  borderBottom: '1px solid', borderColor: 'divider',
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 1.5,
                }}
              >
                <Avatar
                  sx={{
                    width: 38, height: 38,
                    bgcolor: md3.primaryContainer, color: md3.primary,
                    fontWeight: 600, fontSize: '0.8125rem',
                  }}
                >
                  {initials(thread.user.name, thread.user.email)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, lineHeight: 1.25, fontSize: '0.9375rem' }}>
                    {thread.user.name ?? thread.user.email}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {thread.user.phone ?? thread.user.email}
                  </Typography>
                </Box>
              </Box>

              {/* Messages */}
              <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2, display: 'flex', flexDirection: 'column' }}>
                {thread.messages.length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center', mt: 4 }}>
                    No messages yet — send the first one below.
                  </Typography>
                )}
                {thread.messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
                <div ref={threadEndRef} />
              </Box>

              {/* Reply composer */}
              <Box sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
                <Stack direction="row" sx={{ alignItems: 'flex-end', gap: 1 }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={1}
                    maxRows={5}
                    size="small"
                    placeholder="Reply via SMS…"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                  <IconButton
                    disabled={!replyBody.trim() || sending}
                    onClick={sendReply}
                    sx={{
                      bgcolor: md3.primary,
                      color: 'white',
                      width: 40, height: 40,
                      flexShrink: 0,
                      '&:hover': { bgcolor: md3.primary, opacity: 0.85 },
                      '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
                    }}
                  >
                    {sending
                      ? <CircularProgress size={18} sx={{ color: 'inherit' }} />
                      : <SendOutlinedIcon fontSize="small" />
                    }
                  </IconButton>
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, display: 'block' }}>
                  Enter to send · Shift+Enter for new line
                </Typography>
              </Box>
            </>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
