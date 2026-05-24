'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

// Icons
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import CardMembershipOutlinedIcon from '@mui/icons-material/CardMembershipOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import WebOutlinedIcon from '@mui/icons-material/WebOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import SmsOutlinedIcon from '@mui/icons-material/SmsOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import CardGiftcardOutlinedIcon from '@mui/icons-material/CardGiftcardOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { md3 } from '@/lib/theme';

export const DRAWER_WIDTH = 240;

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface StudioSetupGroup {
  label: string;
  items: NavItem[];
}

const MAIN_NAV: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: <DashboardOutlinedIcon fontSize="small" />, exact: true },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/admin/schedule', label: 'Schedule', icon: <CalendarMonthOutlinedIcon fontSize="small" /> },
      { href: '/admin/class-types', label: 'Class Types', icon: <StyleOutlinedIcon fontSize="small" /> },
      { href: '/admin/customers', label: 'Customers', icon: <PeopleOutlinedIcon fontSize="small" /> },
      { href: '/admin/memberships', label: 'Memberships', icon: <CardMembershipOutlinedIcon fontSize="small" /> },
      { href: '/admin/membership-plans', label: 'Membership Plans', icon: <AssignmentOutlinedIcon fontSize="small" /> },
      { href: '/admin/waivers', label: 'Waivers', icon: <GavelOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/community', label: 'Community', icon: <ForumOutlinedIcon fontSize="small" /> },
      { href: '/admin/landing-pages', label: 'Landing Pages', icon: <WebOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    label: 'Business',
    items: [
      { href: '/admin/reports', label: 'Reports', icon: <BarChartOutlinedIcon fontSize="small" /> },
      { href: '/admin/automations', label: 'Automations', icon: <SmsOutlinedIcon fontSize="small" /> },
    ],
  },
];

const STUDIO_SETUP_GROUPS: StudioSetupGroup[] = [
  {
    label: 'STAFF',
    items: [
      { href: '/admin/studio-setup/instructors', label: 'Instructors', icon: <PersonOutlinedIcon fontSize="small" /> },
      { href: '/admin/tasks', label: 'Staff Tasks', icon: <ChecklistOutlinedIcon fontSize="small" /> },
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
      { href: '/admin/studio-setup/gift-cards', label: 'Gift Cards', icon: <CardGiftcardOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    label: 'MESSAGING',
    items: [
      { href: '/admin/studio-setup/templates', label: 'Templates', icon: <MailOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    label: 'LOCATIONS',
    items: [
      { href: '/admin/studio-setup/locations', label: 'Locations', icon: <LocationOnOutlinedIcon fontSize="small" /> },
    ],
  },
];

function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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
        {item.icon}
      </ListItemIcon>
      <ListItemText
        primary={item.label}
        slotProps={{ primary: { sx: { fontSize: '0.8125rem', fontWeight: active ? 600 : 400 } } }}
      />
    </ListItemButton>
  );
}

interface SidebarContentProps {
  pathname: string;
  onClose?: () => void;
}

function SidebarContent({ pathname, onClose }: SidebarContentProps) {
  const isSetupActive = pathname.startsWith('/admin/studio-setup');
  const [setupOpen, setSetupOpen] = useState(isSetupActive);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', pb: 3 }}>
      {/* Wordmark */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, flexShrink: 0 }}>
        <Typography
          component={NextLink}
          href="/admin"
          variant="h6"
          onClick={onClose}
          sx={{
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'text.primary',
            textDecoration: 'none',
            display: 'block',
          }}
        >
          Throw{' '}
          <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: '0.875rem' }}>
            Admin
          </Box>
        </Typography>
      </Box>

      <Divider sx={{ mb: 1 }} />

      {/* Main nav sections */}
      {MAIN_NAV.map((section) => (
        <Box key={section.label}>
          <List
            dense
            subheader={
              <ListSubheader
                sx={{
                  lineHeight: '28px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'text.disabled',
                  bgcolor: 'transparent',
                  px: 2.5,
                  mt: 1,
                }}
              >
                {section.label}
              </ListSubheader>
            }
          >
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onClick={onClose} />
            ))}
          </List>
        </Box>
      ))}

      <Divider sx={{ my: 1, mx: 2 }} />

      {/* Studio Set-up accordion */}
      <List dense>
        <ListItemButton
          onClick={() => setSetupOpen((v) => !v)}
          sx={{
            borderRadius: 2,
            mx: 1,
            mb: 0.25,
            py: 0.75,
            minHeight: 36,
            bgcolor: isSetupActive ? md3.primaryContainer : 'transparent',
            '&:hover': { bgcolor: isSetupActive ? md3.primaryContainer : md3.surfaceVariant },
          }}
        >
          <ListItemIcon sx={{ minWidth: 32, color: isSetupActive ? md3.primary : 'text.secondary' }}>
            <TuneOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Studio Set-up"
            slotProps={{
              primary: {
                sx: { fontSize: '0.8125rem', fontWeight: isSetupActive ? 600 : 400, color: isSetupActive ? md3.primary : 'inherit' },
              },
            }}
          />
          {setupOpen ? <ExpandLessIcon fontSize="small" sx={{ color: 'text.secondary' }} /> : <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
        </ListItemButton>

        <Collapse in={setupOpen} timeout="auto" unmountOnExit>
          {STUDIO_SETUP_GROUPS.map((group) => (
            <Box key={group.label}>
              <Typography
                sx={{
                  px: 3.5,
                  pt: 1,
                  pb: 0.25,
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'text.disabled',
                }}
              >
                {group.label}
              </Typography>
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onClick={onClose} />
              ))}
            </Box>
          ))}
        </Collapse>
      </List>

      {/* Spacer + View Site */}
      <Box sx={{ mt: 'auto', px: 2, pt: 2 }}>
        <Button
          component={NextLink}
          href="/"
          size="small"
          fullWidth
          endIcon={<OpenInNewIcon fontSize="small" />}
          sx={{
            color: 'text.secondary',
            justifyContent: 'flex-start',
            borderRadius: 2,
            px: 1.5,
            fontSize: '0.8125rem',
          }}
        >
          View Site
        </Button>
      </Box>
    </Box>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawerSx = {
    width: DRAWER_WIDTH,
    flexShrink: 0,
    '& .MuiDrawer-paper': {
      width: DRAWER_WIDTH,
      boxSizing: 'border-box',
      borderRight: `1px solid`,
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
          <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: '0.875rem' }}>
            Admin
          </Box>
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
