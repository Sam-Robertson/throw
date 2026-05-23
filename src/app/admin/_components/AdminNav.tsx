'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import { md3 } from '@/lib/theme';

const NAV = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/class-types', label: 'Class Types' },
  { href: '/admin/schedule', label: 'Schedule' },
  { href: '/admin/membership-plans', label: 'Membership Plans' },
  { href: '/admin/memberships', label: 'Memberships' },
  { href: '/admin/waivers', label: 'Waivers' },
  { href: '/admin/automations', label: 'Automations' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/tasks', label: 'Tasks' },
  { href: '/admin/community', label: 'Community' },
  { href: '/admin/landing-pages', label: 'Landing Pages' },
  { href: '/admin/reports', label: 'Reports' },
];

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AppBar position="sticky" sx={{ zIndex: 40 }}>
        <Toolbar sx={{ px: { xs: 2, md: 3 }, gap: 1 }}>
          {/* Wordmark */}
          <Typography
            component={NextLink}
            href="/admin"
            variant="h6"
            sx={{
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'text.primary',
              textDecoration: 'none',
              flexShrink: 0,
              mr: 2,
            }}
          >
            Throw{' '}
            <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>
              — Admin
            </Box>
          </Typography>

          {/* Nav links — desktop, scrollable */}
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              flex: 1,
              gap: 0.25,
              overflowX: 'auto',
              '&::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
            }}
          >
            {NAV.map(({ href, label, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Button
                  key={href}
                  component={NextLink}
                  href={href}
                  size="small"
                  sx={{
                    flexShrink: 0,
                    borderRadius: 2,
                    px: 1.5,
                    fontWeight: active ? 600 : 400,
                    color: active ? 'text.primary' : 'text.secondary',
                    bgcolor: active ? md3.surfaceContainerHigh : 'transparent',
                    '&:hover': { bgcolor: md3.surfaceContainerHigh, color: 'text.primary' },
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </Box>

          {/* View Site link — desktop */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, flexShrink: 0 }}>
            <Button
              component={NextLink}
              href="/"
              size="small"
              sx={{ color: 'text.secondary', borderRadius: 100 }}
            >
              View Site
            </Button>
          </Box>

          {/* Hamburger — mobile */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, ml: 'auto' }}>
            <IconButton
              aria-label="Open admin navigation"
              onClick={() => setOpen(true)}
              sx={{ color: 'text.primary' }}
            >
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { width: 280 } } }}
      >
        <Box sx={{ pt: 2, pb: 3 }}>
          <List dense>
            {NAV.map(({ href, label, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <ListItemButton
                  key={href}
                  component={NextLink}
                  href={href}
                  onClick={() => setOpen(false)}
                  selected={active}
                  sx={{
                    borderRadius: 2,
                    mx: 1,
                    '&.Mui-selected': {
                      bgcolor: md3.surfaceContainerHigh,
                    },
                  }}
                >
                  <ListItemText
                    primary={label}
                    slotProps={{ primary: { sx: { fontWeight: active ? 600 : 400, fontSize: '0.875rem' } } }}
                  />
                </ListItemButton>
              );
            })}
          </List>
          <Divider sx={{ my: 1 }} />
          <List dense>
            <ListItemButton
              component={NextLink}
              href="/"
              onClick={() => setOpen(false)}
              sx={{ borderRadius: 2, mx: 1 }}
            >
              <ListItemText
                primary="View Site"
                slotProps={{ primary: { sx: { color: 'text.secondary', fontSize: '0.875rem' } } }}
              />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>
    </>
  );
}
