/**
 * Inline SVG icons (Lucide-based, ISC license).
 * Replaces @lucide/svelte imports to avoid the dependency overhead.
 */

type IconNode = [string, Record<string, string>][];

const ICONS: Record<string, IconNode> = {
  'chess-king': [
    ['path', { d: 'M4 20a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z' }],
    [
      'path',
      {
        d: 'm6.7 18-1-1C4.35 15.682 3 14.09 3 12a5 5 0 0 1 4.95-5c1.584 0 2.7.455 4.05 1.818C13.35 7.455 14.466 7 16.05 7A5 5 0 0 1 21 12c0 2.082-1.359 3.673-2.7 5l-1 1',
      },
    ],
    ['path', { d: 'M10 4h4' }],
    ['path', { d: 'M12 2v6.818' }],
  ],
  'chess-queen': [
    ['path', { d: 'M4 20a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z' }],
    ['path', { d: 'm12.474 5.943 1.567 5.34a1 1 0 0 0 1.75.328l2.616-3.402' }],
    ['path', { d: 'm20 9-3 9' }],
    ['path', { d: 'm5.594 8.209 2.615 3.403a1 1 0 0 0 1.75-.329l1.567-5.34' }],
    ['path', { d: 'M7 18 4 9' }],
    ['circle', { cx: '12', cy: '4', r: '2' }],
    ['circle', { cx: '20', cy: '7', r: '2' }],
    ['circle', { cx: '4', cy: '7', r: '2' }],
  ],
  'chess-rook': [
    ['path', { d: 'M5 20a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z' }],
    ['path', { d: 'M10 2v2' }],
    ['path', { d: 'M14 2v2' }],
    ['path', { d: 'm17 18-1-9' }],
    ['path', { d: 'M6 2v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2' }],
    ['path', { d: 'M6 4h12' }],
    ['path', { d: 'm7 18 1-9' }],
  ],
  'chess-bishop': [
    ['path', { d: 'M5 20a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z' }],
    [
      'path',
      {
        d: 'M15 18c1.5-.615 3-2.461 3-4.923C18 8.769 14.5 4.462 12 2 9.5 4.462 6 8.77 6 13.077 6 15.539 7.5 17.385 9 18',
      },
    ],
    ['path', { d: 'm16 7-2.5 2.5' }],
    ['path', { d: 'M9 2h6' }],
  ],
  'chess-knight': [
    ['path', { d: 'M5 20a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z' }],
    [
      'path',
      {
        d: 'M16.5 18c1-2 2.5-5 2.5-9a7 7 0 0 0-7-7H6.635a1 1 0 0 0-.768 1.64L7 5l-2.32 5.802a2 2 0 0 0 .95 2.526l2.87 1.456',
      },
    ],
    ['path', { d: 'm15 5 1.425-1.425' }],
    ['path', { d: 'm17 8 1.53-1.53' }],
    ['path', { d: 'M9.713 12.185 7 18' }],
  ],
  'chess-pawn': [
    ['path', { d: 'M5 20a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z' }],
    ['path', { d: 'm14.5 10 1.5 8' }],
    ['path', { d: 'M7 10h10' }],
    ['path', { d: 'm8 18 1.5-8' }],
    ['circle', { cx: '12', cy: '6', r: '4' }],
  ],
  castle: [
    ['path', { d: 'M10 5V3' }],
    ['path', { d: 'M14 5V3' }],
    ['path', { d: 'M15 21v-3a3 3 0 0 0-6 0v3' }],
    ['path', { d: 'M18 3v8' }],
    ['path', { d: 'M18 5H6' }],
    ['path', { d: 'M22 11H2' }],
    ['path', { d: 'M22 9v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9' }],
    ['path', { d: 'M6 3v8' }],
  ],
  'chevrons-up': [
    ['path', { d: 'm17 11-5-5-5 5' }],
    ['path', { d: 'm17 18-5-5-5 5' }],
  ],
  house: [
    ['path', { d: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8' }],
    [
      'path',
      {
        d: 'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
      },
    ],
  ],
  'thumbs-up': [
    [
      'path',
      {
        d: 'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z',
      },
    ],
    ['path', { d: 'M7 10v12' }],
  ],
  'thumbs-down': [
    [
      'path',
      {
        d: 'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z',
      },
    ],
    ['path', { d: 'M17 14V2' }],
  ],
  handshake: [
    ['path', { d: 'm11 17 2 2a1 1 0 1 0 3-3' }],
    [
      'path',
      {
        d: 'm14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4',
      },
    ],
    ['path', { d: 'm21 3 1 11h-2' }],
    ['path', { d: 'M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3' }],
    ['path', { d: 'M3 4h8' }],
  ],
  bookmark: [
    [
      'path',
      {
        d: 'M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z',
      },
    ],
  ],
  star: [
    [
      'path',
      {
        d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z',
      },
    ],
  ],
  'message-square-text': [
    [
      'path',
      {
        d: 'M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z',
      },
    ],
    ['path', { d: 'M7 11h10' }],
    ['path', { d: 'M7 15h6' }],
    ['path', { d: 'M7 7h8' }],
  ],
};

/**
 * Generate an inline SVG string for a named icon.
 */
export function iconSvg(
  name: string,
  size: number = 24,
  strokeWidth: number = 2,
  fill: string = 'none',
): string {
  const nodes = ICONS[name];
  if (!nodes) return '';
  const children = nodes
    .map(([tag, attrs]) => {
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      return `    <${tag} ${attrStr}/>`;
    })
    .join('\n');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"`,
    `  fill="${fill}" stroke="currentColor" stroke-width="${strokeWidth}"`,
    '  stroke-linecap="round" stroke-linejoin="round">',
    children,
    '</svg>',
  ].join('\n');
}
