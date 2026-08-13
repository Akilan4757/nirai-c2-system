// NIRAI Command & Control Theme Tokens
// High-contrast dark theme inspired by tactical command screens.

export const theme = {
  colors: {
    background: {
      base: '#020617',     // Slate 950 - tactical deep background
      surface: '#0f172a',  // Slate 900 - card/panel surface
      elevated: '#1e293b', // Slate 800 - popover/elevated surface
      active: '#0f172a',
    },
    border: {
      subtle: '#1e293b',   // Slate 800 - panel separators
      normal: '#334155',   // Slate 700 - element outlines
      focus: '#06b6d4',    // Cyan 500 - interactive active borders
    },
    text: {
      primary: '#f8fafc',   // Slate 50 - high contrast body/titles
      secondary: '#94a3b8', // Slate 400 - secondary labels
      muted: '#64748b',     // Slate 500 - disabled/subtle text
      bright: '#ffffff',
    },
    status: {
      critical: '#ef4444',  // Red 500 - zone red / alert critical
      warning: '#f59e0b',   // Amber 500 - zone yellow / alert high / offline
      nominal: '#10b981',   // Emerald 500 - zone green / alert low
      info: '#3b82f6',      // Blue 500 - police/normal status
    },
    telemetry: {
      aiAccent: '#d946ef',  // Fuchsia 500 - AI-derived telemetry highlights
      droneCyan: '#06b6d4', // Cyan 500 - drones / active map tools
      motherPurple: '#a855f7', // Purple 500 - Mother Drones
    },
  },
  typography: {
    fontSans: 'Inter, system-ui, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  transitions: {
    duration: '200ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  radii: {
    sm: '0.25rem',   // 4px
    md: '0.375rem',  // 6px
    lg: '0.5rem',    // 8px
    xl: '0.75rem',   // 12px
    xxl: '1rem',     // 16px
    full: '9999px',
  },
};
