/**
 * Icons.
 *
 * A stroke set drawn on one 24px grid so weights match across the app.
 * Inline rather than a package: this is the whole set the product uses, it
 * inherits currentColor and theme for free, and it costs no request on a
 * kiosk that has to paint in under a second.
 *
 * Decorative by default (aria-hidden). Pass a `title` only when the icon is
 * the sole carrier of meaning — which, per the status rule, it never is.
 */

export type IconName =
  | 'dashboard'
  | 'members'
  | 'equipment'
  | 'staff'
  | 'branches'
  | 'accounts'
  | 'checkin'
  | 'collect'
  | 'search'
  | 'qr'
  | 'camera'
  | 'phone'
  | 'whatsapp'
  | 'check'
  | 'check-circle'
  | 'alert'
  | 'x-circle'
  | 'pause'
  | 'x'
  | 'plus'
  | 'minus'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-left'
  | 'arrow-left'
  | 'arrow-up'
  | 'arrow-down'
  | 'external'
  | 'printer'
  | 'download'
  | 'filter'
  | 'bell'
  | 'sun'
  | 'moon'
  | 'logout'
  | 'lock'
  | 'shield'
  | 'inbox'
  | 'calendar'
  | 'clock'
  | 'wallet'
  | 'cash'
  | 'card'
  | 'upi'
  | 'receipt'
  | 'wrench'
  | 'activity'
  | 'scale'
  | 'ruler'
  | 'dumbbell'
  | 'flame'
  | 'user'
  | 'edit'
  | 'more'
  | 'command'
  | 'refresh'
  | 'book'
  | 'trend-up'
  | 'trend-down'
  | 'sparkle'
  | 'map-pin';

const PATHS: Record<IconName, string> = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  members: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 3.1a4 4 0 0 1 0 7.8M22 20v-2a4 4 0 0 0-3-3.9',
  equipment: 'M5 8v8M3 10v4M19 8v8M21 10v4M8 12h8M8 7h1v10H8zM15 7h1v10h-1z',
  staff: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
  branches: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 10h.01M15 10h.01M9 13h.01M15 13h.01',
  accounts: 'M3 5h18v14H3zM3 10h18M8 5v14M12 14h6M12 17h3',
  checkin: 'M9 12l2 2 4-4M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0',
  collect: 'M2 7h20v10H2zM2 11h20M6 15h3',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3M20 14h1M14 20h3M20 17v4',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8 9.8a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.4 1.8.6 2.8.7a2 2 0 0 1 1.7 2',
  whatsapp: 'M3 21l1.7-5A9 9 0 1 1 8 19.3zM9 9.5c0 3 2.5 5.5 5.5 5.5.6 0 1-.4 1-.9v-.9l-1.8-.6-.8.9a4.6 4.6 0 0 1-2.3-2.3l.9-.8-.6-1.8h-.9c-.5 0-1 .4-1 1',
  check: 'M20 6L9 17l-5-5',
  'check-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M8.5 12.2l2.4 2.4 4.6-4.9',
  alert: 'M12 3.5 2.5 20h19zM12 9v5M12 17.2h.01',
  'x-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M15 9l-6 6M9 9l6 6',
  pause: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M10 9v6M14 9v6',
  x: 'M18 6L6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-left': 'M15 18l-6-6 6-6',
  'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
  'arrow-up': 'M12 19V5M5 12l7-7 7 7',
  'arrow-down': 'M12 5v14M19 12l-7 7-7-7',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  printer: 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  filter: 'M22 3H2l8 9.5V19l4 2v-8.5z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 1 1 8 0v4',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.4 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.4-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1',
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
  wallet: 'M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h16V7H5M16 13h.01',
  cash: 'M2 6h20v12H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 9h.01M18 15h.01',
  card: 'M2 5h20v14H2zM2 10h20M6 15h4',
  upi: 'M4 12l6-8 4 8-4 8zM12 4h6l-4 8 4 8h-6',
  receipt: 'M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3zM8 8h8M8 12h8M8 16h5',
  wrench: 'M14.7 6.3a4 4 0 0 0 5 5.2L21 12l-8 8a2.8 2.8 0 0 1-4-4l8-8z M9 15l-6 6',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  scale: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 12l3.5-4.5M12 12h.01',
  ruler: 'M3 15 15 3l6 6L9 21zM7 11l2 2M11 7l2 2M15 11l-2-2',
  dumbbell: 'M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11',
  flame: 'M12 22a7 7 0 0 0 7-7c0-5-4-6-4-10 0 0-4 1.5-4 6 0 2-1.5 2-1.5 0C6 13 5 13 5 15a7 7 0 0 0 7 7',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  edit: 'M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z',
  more: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
  command: 'M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 0 0 0-6',
  refresh: 'M21 2v6h-6M3 22v-6h6M21 8A9 9 0 0 0 6 5L3 8M3 16a9 9 0 0 0 15 3l3-3',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2',
  'trend-up': 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  'trend-down': 'M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6',
  sparkle: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4zM19 3v3M20.5 4.5h-3',
  'map-pin': 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
};

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  title?: string;
}

export function Icon({ name, size = 18, strokeWidth = 1.75, className, title }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
