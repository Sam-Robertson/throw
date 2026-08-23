'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { signOut } from 'next-auth/react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import type { Role } from '@prisma/client';

interface NavUser {
  name?: string | null;
  role: Role;
}
interface Props {
  user: NavUser | null;
}

const NAV_LINKS = [
  { href: '/schedule', label: 'Schedule' },
  { href: '/membership', label: 'Memberships' },
  { href: '/community', label: 'Community' },
  { href: '/about', label: 'About' },
];

const ACCOUNT_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/bookings', label: 'My Bookings' },
  { href: '/membership/manage', label: 'Manage Membership' },
  { href: '/account', label: 'Account Settings' },
];

export function PublicNav({ user }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [bannerOpen, setBannerOpen] = useState(true);
  const menuOpen = Boolean(anchorEl);

  const isStaffOrAdmin = user?.role === 'STAFF' || user?.role === 'ADMIN';

  function handleAccountOpen(e: React.MouseEvent<HTMLElement>) {
    setAnchorEl(e.currentTarget);
  }
  function handleAccountClose() {
    setAnchorEl(null);
  }
  function handleSignOut() {
    setDrawerOpen(false);
    handleAccountClose();
    void signOut({ callbackUrl: '/' });
  }

  return (
    <>
      {bannerOpen && (
        <Box
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            py: 1,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            position: 'relative',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'inherit', textAlign: 'center' }}>
            New to Throw? Book your first class today.
          </Typography>
          <IconButton
            aria-label="Dismiss banner"
            size="small"
            onClick={() => setBannerOpen(false)}
            sx={{ color: 'inherit', position: 'absolute', right: 8, p: 0.5 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
      <AppBar position="sticky" sx={{ zIndex: 40 }}>
        <Toolbar sx={{ maxWidth: 1152, width: '100%', mx: 'auto', px: { xs: 2, md: 3 } }}>
          {/* Wordmark */}
          <Typography
            component={NextLink}
            href="/"
            sx={{
              fontFamily: 'var(--font-gt-alpina), Georgia, serif',
              fontSize: '1.375rem',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              color: 'text.primary',
              textDecoration: 'none',
              mr: 4,
              flexShrink: 0,
            }}
          >
            Throw
          </Typography>

          {/* Center links — desktop */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, flex: 1 }}>
            {NAV_LINKS.map((l) => (
              <Button
                key={l.href}
                component={NextLink}
                href={l.href}
                size="small"
                sx={{
                  color: 'text.secondary',
                  '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
                  borderRadius: 2,
                  px: 1.5,
                }}
              >
                {l.label}
              </Button>
            ))}
          </Box>

          {/* Right actions — desktop */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, alignItems: 'center' }}>
            {user ? (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<KeyboardArrowDownIcon />}
                  onClick={handleAccountOpen}
                  sx={{ borderRadius: 100 }}
                >
                  My Account
                </Button>
                <Menu
                  anchorEl={anchorEl}
                  open={menuOpen}
                  onClose={handleAccountClose}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  slotProps={{ paper: { sx: { mt: 1, minWidth: 192, borderRadius: 3 } } }}
                >
                  {ACCOUNT_LINKS.map((l) => (
                    <MenuItem
                      key={l.href}
                      component={NextLink}
                      href={l.href}
                      onClick={handleAccountClose}
                      sx={{ fontSize: '0.875rem' }}
                    >
                      {l.label}
                    </MenuItem>
                  ))}
                  {isStaffOrAdmin && [
                    <Divider key="div" />,
                    <MenuItem
                      key="admin"
                      component={NextLink}
                      href="/admin"
                      onClick={handleAccountClose}
                      sx={{ fontSize: '0.875rem' }}
                    >
                      Admin Panel
                    </MenuItem>,
                  ]}
                  <Divider />
                  <MenuItem
                    onClick={handleSignOut}
                    sx={{ fontSize: '0.875rem', color: 'error.main' }}
                  >
                    Sign Out
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <>
                <Button
                  size="small"
                  component={NextLink}
                  href="/login"
                  sx={{ color: 'text.secondary', borderRadius: 100 }}
                >
                  Sign In
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  component={NextLink}
                  href="/membership"
                >
                  Join
                </Button>
              </>
            )}
          </Box>

          {/* Hamburger — mobile */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, ml: 'auto' }}>
            <IconButton
              aria-label="Open navigation menu"
              onClick={() => setDrawerOpen(true)}
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
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: 280 } } }}
      >
        <Box sx={{ pt: 2, pb: 3 }}>
          <List dense>
            {NAV_LINKS.map((l) => (
              <ListItemButton
                key={l.href}
                component={NextLink}
                href={l.href}
                onClick={() => setDrawerOpen(false)}
                sx={{ borderRadius: 2, mx: 1 }}
              >
                <ListItemText primary={l.label} slotProps={{ primary: { sx: { fontWeight: 500 } } }} />
              </ListItemButton>
            ))}
          </List>

          <Divider sx={{ my: 1 }} />

          {user ? (
            <List dense>
              {ACCOUNT_LINKS.map((l) => (
                <ListItemButton
                  key={l.href}
                  component={NextLink}
                  href={l.href}
                  onClick={() => setDrawerOpen(false)}
                  sx={{ borderRadius: 2, mx: 1 }}
                >
                  <ListItemText primary={l.label} slotProps={{ primary: { sx: { fontWeight: 500 } } }} />
                </ListItemButton>
              ))}
              {isStaffOrAdmin && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <ListItemButton
                    component={NextLink}
                    href="/admin"
                    onClick={() => setDrawerOpen(false)}
                    sx={{ borderRadius: 2, mx: 1 }}
                  >
                    <ListItemText primary="Admin Panel" slotProps={{ primary: { sx: { fontWeight: 500 } } }} />
                  </ListItemButton>
                </>
              )}
              <Divider sx={{ my: 1 }} />
              <ListItemButton
                onClick={handleSignOut}
                sx={{ borderRadius: 2, mx: 1, color: 'error.main' }}
              >
                <ListItemText primary="Sign Out" slotProps={{ primary: { sx: { color: 'error.main', fontWeight: 500 } } }} />
              </ListItemButton>
            </List>
          ) : (
            <List dense>
              <ListItemButton
                component={NextLink}
                href="/login"
                onClick={() => setDrawerOpen(false)}
                sx={{ borderRadius: 2, mx: 1 }}
              >
                <ListItemText primary="Sign In" slotProps={{ primary: { sx: { fontWeight: 500 } } }} />
              </ListItemButton>
              <Box sx={{ px: 2, pt: 1 }}>
                <Button
                  component={NextLink}
                  href="/membership"
                  variant="contained"
                  fullWidth
                  onClick={() => setDrawerOpen(false)}
                >
                  Join
                </Button>
              </Box>
            </List>
          )}
        </Box>
      </Drawer>
    </>
  );
}
