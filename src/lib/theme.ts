import { createTheme } from '@mui/material/styles';

// ─── Material 3 colour tokens — Throw pottery studio (Sage + Creme palette) ──
//
// Source: "Design system.png" reference doc. Only 9 swatches were specified
// there (Background, Creme Background, Headlines, Body, Details, Primary,
// Primary Stroke, Secondary, Tertiary) — containers, inverse surfaces, and
// error colors are derived to stay close to those anchors since the doc
// doesn't define them explicitly.

const md3 = {
  // ── Primary — Sage ───────────────────────────────────────────────────────
  primary:            '#8B9D82',
  onPrimary:          '#FFFFFF',
  primaryContainer:   '#E5EBE1',   // light sage tint
  onPrimaryContainer: '#2C3529',

  // ── Secondary — Terracotta ───────────────────────────────────────────────
  secondary:            '#C28043',
  onSecondary:          '#FFFFFF',
  secondaryContainer:   '#F3E4D3',   // light terracotta tint
  onSecondaryContainer: '#4A2F14',

  // ── Tertiary — Rust ──────────────────────────────────────────────────────
  tertiary:            '#D56032',
  onTertiary:          '#FFFFFF',
  tertiaryContainer:   '#FBE1D6',   // light rust tint
  onTertiaryContainer: '#5A2210',

  // ── Error ────────────────────────────────────────────────────────────────────
  error:            '#B3261E',
  onError:          '#FFFFFF',
  errorContainer:   '#F9DEDC',
  onErrorContainer: '#410E0B',

  // ── Neutral surfaces — white + creme family ──────────────────────────────
  background:              '#FFFFFF',
  onBackground:            '#000000',   // Headlines
  surface:                 '#FFFFFF',
  onSurface:               'rgba(0,0,0,0.7)',    // Body
  surfaceVariant:          '#FFF8F2',   // Creme Background
  onSurfaceVariant:        'rgba(0,0,0,0.6)',
  surfaceContainerHigh:    '#F5EEE3',
  surfaceContainerHighest: '#F0E7D8',

  // ── Utility ──────────────────────────────────────────────────────────────────
  outline:          '#B8C6B1',   // Primary Stroke
  outlineVariant:   '#E3E0D8',
  inverseSurface:   '#3E4E38',   // dark sage, derived from Primary
  inverseOnSurface: '#FFFFFF',
  inversePrimary:   '#C7D4C0',   // light sage

  // ── Text tones (design system's "Body 70%" / "Details 30%" on black) ────
  textDetails: 'rgba(0,0,0,0.3)',
};

