'use client';

import { useRef, useState } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

import { useInboxCount } from './InboxCountContext';

// Icons
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CardGiftcardOutlinedIcon from '@mui/icons-material/CardGiftcardOutlined';
import CardMembershipOutlinedIcon from '@mui/icons-material/CardMembershipOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import WebOutlinedIcon from '@mui/icons-material/WebOutlined';

import { md3 } from '@/lib/theme';

export const DRAWER_WIDTH = 240;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A plain link in the sidebar. */
interface NavLinkItem {
  kind: 'link';
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  /** When set, the sidebar will look up the live badge count for this key. */
  badgeKey?: 'inbox';
}

/** A sub-item inside a flyout panel. */
interface FlyoutSubItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

/** A group of sub-items shown inside a flyout panel. */
interface FlyoutGroup {
  label?: string;
  items: FlyoutSubItem[];
}

/** A nav item that opens a flyout submenu. */
interface NavFlyoutItem {
  kind: 'flyout';
  label: string;
  icon: React.ReactNode;
  /** Returns true when the sidebar button should appear highlighted. */
  isActive: (pathname: string) => boolean;
  /** Optional header text shown at the top of the flyout. */
  flyoutTitle?: string;
  groups: FlyoutGroup[];
}

type AnyNavItem = NavLinkItem | NavFlyoutItem;

interface NavSection {
  label: string;
  items: AnyNavItem[];
}

// ---------------------------------------------------------------------------
// Nav data
// ---------------------------------------------------------------------------

