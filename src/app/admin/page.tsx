'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Area, AreaChart, ResponsiveContainer,
} from 'recharts';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AttachMoneyOutlinedIcon from '@mui/icons-material/AttachMoneyOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CardMembershipOutlinedIcon from '@mui/icons-material/CardMembershipOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import { md3 } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Sparkpoint { date: string; value: number }

interface DashboardData {
  user: { name: string | null; email: string };
  stats: {
    revenueToday: number;
    revenueYesterday: number;
    activeMembers: number;
    bookingsToday: number;
    openTasks: number;
    sparkline: Sparkpoint[];
  };
  todaysSessions: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    sessionType: { name: string };
    instructor: { name: string } | null;
    location: { name: string } | null;
    capacity: number;
    confirmedCount: number;
    waitlistCount: number;
    unpaidCount: number;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    dueAt: string | null;
    assignedTo: { name: string | null; email: string } | null;
    linkedCustomer: { name: string | null; email: string } | null;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'booking' | 'membership' | 'payment';
    description: string;
    userName: string | null;
    userEmail: string;
    createdAt: string;
  }>;
  membershipSnapshot: {
    active: number;
    paused: number;
    cancelled: number;
    expired: number;
    mrr: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name: string | null, email: string): string {
  if (name) return name.split(' ')[0];
  return email.split('@')[0];
}

function fmt$(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

function taskUrgency(dueAt: string | null): 'overdue' | 'soon' | 'normal' | 'none' {
  if (!dueAt) return 'none';
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff < 0) return 'overdue';
  if (diff < 48 * 3600 * 1000) return 'soon';
  return 'normal';
}

