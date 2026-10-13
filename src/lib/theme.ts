import { createTheme } from '@mui/material/styles';

// ─── MUI theme for the admin, staff and customer surfaces ───────────────────
//
// Since 2026-10-13 this is the marketing site's design system (globals.css
// `@theme`: sage, sage stroke, sage fill, creme, terracotta, rust, the 70% /
// 30% greys, GT Alpina headings and Satoshi body), so the back office reads
// as the same product as the front of house. The token names below are the
// Material 3 roles the admin pages already use through `md3` (primary,
// primaryContainer, surfaceVariant, inverseSurface…); only the values changed.

const md3 = {
  // ── Primary — Sage ───────────────────────────────────────────────────────
  primary: '#758C69', // Primary
  onPrimary: '#FFFFFF',
  primaryContainer: '#F1F5EE', // Primary Fill
  onPrimaryContainer: '#2C3529',

  // ── Secondary — Terracotta ───────────────────────────────────────────────
  secondary: '#C28043',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#F6E7D8',
  onSecondaryContainer: '#4A2F14',

  // ── Tertiary — Rust ──────────────────────────────────────────────────────
  tertiary: '#D56032',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FBE3DA',
  onTertiaryContainer: '#5A2210',

  // ── Error ────────────────────────────────────────────────────────────────────
  error: '#D56032', // the site has no separate error red; rust does that job
  onError: '#FFFFFF',
  errorContainer: '#FBE3DA',
  onErrorContainer: '#5A2210',

  // ── Neutral surfaces — creme page, white cards ───────────────────────────
  background: '#F5F0EC', // Creme Background
  onBackground: '#000000', // Headlines
  surface: '#FFFFFF',
  onSurface: '#4D4D4D', // Body — 70% black
  surfaceVariant: '#F5F0EC', // Creme
  onSurfaceVariant: '#4D4D4D',
  surfaceContainerHigh: '#EFE8E2',
  surfaceContainerHighest: '#E9E1D9',

  // ── Utility ──────────────────────────────────────────────────────────────────
  outline: '#B8C6B1', // Primary Stroke
  outlineVariant: '#E5E5E5', // Fill — hairlines and disabled surfaces
  inverseSurface: '#758C69', // the sage footer
  inverseOnSurface: '#FFFFFF',
  inversePrimary: '#B8C6B1',

  // ── Text tones ──────────────────────────────────────────────────────────────
  textDetails: '#B2B2B2', // Details — 30% black
};

const SERIF = 'var(--font-gt-alpina), Georgia, "Times New Roman", serif';
const SANS = 'var(--font-satoshi), system-ui, -apple-system, sans-serif';