const MAIN_NAV: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { kind: 'link', href: '/admin', label: 'Dashboard', icon: <DashboardOutlinedIcon fontSize="small" />, exact: true },
      { kind: 'link', href: '/admin/inbox', label: 'Inbox', icon: <MoveToInboxOutlinedIcon fontSize="small" />, badgeKey: 'inbox' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { kind: 'link', href: '/admin/schedule',    label: 'Schedule',    icon: <CalendarMonthOutlinedIcon fontSize="small" /> },
      { kind: 'link', href: '/admin/class-types',  label: 'Class Types', icon: <StyleOutlinedIcon fontSize="small" /> },

      // ── Customers flyout ──────────────────────────────────────────────
      {
        kind: 'flyout',
        label: 'Customers',
        icon: <PeopleOutlinedIcon fontSize="small" />,
        isActive: (p) => p.startsWith('/admin/customers'),
        groups: [
          {
            label: 'CRM',
            items: [
              { href: '/admin/customers', label: 'Customer List', icon: <PeopleOutlinedIcon fontSize="small" />, exact: true },
            ],
          },
          {
            label: 'ORGANIZATION',
            items: [
              { href: '/admin/customers/tags',  label: 'Tags',  icon: <LabelOutlinedIcon fontSize="small" /> },
              { href: '/admin/customers/notes', label: 'Notes', icon: <ArticleOutlinedIcon fontSize="small" /> },
            ],
          },
          {
            label: 'SET-UP',
            items: [
              { href: '/admin/customers/payment-plans',   label: 'Payment Plans',      icon: <CreditCardOutlinedIcon fontSize="small" /> },
              { href: '/admin/customers/custom-fields',   label: 'Custom Info Fields', icon: <ListAltOutlinedIcon fontSize="small" /> },
            ],
          },
        ],
      },

      // ── Memberships flyout ────────────────────────────────────────────
      {
        kind: 'flyout',
        label: 'Memberships',
        icon: <CardMembershipOutlinedIcon fontSize="small" />,
        isActive: (p) => p.startsWith('/admin/memberships') || p.startsWith('/admin/membership-plans'),
        groups: [
          {
            items: [
              { href: '/admin/membership-plans', label: 'Subscriptions & Packs', icon: <CardMembershipOutlinedIcon fontSize="small" /> },
              { href: '/admin/memberships',       label: 'Active Memberships',    icon: <GroupOutlinedIcon fontSize="small" />, exact: true },
            ],
          },
        ],
      },

      { kind: 'link', href: '/admin/waivers', label: 'Waivers', icon: <GavelOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    label: 'Content',
    items: [
      { kind: 'link', href: '/admin/community',     label: 'Community',     icon: <ForumOutlinedIcon fontSize="small" /> },
      { kind: 'link', href: '/admin/landing-pages', label: 'Landing Pages', icon: <WebOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    label: 'Business',
    items: [
      { kind: 'link', href: '/admin/reports', label: 'Reports', icon: <BarChartOutlinedIcon fontSize="small" /> },
      { kind: 'link', href: '/admin/tips', label: 'Tips', icon: <PaidOutlinedIcon fontSize="small" /> },
    ],
  },
];

// Studio Set-up is kept as a separate flyout at the bottom of the sidebar.
const STUDIO_SETUP_GROUPS: FlyoutGroup[] = [
  {
    label: 'STAFF',
    items: [
      { href: '/admin/studio-setup/instructors', label: 'Instructors', icon: <PersonOutlinedIcon fontSize="small" /> },
      { href: '/admin/tasks',                     label: 'Staff Tasks', icon: <ChecklistOutlinedIcon fontSize="small" /> },
      { href: '/admin/studio-setup/roles',        label: 'Roles & Permissions', icon: <AdminPanelSettingsOutlinedIcon fontSize="small" /> },
      { href: '/admin/studio-setup/shelves',      label: 'Shelf Spaces', icon: <Inventory2OutlinedIcon fontSize="small" /> },
    ],
  },
  {
    label: 'RETAIL',
    items: [
      { href: '/admin/studio-setup/products', label: 'Products', icon: <StorefrontOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    label: 'PROMOS',
    items: [
      { href: '/admin/studio-setup/discount-codes', label: 'Discount Codes', icon: <LocalOfferOutlinedIcon fontSize="small" /> },
      { href: '/admin/studio-setup/gift-cards',     label: 'Gift Cards',     icon: <CardGiftcardOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    label: 'MESSAGING',
    items: [
      { href: '/admin/studio-setup/templates', label: 'Templates', icon: <MailOutlinedIcon fontSize="small" /> },
      { href: '/admin/studio-setup/suppressions', label: 'Suppressions', icon: <BlockOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    label: 'LOCATIONS',
    items: [
      { href: '/admin/studio-setup/locations', label: 'Locations', icon: <LocationOnOutlinedIcon fontSize="small" /> },
    ],
  },
];

// ---------------------------------------------------------------------------
// NavLink — renders a single plain sidebar link
// ---------------------------------------------------------------------------

function NavLink({
  item, pathname, onClick, badgeContent,
}: {
  item: NavLinkItem | FlyoutSubItem;
  pathname: string;
  onClick?: () => void;
  badgeContent?: number;
}) {
  const active = 'exact' in item && item.exact
    ? pathname === item.href
    : pathname.startsWith(item.href);

  return (
    <ListItemButton
      component={NextLink}
      href={item.href}
      onClick={onClick}
      selected={active}
      sx={{
        borderRadius: 2,
        mx: 1,
        mb: 0.25,
        py: 0.75,
        minHeight: 36,
        '&.Mui-selected': {
          bgcolor: md3.primaryContainer,
          '& .MuiListItemIcon-root': { color: md3.primary },
          '& .MuiListItemText-primary': { color: md3.primary, fontWeight: 600 },
        },
        '&:hover:not(.Mui-selected)': { bgcolor: md3.surfaceVariant },
      }}
    >
      <ListItemIcon sx={{ minWidth: 32, color: active ? md3.primary : 'text.secondary' }}>
        <Badge
          badgeContent={badgeContent ?? 0}
          color="error"
          max={99}
          invisible={!badgeContent}
          sx={{ '& .MuiBadge-badge': { fontSize: '0.625rem', minWidth: 16, height: 16, padding: '0 3px' } }}
        >
          {item.icon}
        </Badge>
      </ListItemIcon>
      <ListItemText
        primary={item.label}
        slotProps={{ primary: { sx: { fontSize: '0.8125rem', fontWeight: active ? 600 : 400 } } }}
      />
    </ListItemButton>
  );
}

// ---------------------------------------------------------------------------
// FlyoutPanel — the shared popover content shell
// ---------------------------------------------------------------------------

function FlyoutPanel({ groups, flyoutTitle, pathname, onNavClick }: {
  groups: FlyoutGroup[];
  flyoutTitle?: string;
  pathname: string;
  onNavClick: () => void;
}) {
  return (
    <>
      {flyoutTitle && (
        <>
          <Box sx={{ px: 2.5, pt: 1.75, pb: 1 }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.disabled' }}>
              {flyoutTitle}
            </Typography>
          </Box>
          <Divider sx={{ mb: 0.5 }} />
        </>
      )}
      {groups.map((group, gi) => (
        <Box key={group.label ?? gi}>
          {group.label && (
            <Typography sx={{ px: 2.5, pt: 1.25, pb: 0.25, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', color: 'text.disabled' }}>
              {group.label}
            </Typography>
          )}
          <List dense disablePadding>
            {group.items.map((sub) => (
              <NavLink key={sub.href} item={sub} pathname={pathname} onClick={onNavClick} />
            ))}
          </List>
        </Box>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// FlyoutNavItem — sidebar button that opens a flyout on hover OR click
// ---------------------------------------------------------------------------

interface FlyoutNavItemProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  groups: FlyoutGroup[];
  flyoutTitle?: string;
  pathname: string;
  /** Controlled open state — owned by the parent so only one flyout is open at a time. */
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Called after a sub-item is navigated to (e.g. close mobile drawer). */
  onNavClick?: () => void;
}

function FlyoutNavItem({ label, icon, isActive, groups, flyoutTitle, pathname, open, onOpen, onClose, onNavClick }: FlyoutNavItemProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function handleMouseEnter() {
    clearTimeout(closeTimer.current);
    onOpen(); // instantly replaces any other open flyout
  }

  function handleMouseLeave() {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(onClose, 300);
  }

  function handleButtonClick() {
    if (open) { onClose(); } else { onOpen(); }
  }

  function handleNavClick() {
    onClose();
    onNavClick?.();
  }

  function handleClickAway(e: MouseEvent | TouchEvent) {
    if (buttonRef.current?.contains(e.target as Node)) return;
    onClose();
  }

  const highlighted = isActive || open;

  return (
    <>
      <ListItemButton
        ref={buttonRef}
        onClick={handleButtonClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        selected={highlighted}
        sx={{
          borderRadius: 2,
          mx: 1,
          mb: 0.25,
          py: 0.75,
          minHeight: 36,
          '&.Mui-selected': {
            bgcolor: md3.primaryContainer,
            '& .MuiListItemIcon-root': { color: md3.primary },
            '& .MuiListItemText-primary': { color: md3.primary, fontWeight: 600 },
          },
          '&:hover:not(.Mui-selected)': { bgcolor: md3.surfaceVariant },
        }}
      >
        <ListItemIcon sx={{ minWidth: 32, color: highlighted ? md3.primary : 'text.secondary' }}>
          {icon}
        </ListItemIcon>
        <ListItemText
          primary={label}
          slotProps={{
            primary: {
              sx: { fontSize: '0.8125rem', fontWeight: highlighted ? 600 : 400, color: highlighted ? md3.primary : 'inherit' },
            },
          }}
        />
        <ChevronRightIcon
          fontSize="small"
          sx={{
            color: highlighted ? md3.primary : 'text.disabled',
            transition: 'transform 150ms',
            transform: open ? 'rotate(90deg)' : 'none',
          }}
        />
      </ListItemButton>

      {/*
        Popper has no backdrop — mouse events flow freely between the trigger
        button and the panel, so hover open/close works reliably.
        ClickAwayListener handles click-outside instead.
      */}
      <Popper
        open={open}
        anchorEl={buttonRef.current}
        placement="right-start"
        modifiers={[{ name: 'offset', options: { offset: [0, 6] } }]}
        sx={{ zIndex: 1400 }}
        disablePortal={false}
      >
        <ClickAwayListener onClickAway={handleClickAway} mouseEvent="onMouseDown">
          <Paper
            elevation={6}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            sx={{
              width: 232,
              borderRadius: 2,
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              pb: 1,
            }}
          >
            <FlyoutPanel
              groups={groups}
              flyoutTitle={flyoutTitle}
              pathname={pathname}
              onNavClick={handleNavClick}
            />
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  );
}

// ---------------------------------------------------------------------------
// SidebarContent
// ---------------------------------------------------------------------------

interface SidebarContentProps {
  pathname: string;
  onClose?: () => void;
}

function SidebarContent({ pathname, onClose }: SidebarContentProps) {
  const isSetupActive = pathname.startsWith('/admin/studio-setup') || pathname.startsWith('/admin/tasks');
  // Only one flyout open at a time — keyed by label string
  const [openKey, setOpenKey] = useState<string | null>(null);
  const { unreadCount } = useInboxCount();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pb: 3 }}>

      {/* Wordmark */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, flexShrink: 0 }}>
        <Typography
          component={NextLink}
          href="/admin"
          variant="h6"
          onClick={onClose}
          sx={{ fontWeight: 700, letterSpacing: '-0.02em', color: 'text.primary', textDecoration: 'none', display: 'block' }}
        >
          Throw{' '}
          <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: '0.875rem' }}>Admin</Box>
        </Typography>
      </Box>

      <Divider sx={{ mb: 1 }} />

      {/* Scrollable main nav */}
      <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {MAIN_NAV.map((section) => (
          <Box key={section.label}>
            <List
              dense
              subheader={
                <ListSubheader sx={{ lineHeight: '28px', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', color: 'text.disabled', bgcolor: 'transparent', px: 2.5, mt: 1 }}>
                  {section.label}
                </ListSubheader>
              }
            >
              {section.items.map((item) =>
                item.kind === 'flyout' ? (
                  <FlyoutNavItem
                    key={item.label}
                    label={item.label}
                    icon={item.icon}
                    isActive={item.isActive(pathname)}
                    groups={item.groups}
                    flyoutTitle={item.flyoutTitle}
                    pathname={pathname}
                    open={openKey === item.label}
                    onOpen={() => setOpenKey(item.label)}
                    onClose={() => setOpenKey((k) => k === item.label ? null : k)}
                    onNavClick={onClose}
                  />
                ) : (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    onClick={onClose}
                    badgeContent={item.badgeKey === 'inbox' ? unreadCount : undefined}
                  />
                )
              )}
            </List>
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 1, mx: 2 }} />

      {/* Point of Sale — persistent top-level link, above Studio Set-up */}
      <List dense sx={{ flexShrink: 0, py: 0 }}>
        <NavLink
          item={{ href: '/admin/pos', label: 'Point of Sale', icon: <PointOfSaleOutlinedIcon fontSize="small" /> }}
          pathname={pathname}
          onClick={onClose}
        />
      </List>

      {/* Studio Set-up — flyout, always at bottom, never expands inline */}
      <List dense sx={{ flexShrink: 0 }}>
        <FlyoutNavItem
          label="Studio Set-up"
          icon={<TuneOutlinedIcon fontSize="small" />}
          isActive={isSetupActive}
          groups={STUDIO_SETUP_GROUPS}
          flyoutTitle="Studio Set-up"
          pathname={pathname}
          open={openKey === 'Studio Set-up'}
          onOpen={() => setOpenKey('Studio Set-up')}
          onClose={() => setOpenKey((k) => k === 'Studio Set-up' ? null : k)}
          onNavClick={onClose}
        />
      </List>

      {/* View Site */}
      <Box sx={{ flexShrink: 0, px: 2, pt: 1 }}>
        <Button
          component={NextLink}
          href="/"
          size="small"
          fullWidth
          endIcon={<OpenInNewIcon fontSize="small" />}
          sx={{ color: 'text.secondary', justifyContent: 'flex-start', borderRadius: 2, px: 1.5, fontSize: '0.8125rem' }}
        >
          View Site
        </Button>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// AdminNav
// ---------------------------------------------------------------------------

export function AdminNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawerSx = {
    width: DRAWER_WIDTH,
    flexShrink: 0,
    '& .MuiDrawer-paper': {
      width: DRAWER_WIDTH,
      boxSizing: 'border-box',
      borderRight: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.default',
    },
  };

  return (
    <>
      {/* Mobile top bar */}
      <Box
        component="header"
        sx={{
          display: { xs: 'flex', md: 'none' },
          alignItems: 'center',
          px: 2,
          height: 56,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
          position: 'sticky',
          top: 0,
          zIndex: 1200,
        }}
      >
        <Typography
          component={NextLink}
          href="/admin"
          variant="h6"
          sx={{ fontWeight: 700, letterSpacing: '-0.02em', color: 'text.primary', textDecoration: 'none', flex: 1 }}
        >
          Throw{' '}
          <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: '0.875rem' }}>Admin</Box>
        </Typography>
        <IconButton aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
          <MenuIcon />
        </IconButton>
      </Box>

      {/* Desktop permanent sidebar */}
      <Drawer variant="permanent" sx={{ ...drawerSx, display: { xs: 'none', md: 'block' } }} open>
        <Toolbar sx={{ display: 'none' }} />
        <SidebarContent pathname={pathname} />
      </Drawer>

      {/* Mobile temporary drawer */}
      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ ...drawerSx, display: { xs: 'block', md: 'none' } }}
      >
        <SidebarContent pathname={pathname} onClose={() => setMobileOpen(false)} />
      </Drawer>
    </>
  );
}
