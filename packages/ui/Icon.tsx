// No icon dependency in the repository. One small, consistent SVG vocabulary.
const paths = {
  mark: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h5',
  settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M5 8a8 8 0 0 1 13-3l2 3 M4 16l2 3a8 8 0 0 0 13-3',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  mic: 'M9 4a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8',
  check: 'M5 12l4 4L19 6',
} as const;
export function Icon({ name, className = '' }: { name: keyof typeof paths; className?: string }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