const theme = createTheme({
  // ─── Colour palette ────────────────────────────────────────────────────────
  palette: {
    primary: {
      main: md3.primary,
      light: md3.primaryContainer,
      dark: '#5F7355',
      contrastText: md3.onPrimary,
    },
    secondary: {
      main: md3.secondary,
      light: md3.secondaryContainer,
      contrastText: md3.onSecondary,
    },
    error: {
      main: md3.error,
      light: md3.errorContainer,
      contrastText: md3.onError,
    },
    warning: {
      main: md3.secondary,
      light: md3.secondaryContainer,
      contrastText: md3.onSecondary,
    },
    success: {
      main: md3.primary,
      light: md3.primaryContainer,
      contrastText: md3.onPrimary,
    },
    info: {
      main: '#5F7355',
      light: md3.primaryContainer,
      contrastText: '#FFFFFF',
    },
    background: {
      // White at the body so the marketing pages keep their own white/creme
      // rhythm; the admin shell paints its own creme page (src/app/admin/layout.tsx).
      default: '#FFFFFF',
      paper: md3.surface, // white cards
    },
    text: {
      primary: '#000000', // Headlines
      secondary: md3.onSurface, // Body
      disabled: md3.textDetails, // Details
    },
    divider: md3.outlineVariant,
    action: {
      hoverOpacity: 0.06,
      focusOpacity: 0.1,
      activatedOpacity: 0.1,
      selectedOpacity: 0.08,
    },
  },

  // ─── Shape ─────────────────────────────────────────────────────────────────
  shape: { borderRadius: 16 },

  // ─── Typography ────────────────────────────────────────────────────────────
  // GT Alpina (one Regular cut) for page and section headings, Satoshi for
  // everything else — the marketing site's eight text styles, with body sizes
  // held at 16/14px so dense admin tables stay dense.
  typography: {
    fontFamily: SANS,
    h1: {
      fontFamily: SERIF,
      fontSize: 'clamp(2.5rem, 6vw, 4rem)',
      fontWeight: 400,
      lineHeight: 1.05,
      letterSpacing: '-0.01em',
    },
    h2: {
      fontFamily: SERIF,
      fontSize: 'clamp(1.875rem, 3.5vw, 2.5rem)', // Header XL — 40px
      fontWeight: 400,
      lineHeight: 1.15,
    },
    h3: {
      fontFamily: SERIF,
      fontSize: '1.75rem', // Header Large — 32px-ish
      fontWeight: 400,
      lineHeight: 1.25,
    },
    h4: {
      fontFamily: SERIF,
      fontSize: '1.5rem',
      fontWeight: 400,
      lineHeight: 1.3,
    },
    h5: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.35 }, // Body large bold
    h6: { fontSize: '1rem', fontWeight: 700, lineHeight: 1.5 }, // Body small bold
    subtitle1: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.5 },
    subtitle2: { fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.57 },
    body1: { fontSize: '1rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.57 },
    button: { fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.75, textTransform: 'none' },
    caption: { fontSize: '0.75rem', lineHeight: 1.43 },
    overline: {
      fontSize: '0.6875rem',
      fontWeight: 700,
      lineHeight: 2.4,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
    },
  },

  // ─── Component overrides ───────────────────────────────────────────────────
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Same font smoothing as the marketing site (globals.css .site-text),
        // so Satoshi renders at the same weight everywhere.
        body: { WebkitFontSmoothing: 'auto', MozOsxFontSmoothing: 'auto' },
      },
    },

    // ── Buttons: full pills, as the design system's Buttons block ───────────
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 100, textTransform: 'none', fontWeight: 700 },
        sizeSmall: {
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 5,
          paddingBottom: 5,
          fontSize: '0.8125rem',
        },
        sizeMedium: { paddingLeft: 24, paddingRight: 24, paddingTop: 8, paddingBottom: 8 },
        sizeLarge: {
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 12,
          paddingBottom: 12,
          fontSize: '1rem',
        },
        outlined: {
          borderColor: md3.outline,
          color: '#000000',
          backgroundColor: '#FFFFFF',
          '&:hover': { borderColor: md3.outline, backgroundColor: md3.primaryContainer },
        },
        text: { color: '#000000', '&:hover': { backgroundColor: md3.primaryContainer } },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 100 } },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 100,
          textTransform: 'none',
          fontWeight: 700,
          borderColor: md3.outline,
          '&.Mui-selected': {
            backgroundColor: md3.primary,
            color: '#FFFFFF',
            '&:hover': { backgroundColor: '#5F7355' },
          },
        },
      },
    },

    // ── Cards: white, sage hairline, the site's big corners ─────────────────
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 20,
          border: `1px solid ${md3.outline}`,
          backgroundColor: '#FFFFFF',
          overflow: 'hidden',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: 20, '&:last-child': { paddingBottom: 20 } },
      },
    },
    MuiCardActions: {
      styleOverrides: { root: { padding: '12px 20px 20px' } },
    },
    MuiCardHeader: {
      styleOverrides: { root: { padding: '20px 20px 12px' } },
    },

    // ── Paper ─────────────────────────────────────────────────────────────────
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none' },
        rounded: { borderRadius: 20 },
        outlined: { borderColor: md3.outline },
      },
    },

    // ── Chips: pills ──────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 100, fontWeight: 700, fontSize: '0.75rem', height: 26 },
        sizeSmall: { height: 22, fontSize: '0.6875rem' },
        outlined: { borderColor: md3.outline },
        colorDefault: { backgroundColor: md3.surfaceVariant, color: md3.onSurface },
      },
    },

    // ── Text fields: the account design's rounded sage-stroke box ───────────
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small', fullWidth: true },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: '#FFFFFF',
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: md3.primary },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: md3.primary,
            borderWidth: 1.5,
          },
        },
        notchedOutline: { borderColor: md3.outline },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: '0.875rem', color: md3.onSurface } },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { marginLeft: 4 } },
    },

    // ── Select ────────────────────────────────────────────────────────────────
    MuiSelect: {
      defaultProps: { size: 'small' },
      styleOverrides: { root: { borderRadius: 14 } },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          border: `1px solid ${md3.outlineVariant}`,
          boxShadow: '0 8px 30px rgba(0,0,0,0.10)',
        },
      },
    },

    // ── Dialogs: the account design's sheet ─────────────────────────────────
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 32, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: SERIF,
          fontSize: '1.75rem',
          fontWeight: 400,
          lineHeight: 1.2,
          padding: '28px 28px 12px',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: { root: { padding: '12px 28px' } },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '12px 28px 28px', gap: 8 } },
    },

    // ── Drawers ───────────────────────────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: { paper: { borderRadius: 0, border: 'none' } },
    },

    // ── AppBar ────────────────────────────────────────────────────────────────
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${md3.outlineVariant}`,
          backgroundColor: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: { minHeight: 56, '@media (min-width: 600px)': { minHeight: 64 } },
      },
    },

    // ── Tables ────────────────────────────────────────────────────────────────
    MuiTableContainer: {
      styleOverrides: { root: { borderRadius: 20 } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 700,
            fontSize: '0.75rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#000000',
            backgroundColor: md3.surfaceVariant,
            borderBottom: `1px solid ${md3.outlineVariant}`,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { fontSize: '0.875rem', borderColor: md3.outlineVariant, padding: '10px 16px' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: md3.primaryContainer },
          '&:last-of-type .MuiTableCell-body': { borderBottom: 'none' },
        },
      },
    },

    // ── Misc ──────────────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: { root: { borderColor: md3.outlineVariant } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          fontSize: '0.75rem',
          backgroundColor: '#000000',
          color: '#FFFFFF',
        },
        arrow: { color: '#000000' },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 16 },
        standard: {
          '&.MuiAlert-colorSuccess, &.MuiAlert-colorInfo': {
            backgroundColor: md3.primaryContainer,
            color: '#2C3529',
          },
          '&.MuiAlert-colorWarning': {
            backgroundColor: md3.secondaryContainer,
            color: md3.onSecondaryContainer,
          },
          '&.MuiAlert-colorError': {
            backgroundColor: md3.errorContainer,
            color: md3.onErrorContainer,
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 4, backgroundColor: md3.outlineVariant } },
    },
    MuiTabs: {
      styleOverrides: { indicator: { backgroundColor: md3.primary, height: 2 } },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700,
          fontSize: '0.875rem',
          color: md3.onSurface,
          '&.Mui-selected': { color: '#000000' },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        track: { borderRadius: 10 },
        thumb: { borderRadius: 10 },
      },
    },
    MuiSkeleton: {
      styleOverrides: { root: { backgroundColor: md3.surfaceContainerHigh } },
    },
  },
});

export default theme;
export { md3 };