const theme = createTheme({
  // ─── Colour palette ────────────────────────────────────────────────────────
  palette: {
    primary: {
      main:         md3.primary,
      light:        md3.primaryContainer,
      contrastText: md3.onPrimary,
    },
    secondary: {
      main:         md3.secondary,
      light:        md3.secondaryContainer,
      contrastText: md3.onSecondary,
    },
    error: {
      main:         md3.error,
      light:        md3.errorContainer,
      contrastText: md3.onError,
    },
    background: {
      default: md3.background,   // white page background
      paper:   '#FFFFFF',
    },
    text: {
      primary:   md3.onSurface,          // Body — black at 70%
      secondary: 'rgba(0,0,0,0.6)',      // medium-emphasis — the doc's literal "Details 30%"
                                          // (md3.textDetails) is too low-contrast (~2.4:1) for the
                                          // 250+ existing text.secondary call sites (nav links, form
                                          // hints, list metadata), most of which need to stay legible
                                          // rather than read as decorative captions.
      disabled:  'rgba(0,0,0,0.38)',
    },
    divider: md3.outlineVariant,
    action: {
      hoverOpacity:     0.08,
      focusOpacity:     0.12,
      activatedOpacity: 0.12,
      selectedOpacity:  0.08,
    },
  },

  // ─── Shape ─────────────────────────────────────────────────────────────────
  shape: { borderRadius: 12 },

  // ─── Typography ────────────────────────────────────────────────────────────
  // Two-font system per the design system doc: GT Alpina (serif) for display
  // headlines, Satoshi (sans) for everything else. Sizes for h1–h3 follow the
  // doc's Hero/Header XL/Header Large scale directly. body1/body2 keep their
  // existing sizes (16/14px) rather than jumping to the doc's Body large
  // (20px) — that size reads fine in the hero/marketing contexts it was
  // designed for, but applied as the sitewide paragraph default it would
  // visibly bloat dense admin tables and forms the mockups don't cover.
  // Marketing copy that wants the larger 20px "Body large" treatment can set
  // fontSize: '1.25rem' directly, as the home page hero subhead does.
  //
  // GT Alpina is scoped to h1 only. The design doc's "Header Large serif"
  // style (h2/h3 territory) is a deliberate second option alongside a sans
  // equivalent, not a replacement for it — and only a Regular (400) cut of
  // GT Alpina exists so far, so any variant many call sites force to
  // fontWeight 700 (h2 is, across ~30 admin page titles) would render as a
  // browser-synthesized fake bold on a serif face, which looks broken.
  // Marketing sections that want the serif "Header Large" look apply it
  // directly via sx (see the home page's section headers).
  typography: {
    fontFamily: 'var(--font-satoshi), system-ui, -apple-system, sans-serif',
    h1: {
      fontFamily: 'var(--font-gt-alpina), Georgia, serif',
      fontSize: 'clamp(2.5rem, 6vw, 4rem)', // Hero — 64px
      fontWeight: 400,
      lineHeight: 1.08,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', // Header XL — 40px
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.015em',
    },
    h3: {
      fontSize: 'clamp(1.5rem, 3vw, 1.75rem)',
      fontWeight: 700,
      lineHeight: 1.25,
    },
    h4: {
      fontSize: '1.375rem',
      fontWeight: 700,
      lineHeight: 1.3,
    },
    h5: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.35 }, // Body large bold
    h6: { fontSize: '1rem', fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.005em' }, // Body small bold
    subtitle1: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.5, letterSpacing: '0.00938em' },
    subtitle2: { fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.57, letterSpacing: '0.00714em' },
    body1: { fontSize: '1rem', lineHeight: 1.6, letterSpacing: '0.00938em' }, // Body small regular
    body2: { fontSize: '0.875rem', lineHeight: 1.57, letterSpacing: '0.01071em' },
    button: { fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.75, letterSpacing: '0.01em', textTransform: 'none' },
    caption: { fontSize: '0.75rem', lineHeight: 1.43, letterSpacing: '0.03333em' },
    overline: { fontSize: '0.625rem', fontWeight: 700, lineHeight: 2.66, letterSpacing: '0.08333em', textTransform: 'uppercase' },
  },

  // ─── Component overrides ───────────────────────────────────────────────────
  components: {
    // ── Buttons ──────────────────────────────────────────────────────────────
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 100, textTransform: 'none', fontWeight: 700 },
        sizeSmall:  { paddingLeft: 16, paddingRight: 16, paddingTop: 5, paddingBottom: 5, fontSize: '0.8125rem' },
        sizeMedium: { paddingLeft: 24, paddingRight: 24, paddingTop: 8, paddingBottom: 8 },
        sizeLarge:  { paddingLeft: 32, paddingRight: 32, paddingTop: 12, paddingBottom: 12, fontSize: '1rem' },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 12 } },
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
        outlined: { borderColor: md3.outlineVariant },
      },
    },

    // ── Chips ─────────────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 500, fontSize: '0.75rem', height: 26 },
        sizeSmall: { height: 22, fontSize: '0.6875rem' },
      },
    },

    // ── Text fields ───────────────────────────────────────────────────────────
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small', fullWidth: true },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': { borderRadius: 8, backgroundColor: '#FFFFFF' },
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
      styleOverrides: { root: { fontSize: '0.875rem' } },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { marginLeft: 4 } },
    },

    // ── Select ────────────────────────────────────────────────────────────────
    MuiSelect: {
      defaultProps: { size: 'small' },
      styleOverrides: { root: { borderRadius: 8 } },
    },

    // ── Dialogs ───────────────────────────────────────────────────────────────
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 28, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontSize: '1.375rem', fontWeight: 600, padding: '24px 24px 12px' } },
    },
    MuiDialogContent: {
      styleOverrides: { root: { padding: '12px 24px' } },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '12px 24px 24px', gap: 8 } },
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
        root: { fontSize: '0.875rem', borderColor: md3.outlineVariant, padding: '10px 16px' },
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
      styleOverrides: { root: { borderColor: md3.outlineVariant } },
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
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 4 } },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500, fontSize: '0.875rem' },
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