function formatDue(dueAt: string | null): string {
  if (!dueAt) return '';
  const d = new Date(dueAt);
  const diff = d.getTime() - Date.now();
  if (diff < 0) {
    const days = Math.floor(-diff / 86400000);
    return days === 0 ? 'Due today' : `${days}d overdue`;
  }
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 7) return `Due in ${days}d`;
  return `Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function initials(name: string | null, email: string): string {
  if (name) {
    const p = name.trim().split(' ');
    return p.length >= 2 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : p[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// MiniSparkline
// ---------------------------------------------------------------------------

function MiniSparkline({ data }: { data: Sparkpoint[] }) {
  // Guard: ResponsiveContainer needs the browser DOM — don't render during SSR
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Box sx={{ width: 72, height: 36, flexShrink: 0 }}>
      {mounted && (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={md3.primary} stopOpacity={0.25} />
              <stop offset="100%" stopColor={md3.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={md3.primary} strokeWidth={1.5} fill="url(#sg)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  trend?: { pct: number };
  sparkline?: Sparkpoint[];
  loading?: boolean;
}

function StatCard({ label, value, icon, iconBg, iconColor, trend, sparkline, loading }: StatCardProps) {
  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ height: '100%', boxSizing: 'border-box' }}>
          <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1.5 }}>
            <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: 2, flexShrink: 0 }} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="55%" height={14} sx={{ mb: 0.75 }} />
              <Skeleton width="70%" height={32} />
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ height: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}>
        <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1.5, width: '100%' }}>
          <Box
            sx={{
              width: 44, height: 44, borderRadius: 2, bgcolor: iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: iconColor,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'text.secondary', display: 'block', mb: 0.25 }}
            >
              {label}
            </Typography>
            <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {value}
            </Typography>
            {trend !== undefined && (
              <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                {trend.pct >= 0
                  ? <TrendingUpIcon sx={{ fontSize: 13, color: '#2e7d32' }} />
                  : <TrendingDownIcon sx={{ fontSize: 13, color: '#c62828' }} />
                }
                <Typography variant="caption" sx={{ color: trend.pct >= 0 ? '#2e7d32' : '#c62828', fontWeight: 600, lineHeight: 1 }}>
                  {trend.pct > 0 ? '+' : ''}{trend.pct.toFixed(0)}% vs yesterday
                </Typography>
              </Stack>
            )}
          </Box>
          {sparkline && sparkline.length > 0 && <MiniSparkline data={sparkline} />}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TodayScheduleCard
// ---------------------------------------------------------------------------

function TodayScheduleCard({ sessions, loading }: {
  sessions: DashboardData['todaysSessions'];
  loading: boolean;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <CalendarMonthOutlinedIcon fontSize="small" sx={{ color: md3.primary }} />
          <Typography variant="h6">Today&apos;s Schedule</Typography>
        </Stack>
        <Button
          component={NextLink}
          href="/admin/schedule"
          size="small"
          endIcon={<ArrowForwardIcon sx={{ fontSize: '14px !important' }} />}
          sx={{ color: md3.primary, fontWeight: 600, fontSize: '0.8125rem' }}
        >
          Show all
        </Button>
      </Box>
      <Divider />

      <Box sx={{ px: 2.5, py: 2 }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Box key={i} sx={{ mb: 2.5 }}>
              <Skeleton width="30%" height={13} sx={{ mb: 0.5 }} />
              <Skeleton width="60%" height={18} sx={{ mb: 0.5 }} />
              <Skeleton width="100%" height={6} sx={{ borderRadius: 1 }} />
            </Box>
          ))
        ) : sessions.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <EventOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">No sessions scheduled today</Typography>
          </Box>
        ) : (
          sessions.map((s, i) => {
            const fillPct = s.capacity > 0 ? (s.confirmedCount / s.capacity) * 100 : 0;
            const isFull = fillPct >= 100;
            const startTime = new Date(s.startsAt).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', hour12: true,
            });

            // Capacity bar color
            const barColor = fillPct >= 100 ? '#c62828' : fillPct >= 75 ? '#e65100' : md3.secondary;

            return (
              <Box key={s.id}>
                {i > 0 && <Divider sx={{ my: 2 }} />}
                <Stack direction="row" sx={{ gap: 2 }}>
                  {/* Time column */}
                  <Box sx={{ width: 68, flexShrink: 0, pt: 0.25 }}>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: md3.primary, lineHeight: 1.2 }}>
                      {startTime}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      {new Date(s.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </Typography>
                  </Box>

                  {/* Session details */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', lineHeight: 1.2 }}>
                        {s.sessionType.name}
                      </Typography>
                      <Stack direction="row" sx={{ gap: 0.75, flexShrink: 0 }}>
                        {s.unpaidCount > 0 && (
                          <Chip
                            label={`${s.unpaidCount} unpaid`}
                            size="small"
                            sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 600, height: 20, fontSize: '0.6875rem' }}
                          />
                        )}
                        {s.unpaidCount === 0 && s.confirmedCount > 0 && (
                          <Chip
                            label="Paid"
                            size="small"
                            icon={<CheckCircleOutlinedIcon sx={{ fontSize: '12px !important', color: 'inherit !important' }} />}
                            sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600, height: 20, fontSize: '0.6875rem' }}
                          />
                        )}
                        {isFull && (
                          <Chip label="Full" size="small"
                            sx={{ bgcolor: md3.errorContainer, color: md3.error, fontWeight: 600, height: 20, fontSize: '0.6875rem' }} />
                        )}
                        {s.waitlistCount > 0 && (
                          <Chip label={`+${s.waitlistCount} wait`} size="small" variant="outlined"
                            sx={{ fontWeight: 600, height: 20, fontSize: '0.6875rem' }} />
                        )}
                      </Stack>
                    </Stack>

                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                      {s.instructor ? s.instructor.name : 'No instructor'}
                      {s.location ? ` · ${s.location.name}` : ''}
                    </Typography>

                    {/* Capacity bar */}
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(fillPct, 100)}
                          sx={{
                            height: 6, borderRadius: 3,
                            bgcolor: md3.surfaceContainerHigh,
                            '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 3 },
                          }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', flexShrink: 0, minWidth: 36, textAlign: 'right' }}>
                        {s.confirmedCount}/{s.capacity}
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            );
          })
        )}
      </Box>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// QuickActionsCard
// ---------------------------------------------------------------------------

function QuickActionsCard() {
  const router = useRouter();

  const actions = [
    { label: 'Add customer', icon: <PersonAddOutlinedIcon />, href: '/admin/customers', color: md3.primaryContainer, fgColor: md3.primary },
    { label: 'Create event', icon: <EventOutlinedIcon />, href: '/admin/schedule', color: md3.secondaryContainer, fgColor: md3.secondary },
    { label: 'Send message', icon: <MoveToInboxOutlinedIcon />, href: '/admin/inbox', color: md3.tertiaryContainer, fgColor: md3.tertiary },
    { label: 'Process sale', icon: <PointOfSaleOutlinedIcon />, href: '/admin/reports', color: md3.surfaceContainerHighest, fgColor: md3.onSurfaceVariant },
  ];

  return (
    <Card>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
        <Typography variant="h6">Quick Actions</Typography>
      </Box>
      <Divider />
      <CardContent sx={{ pt: 2 }}>
        <Grid container spacing={1.5}>
          {actions.map((a) => (
            <Grid key={a.label} size={{ xs: 6 }}>
              <Box
                onClick={() => router.push(a.href)}
                sx={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 0.75, py: 1.75, px: 1, borderRadius: 2.5, cursor: 'pointer',
                  bgcolor: a.color, transition: 'opacity 150ms',
                  '&:hover': { opacity: 0.82 },
                }}
              >
                <Box sx={{ color: a.fgColor }}>{a.icon}</Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: a.fgColor, textAlign: 'center', lineHeight: 1.2 }}>
                  {a.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// MembershipSnapshotCard
// ---------------------------------------------------------------------------

function MembershipSnapshotCard({ snap, loading }: {
  snap: DashboardData['membershipSnapshot'] | null;
  loading: boolean;
}) {
  const total = snap ? snap.active + snap.paused + snap.cancelled + snap.expired : 1;

  const bars = snap
    ? [
        { label: 'Active', count: snap.active, color: md3.secondary, bg: md3.secondaryContainer },
        { label: 'Paused', count: snap.paused, color: md3.tertiary, bg: md3.tertiaryContainer },
        { label: 'Expired', count: snap.expired, color: md3.outline, bg: md3.surfaceVariant },
        { label: 'Cancelled', count: snap.cancelled, color: md3.error, bg: md3.errorContainer },
      ]
    : [];

  return (
    <Card>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <CardMembershipOutlinedIcon fontSize="small" sx={{ color: md3.primary }} />
          <Typography variant="h6">Memberships</Typography>
        </Stack>
        <Button
          component={NextLink}
          href="/admin/memberships"
          size="small"
          endIcon={<ArrowForwardIcon sx={{ fontSize: '14px !important' }} />}
          sx={{ color: md3.primary, fontWeight: 600, fontSize: '0.8125rem' }}
        >
          View all
        </Button>
      </Box>
      <Divider />
      <CardContent sx={{ pt: 2 }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Box key={i} sx={{ mb: 1.5 }}>
              <Skeleton width="45%" height={13} sx={{ mb: 0.5 }} />
              <Skeleton width="100%" height={8} sx={{ borderRadius: 1 }} />
            </Box>
          ))
        ) : (
          <>
            {bars.map((b) => (
              <Box key={b.label} sx={{ mb: 1.5 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>{b.label}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>{b.count}</Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={total > 0 ? (b.count / total) * 100 : 0}
                  sx={{
                    height: 7, borderRadius: 3,
                    bgcolor: b.bg,
                    '& .MuiLinearProgress-bar': { bgcolor: b.color, borderRadius: 3 },
                  }}
                />
              </Box>
            ))}

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
                  Monthly Recurring Revenue
                </Typography>
                <Typography sx={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em', color: md3.secondary, mt: 0.25 }}>
                  {fmt$(snap?.mrr ?? 0)}
                  <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, ml: 0.5 }}>/mo</Typography>
                </Typography>
              </Box>
              <Box
                sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: md3.secondaryContainer,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: md3.secondary }}
              >
                <AttachMoneyOutlinedIcon fontSize="small" />
              </Box>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TasksCard
// ---------------------------------------------------------------------------

function TasksCard({ tasks, loading }: {
  tasks: DashboardData['tasks'];
  loading: boolean;
}) {
  const urgencyColor = { overdue: '#c62828', soon: '#e65100', normal: md3.primary, none: md3.outline };

  return (
    <Card sx={{ height: '100%' }}>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <ChecklistOutlinedIcon fontSize="small" sx={{ color: md3.primary }} />
          <Typography variant="h6">To-Do</Typography>
        </Stack>
        <Button
          component={NextLink}
          href="/admin/tasks"
          size="small"
          endIcon={<ArrowForwardIcon sx={{ fontSize: '14px !important' }} />}
          sx={{ color: md3.primary, fontWeight: 600, fontSize: '0.8125rem' }}
        >
          Show all
        </Button>
      </Box>
      <Divider />

      <Box>
        {loading ? (
          <Box sx={{ px: 2.5, py: 2 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Stack key={i} direction="row" sx={{ alignItems: 'center', gap: 1.5, mb: 1.75 }}>
                <Skeleton variant="circular" width={10} height={10} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton width="75%" height={14} />
                  <Skeleton width="40%" height={12} sx={{ mt: 0.25 }} />
                </Box>
              </Stack>
            ))}
          </Box>
        ) : tasks.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, px: 3 }}>
            <CheckCircleOutlinedIcon sx={{ fontSize: 40, color: md3.secondary, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">All caught up — no open tasks</Typography>
          </Box>
        ) : (
          tasks.map((task, i) => {
            const urgency = taskUrgency(task.dueAt);
            const dotColor = urgencyColor[urgency];
            return (
              <Box key={task.id}>
                {i > 0 && <Divider sx={{ mx: 2.5 }} />}
                <Box sx={{ px: 2.5, py: 1.5, '&:hover': { bgcolor: 'action.hover' }, cursor: 'default' }}>
                  <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1.5 }}>
                    {task.status === 'IN_PROGRESS'
                      ? <RadioButtonCheckedIcon sx={{ fontSize: 14, color: dotColor, mt: 0.25, flexShrink: 0 }} />
                      : <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: dotColor, mt: 0.25, flexShrink: 0 }} />
                    }
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.25, lineHeight: 1.35 }}>
                        {task.title}
                      </Typography>
                      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {task.dueAt && (
                          <Chip
                            label={formatDue(task.dueAt)}
                            size="small"
                            sx={{
                              height: 18, fontSize: '0.625rem', fontWeight: 600,
                              bgcolor: urgency === 'overdue' ? md3.errorContainer : urgency === 'soon' ? '#fff3e0' : md3.surfaceVariant,
                              color: urgency === 'overdue' ? md3.error : urgency === 'soon' ? '#e65100' : 'text.secondary',
                            }}
                          />
                        )}
                        {task.assignedTo && (
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                            → {task.assignedTo.name ?? task.assignedTo.email}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      <Divider />
      <Box sx={{ px: 2.5, py: 1.5 }}>
        <Button
          component={NextLink}
          href="/admin/tasks"
          size="small"
          startIcon={<AddOutlinedIcon fontSize="small" />}
          sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.8125rem' }}
        >
          Add task
        </Button>
      </Box>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ActivityFeedCard
// ---------------------------------------------------------------------------

const ACTIVITY_COLORS: Record<string, { bg: string; fg: string }> = {
  booking: { bg: md3.primaryContainer, fg: md3.primary },
  membership: { bg: md3.secondaryContainer, fg: md3.secondary },
  payment: { bg: md3.tertiaryContainer, fg: md3.tertiary },
};

function ActivityFeedCard({ activity, loading }: {
  activity: DashboardData['recentActivity'];
  loading: boolean;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <AccessTimeOutlinedIcon fontSize="small" sx={{ color: md3.primary }} />
          <Typography variant="h6">Recent Activity</Typography>
        </Stack>
      </Box>
      <Divider />

      <Box>
        {loading ? (
          <Box sx={{ px: 2.5, py: 2 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Stack key={i} direction="row" sx={{ alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Skeleton variant="circular" width={34} height={34} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton width="70%" height={14} />
                  <Skeleton width="35%" height={12} sx={{ mt: 0.25 }} />
                </Box>
                <Skeleton width={40} height={12} />
              </Stack>
            ))}
          </Box>
        ) : activity.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, px: 3 }}>
            <GroupOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">No activity in the last 7 days</Typography>
          </Box>
        ) : (
          activity.map((item, i) => {
            const colors = ACTIVITY_COLORS[item.type] ?? ACTIVITY_COLORS.booking;
            return (
              <Box key={item.id}>
                {i > 0 && <Divider sx={{ mx: 2.5 }} />}
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, px: 2.5, py: 1.375 }}>
                  <Tooltip title={item.userName ?? item.userEmail}>
                    <Avatar
                      sx={{
                        width: 34, height: 34, flexShrink: 0,
                        bgcolor: colors.bg, color: colors.fg,
                        fontSize: '0.75rem', fontWeight: 700,
                      }}
                    >
                      {initials(item.userName, item.userEmail)}
                    </Avatar>
                  </Tooltip>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3 }}>
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        {item.userName ?? item.userEmail.split('@')[0]}
                      </Box>
                      {' '}
                      <Box component="span" sx={{ color: 'text.secondary' }}>{item.description}</Box>
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0, fontSize: '0.6875rem' }}>
                    {relTime(item.createdAt)}
                  </Typography>
                </Stack>
              </Box>
            );
          })
        )}
      </Box>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    fetch('/api/admin/dashboard')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json() as Promise<DashboardData>;
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((err: Error) => {
        console.error('[Dashboard] fetch failed:', err.message);
        setFetchError(err.message);
        setLoading(false);
      });
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const revToday = data?.stats.revenueToday ?? 0;
  const revYesterday = data?.stats.revenueYesterday ?? 0;
  const revTrend = revYesterday > 0
    ? ((revToday - revYesterday) / revYesterday) * 100
    : revToday > 0 ? 100 : 0;

  return (
    <Box sx={{ p: { xs: 3, md: 4 }, maxWidth: 1400 }}>

      {/* ── API error banner ───────────────────────────────────────── */}
      {fetchError && !loading && (
        <Box sx={{
          mb: 3, px: 2.5, py: 1.5, borderRadius: 2,
          bgcolor: '#fff3e0', border: '1px solid #ffcc80',
          display: 'flex', alignItems: 'center', gap: 1,
        }}>
          <Typography variant="body2" sx={{ color: '#e65100', fontWeight: 600 }}>
            Dashboard data failed to load: {fetchError}
          </Typography>
          <Button
            size="small"
            sx={{ ml: 'auto', color: '#e65100', fontWeight: 700 }}
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </Box>
      )}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <Box sx={{ mb: 4 }}>
        {loading ? (
          <>
            <Skeleton width={280} height={36} sx={{ mb: 0.75 }} />
            <Skeleton width={200} height={18} />
          </>
        ) : (
          <>
            <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 0.5 }}>
              {greeting()}, {firstName(data?.user.name ?? null, data?.user.email ?? '')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{today}</Typography>
          </>
        )}
      </Box>

      {/* ── Stat cards ─────────────────────────────────────────────── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Revenue today"
            value={loading ? '—' : fmt$(revToday)}
            icon={<AttachMoneyOutlinedIcon />}
            iconBg={md3.primaryContainer}
            iconColor={md3.primary}
            trend={loading ? undefined : { pct: revTrend }}
            sparkline={data?.stats.sparkline}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Active members"
            value={loading ? '—' : data?.stats.activeMembers ?? 0}
            icon={<GroupOutlinedIcon />}
            iconBg={md3.secondaryContainer}
            iconColor={md3.secondary}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Bookings today"
            value={loading ? '—' : data?.stats.bookingsToday ?? 0}
            icon={<CalendarMonthOutlinedIcon />}
            iconBg={md3.tertiaryContainer}
            iconColor={md3.tertiary}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Open tasks"
            value={loading ? '—' : data?.stats.openTasks ?? 0}
            icon={<ChecklistOutlinedIcon />}
            iconBg={md3.surfaceContainerHighest}
            iconColor={md3.onSurfaceVariant}
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* ── Middle row ─────────────────────────────────────────────── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Today's schedule */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <TodayScheduleCard sessions={data?.todaysSessions ?? []} loading={loading} />
        </Grid>

        {/* Right column: Quick Actions + Membership Snapshot */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={2.5} sx={{ height: '100%' }}>
            <QuickActionsCard />
            <MembershipSnapshotCard snap={data?.membershipSnapshot ?? null} loading={loading} />
          </Stack>
        </Grid>
      </Grid>

      {/* ── Bottom row ─────────────────────────────────────────────── */}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TasksCard tasks={data?.tasks ?? []} loading={loading} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ActivityFeedCard activity={data?.recentActivity ?? []} loading={loading} />
        </Grid>
      </Grid>

    </Box>
  );
}
