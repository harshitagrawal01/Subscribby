import {
  Badge,
  Button,
  Card,
  createTheme,
  Menu,
  Modal,
  Paper,
  PasswordInput,
  Select,
  Table,
  Tabs,
  TextInput,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core'

/** Ledger ink: the one brand hue. Shade 8 is the primary. */
const ink: MantineColorsTuple = [
  '#eef2f7', '#d9e1ec', '#b3c3d8', '#8aa3c3', '#6786b0', '#4f71a3', '#3d5f91', '#2f4d79', '#223a5e', '#162741',
]

/** Warm paper greys derived from the page colour, replacing Mantine's cool greys. */
const gray: MantineColorsTuple = [
  '#f7f5f1', '#f0ede7', '#e4e0d8', '#d4cfc5', '#b5b0a6', '#8f8a80', '#6b675f', '#4f4c46', '#35332f', '#1c1b19',
]

export const tokens = {
  page: '#F7F5F1',
  surface: '#FFFFFF',
  line: '#E4E0D8',
  text: '#1C1B19',
  muted: '#6B675F',
  faint: '#8F8A80',
  ink: '#223A5E',
  status: {
    good: '#2F7A4F',
    bad: '#B42318',
    warn: '#A15C00',
    info: '#3D5F91',
    paused: '#8A6A1F',
    draft: '#8F8A80',
    closed: '#4F4C46',
  },
} as const

export const theme = createTheme({
  colors: { ink, gray },
  primaryColor: 'ink',
  primaryShade: 8,
  black: tokens.text,
  fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
  fontFamilyMonospace: '"IBM Plex Mono", ui-monospace, monospace',
  headings: {
    // Soft serif for titles, plain sans for everything else.
    fontFamily: '"Fraunces Variable", Georgia, serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '1.75rem', lineHeight: '1.25' },
      h2: { fontSize: '1.25rem', lineHeight: '1.3' },
      h3: { fontSize: '1rem', lineHeight: '1.4' },
      h4: { fontSize: '0.875rem', lineHeight: '1.4' },
    },
  },
  fontSizes: { xs: '0.75rem', sm: '0.8125rem', md: '0.875rem', lg: '1rem', xl: '1.25rem' },
  radius: { xs: '3px', sm: '6px', md: '10px', lg: '14px', xl: '20px' },
  defaultRadius: 'sm',
  shadows: {
    xs: 'none',
    sm: '0 1px 2px rgba(28, 27, 25, 0.06)',
    md: '0 6px 20px rgba(28, 27, 25, 0.10)',
    lg: '0 12px 32px rgba(28, 27, 25, 0.12)',
    xl: '0 16px 40px rgba(28, 27, 25, 0.14)',
  },
  focusRing: 'auto',
  cursorType: 'pointer',
  components: {
    Button: Button.extend({ defaultProps: { fw: 500 } }),
    TextInput: TextInput.extend({ defaultProps: { radius: 'sm' } }),
    PasswordInput: PasswordInput.extend({ defaultProps: { radius: 'sm' } }),
    Select: Select.extend({ defaultProps: { radius: 'sm', checkIconPosition: 'right' } }),
    Card: Card.extend({ defaultProps: { radius: 'md', withBorder: true, shadow: 'none', padding: 'lg' } }),
    Paper: Paper.extend({ defaultProps: { radius: 'md', shadow: 'none' } }),
    Badge: Badge.extend({ defaultProps: { radius: 'xs', variant: 'light', tt: 'none', fw: 500 } }),
    Menu: Menu.extend({ defaultProps: { shadow: 'md', radius: 'sm' } }),
    Modal: Modal.extend({ defaultProps: { radius: 'md', shadow: 'lg', centered: true } }),
    Table: Table.extend({ defaultProps: { verticalSpacing: 10, horizontalSpacing: 'md', fz: 'sm' } }),
    Tabs: Tabs.extend({ defaultProps: { color: 'ink' } }),
  },
})

/** Page background, text and border colours from the design reference. */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': tokens.page,
    '--mantine-color-text': tokens.text,
    '--mantine-color-dimmed': tokens.muted,
    '--mantine-color-default-border': tokens.line,
    '--mantine-color-placeholder': tokens.faint,
  },
  dark: {},
})
