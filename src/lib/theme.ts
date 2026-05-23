'use client';
import { createTheme } from '@mui/material/styles';

// ─── Material 3 colour tokens for Throw pottery studio ───────────────────────
// Built from a warm terracotta primary with sage secondary on a cream surface.
const md3 = {
  // Primary – deep clay terracotta
  primary: '#7B4F31',
  onPrimary: '#FFFFFF',
  primaryContainer: '#FFDCC4',
  onPrimaryContainer: '#2E1200',

  // Secondary – sage green
  secondary: '#56785A',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#D9F0DA',
  onSecondaryContainer: '#122015',

  // Tertiary – warm sand
  tertiary: '#9E7C40',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FAEBBE',
  onTertiaryContainer: '#321F00',

  // Error
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',

  // Neutral surfaces
  background: '#FFFBF8',
  onBackground: '#201A17',
  surface: '#FFFBF8',
  onSurface: '#201A17',
  surfaceVariant: '#F4E4D7',
  onSurfaceVariant: '#52433A',
  surfaceContainerHigh: '#EDE0D9',
  surfaceContainerHighest: '#E8D8CF',

  // Utility
  outline: '#857469',
  outlineVariant: '#D8C4B7',
  inverseSurface: '#362E2B',
  inverseOnSurface: '#FBEEE8',
  inversePrimary: '#FFBA8F',
};

const theme = createTheme({
  // ─── Colour palette ────────────────────────────────────────────────────────
  palette: {
    primary: {
      main: md3.primary,
      light: md3.primaryContainer,
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
    background: {
      default: md3.background,
      paper: '#FFFFFF',
    },
    text: {
      primary: md3.onSurface,
      secondary: md3.onSurfaceVariant,
      disabled: `${md3.onSurface}61`,
    },
    divider: md3.outlineVariant,
    // Custom tokens exposed via palette for easy sx usage
    action: {
      hoverOpacity: 0.08,
      focusOpacity: 0.12,
      activatedOpacity: 0.12,
      selectedOpacity: 0.08,
    },
  },

  // ─── Shape (M3 shape scale) ─────────────────────────────────────────────────
  shape: {
    borderRadius: 12, // medium = default
  },

  // ─── Typography (Geist + M3 type scale) ────────────────────────────────────
  typography: {
    fontFamily: 'var(--font-geist-sans), system-ui, -apple-system, sans-serif',
    // Display – hero headlines
    h1: {
      fontSize: 'clamp(2rem, 5vw, 3.5625rem)',
      fontWeight: 700,
      lineHeight: 1.12,
      letterSpacing: '-0.025em',
    },
    // Headline large
    h2: {
      fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.015em',
    },
    // Headline medium
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    // Headline small
    h4: {
      fontSize: '1.375rem',
      fontWeight: 600,
      lineHeight: 1.35,
      letterSpacing: '-0.005em',
    },
    // Title large
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    // Title medium
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.5,
      letterSpacing: '0.005em',
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.5,
      letterSpacing: '0.00938em',
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: 1.57,
      letterSpacing: '0.00714em',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      letterSpacing: '0.00938em',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.57,
      letterSpacing: '0.01071em',
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: 1.75,
      letterSpacing: '0.01em',
      textTransform: 'none',
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.43,
      letterSpacing: '0.03333em',
    },
    overline: {
      fontSize: '0.625rem',
      fontWeight: 700,
      lineHeight: 2.66,
      letterSpacing: '0.08333em',
      textTransform: 'uppercase',
    },
  },

  // ─── Component overrides ────────────────────────────────────────────────────
  components: {
    // ── Buttons ──────────────────────────────────────────────────────────────
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 100, // M3 full pill
          textTransform: 'none',
          fontWeight: 600,
        },
        sizeSmall: {
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 5,
          paddingBottom: 5,
          fontSize: '0.8125rem',
        },
        sizeMedium: {
          paddingLeft: 24,
          paddingRight: 24,
          paddingTop: 8,
          paddingBottom: 8,
        },
        sizeLarge: {
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 12,
          paddingBottom: 12,
          fontSize: '1rem',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },

    // ── Cards ─────────────────────────────────────────────────────────────────
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: `1px solid ${md3.outlineVariant}`,
          backgroundColor: '#FFFFFF',
          overflow: 'hidden',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 20,
          '&:last-child': { paddingBottom: 20 },
        },
      },
    },
    MuiCardActions: {
      styleOverrides: {
        root: {
          padding: '12px 20px 20px',
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: { padding: '20px 20px 12px' },
      },
    },

    // ── Paper ─────────────────────────────────────────────────────────────────
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        outlined: {
          borderColor: md3.outlineVariant,
        },
      },
    },

    // ── Chips ─────────────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          fontSize: '0.75rem',
          height: 26,
        },
        sizeSmall: {
          height: 22,
          fontSize: '0.6875rem',
        },
      },
    },

    // ── Text fields ───────────────────────────────────────────────────────────
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
        fullWidth: true,
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: '#FFFFFF',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8 },
        notchedOutline: { borderColor: md3.outlineVariant },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: '0.875rem' },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { marginLeft: 4 },
      },
    },

    // ── Select ────────────────────────────────────────────────────────────────
    MuiSelect: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },

    // ── Dialogs ───────────────────────────────────────────────────────────────
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 28, // M3 extraLarge
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.375rem',
          fontWeight: 600,
          padding: '24px 24px 12px',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { padding: '12px 24px' },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '12px 24px 24px',
          gap: 8,
        },
      },
    },

    // ── Drawers ───────────────────────────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          border: 'none',
        },
      },
    },

    // ── AppBar ────────────────────────────────────────────────────────────────
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${md3.outlineVariant}`,
          backgroundColor: 'rgba(255,251,248,0.95)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: 56,
          '@media (min-width: 600px)': { minHeight: 64 },
        },
      },
    },

    // ── Tables ────────────────────────────────────────────────────────────────
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.8125rem',
            backgroundColor: md3.surfaceVariant,
            borderBottom: `2px solid ${md3.outlineVariant}`,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          borderColor: md3.outlineVariant,
          padding: '10px 16px',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: `${md3.surfaceVariant}50` },
          '&:last-of-type .MuiTableCell-body': { borderBottom: 'none' },
        },
      },
    },

    // ── Misc ──────────────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: md3.outlineVariant },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          fontSize: '0.75rem',
          backgroundColor: md3.inverseSurface,
          color: md3.inverseOnSurface,
        },
        arrow: { color: md3.inverseSurface },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.875rem',
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
  },
});

export default theme;
export { md3 };
