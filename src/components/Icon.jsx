const PATHS = {
  pencil:    'M10.5 3.5l2 2-8 8H2.5v-2l8-8zm1-1l1.5 1.5',
  trash:     'M2 4.5h12M6 4.5v-2h4v2M4.5 4.5l.6 8a.6.6 0 00.6.5h4.6a.6.6 0 00.6-.5l.6-8',
  history:   'M8 4.5v4l2.5 2M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13z',
  close:     'M3 3l10 10M13 3L3 13',
  chevronD:  'M3 6l5 5 5-5',
  chevronU:  'M13 10L8 5l-5 5',
  check:     'M2.5 8l4 4 7-7',
  plus:      'M8 2.5v11M2.5 8h11',
  star:      'M8 2l1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.5l-3.7 1.8.7-4.1-3-2.9 4.2-.7z',
  sparkle:   'M8 2v2M8 12v2M2 8h2M12 8h2M4 4l1.4 1.4M10.6 10.6l1.4 1.4M4 12l1.4-1.4M10.6 5.4l1.4-1.4M8 5a3 3 0 100 6 3 3 0 000-6z',
  person:    'M8 7a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3 14c0-2.8 2.2-5 5-5s5 2.2 5 5',
  money:     'M8 2v1.5M8 12.5V14M4 5.5h5.5a2 2 0 010 4H6a2 2 0 000 4H11M2 8h1M13 8h1',
  calendar:  'M2 5.5h12M5 2v2M11 2v2M2 4.5a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1v-8z',
  trend:     'M2 12L6 7l4 3 5-7M11 3h3v3',
  list:      'M3 4.5h10M3 8h10M3 11.5h6',
  settings:  'M8 5a3 3 0 100 6 3 3 0 000-6zM8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6l1.4 1.4M3 13l1.4-1.4M11.6 4.4l1.4-1.4',
  edit:      'M2 14l2.5-.7L13 4.8a1 1 0 000-1.4l-.4-.4a1 1 0 00-1.4 0L2.7 11.5 2 14z',
  // New icons
  home:      'M2 8.5L8 2.5l6 6M3.5 7v6.5h3v-4h3v4h3V7',
  bank:      'M8 2L2 5.5h12L8 2zM3 6v6M6 6v6M10 6v6M13 6v6M2 12h12',
  swap:      'M3 5h10M3 5l2.5-2.5M3 5l2.5 2.5M13 11H3M13 11l-2.5-2.5M13 11l-2.5 2.5',
  'arrow-up':   'M8 13V3M3.5 7.5L8 3l4.5 4.5',
  'arrow-down': 'M8 3v10M3.5 8.5L8 13l4.5-4.5',
  wallet:    'M2 5a1 1 0 011-1h11a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V5zM11 9a1 1 0 100-2 1 1 0 000 2z',
  mortgage:  'M2 14V8.5L8 3l6 5.5V14M5 14v-5h6v5',
  building:  'M2 14V5l6-3 6 3v9M5 14V9h6v5M8 6v2',
  tool:      'M11.5 2.5l-2 2 1 1-5 5-1-1-2 2 2.5 2.5 2-2-1-1 5-5 1 1 2-2L11.5 2.5zM5 11l-3 3',
  clipboard: 'M5 2h6v2H5V2zM3 3h2v1h6V3h2a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1zM5 7h6M5 10h4',
  layers:    'M8 2L2 5.5l6 3.5 6-3.5L8 2zM2 9l6 3.5L14 9M2 12.5l6 3.5 6-3.5',
  tag:       'M2 2h6l6 6-6 6-6-6V2zM5 5.5a0.5 0.5 0 110-1 0.5 0.5 0 010 1z',
  alertcir:  'M8 2a6 6 0 100 12A6 6 0 008 2zM8 5v4M8 10.5v.5',
  wrench:    'M12.5 2.5c.5 1.5 0 3-1 4L5 13a1.41 1.41 0 01-2-2l6.5-6.5c1-1 2.5-1.5 4-1z',
  filter:    'M2 3h12M4 8h8M6 13h4',
  sortaz:    'M3 5h6M3 8h4M3 11h2M12 2v10M9.5 9.5l2.5 2.5 2.5-2.5',
  download:  'M8 2v8M5 7l3 3 3-3M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2',
  upload:    'M8 14V6M5 9l3-3 3 3M2 5V3a1 1 0 011-1h10a1 1 0 011 1v2',
  shield:    'M8 2l5 2.5v4c0 3-2.5 5-5 5.5C5.5 13.5 3 11.5 3 8.5v-4L8 2z',
};

export default function Icon({ name, size = 14, strokeWidth = 1.5 }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 16 16"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  );
}
