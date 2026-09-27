/** Shared diagram palette; authored colors retain their semantic color family. */
const palettes = {
  light: {
    background: '#ffffff',
    text: '#21344b',
    line: '#7890aa',
    cluster: '#f4f7fb',
    clusterBorder: '#cedbe9',
    shadow: 'rgba(30, 58, 95, 0.09)',
    blue: ['#eaf2ff', '#83abe0', '#234a7d'],
    teal: ['#e4f5f5', '#70b7bb', '#205b64'],
    green: ['#e6f5ee', '#77b79b', '#245e48'],
    amber: ['#fff3db', '#d7ad60', '#77531b'],
    red: ['#fdecea', '#da9690', '#873e3a'],
    purple: ['#f0ebfb', '#af9bd4', '#5c4286'],
    neutral: ['#edf1f6', '#a7b5c7', '#40536b']
  },
  dark: {
    background: '#171e29',
    text: '#e0e9f6',
    line: '#8a9fba',
    cluster: '#1c2736',
    clusterBorder: '#3c506b',
    shadow: 'rgba(0, 0, 0, 0.22)',
    blue: ['#243b59', '#648fc5', '#d4e5ff'],
    teal: ['#203c43', '#5c9da8', '#c6eef1'],
    green: ['#233e35', '#639f86', '#c6ecdb'],
    amber: ['#453923', '#b6985d', '#f7e1b2'],
    red: ['#452e34', '#b97b81', '#f8d2d4'],
    purple: ['#36304d', '#9581b9', '#e2d8fa'],
    neutral: ['#2c3748', '#687d98', '#dbe4f1']
  }
};

function colorFamily(hex) {
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const [r, g, b] = full.match(/../g).map((c) => parseInt(c, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta < 0.04 || lightness < 0.17) return 'neutral';

  let hue;
  if (max === r) hue = ((g - b) / delta + 6) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;

  if (hue < 15 || hue >= 345) return 'red';
  if (hue < 70) return 'amber';
  if (hue < 170) return 'green';
  if (hue < 205) return 'teal';
  if (hue < 255) return 'blue';
  return 'purple';
}

export function styleMermaidSource(source, isDark) {
  const palette = palettes[isDark ? 'dark' : 'light'];

  // Normalize legacy inline fills without changing labels, links, or branch meaning.
  return source.replace(/^(\s*style\s+\S+\s+)([^\n]+)$/gm, (line, prefix, styles) => {
    const fill = styles.match(/\bfill:\s*#([\da-f]{6}|[\da-f]{3})\b/i);
    if (!fill) return line;

    const [background, border, text] = palette[colorFamily(fill[1])];
    const remaining = styles
      .replace(/(?:^|,)\s*(?:fill|stroke|color):[^,]+/g, '')
      .replace(/^,|,$/g, '');

    return `${prefix}fill:${background},stroke:${border},color:${text}${remaining ? `,${remaining}` : ''}`;
  });
}

export function mermaidConfig(isDark) {
  const palette = palettes[isDark ? 'dark' : 'light'];
  const [fill, border] = palette.blue;

  return {
    startOnLoad: false,
    suppressErrorRendering: true,
    theme: 'base',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    themeVariables: {
      darkMode: isDark,
      background: palette.background,
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '15px',
      primaryColor: fill,
      primaryTextColor: palette.text,
      primaryBorderColor: border,
      secondaryColor: palette.teal[0],
      secondaryTextColor: palette.text,
      secondaryBorderColor: palette.teal[1],
      tertiaryColor: palette.cluster,
      tertiaryTextColor: palette.text,
      tertiaryBorderColor: palette.clusterBorder,
      lineColor: palette.line,
      textColor: palette.text,
      mainBkg: fill,
      nodeBorder: border,
      clusterBkg: palette.cluster,
      clusterBorder: palette.clusterBorder,
      titleColor: palette.text,
      edgeLabelBackground: palette.background,
      actorBkg: fill,
      actorBorder: border,
      actorTextColor: palette.text,
      actorLineColor: palette.line,
      signalColor: palette.line,
      signalTextColor: palette.text,
      labelBoxBkgColor: palette.cluster,
      labelBoxBorderColor: palette.clusterBorder,
      labelTextColor: palette.text,
      loopTextColor: palette.text,
      noteBkgColor: palette.amber[0],
      noteBorderColor: palette.amber[1],
      noteTextColor: palette.amber[2]
    },
    themeCSS: `
      .node rect, .node circle, .node ellipse, .node polygon, .node path {
        stroke-width: 1.25px;
        filter: drop-shadow(0 2px 3px ${palette.shadow});
      }
      .node rect, .actor { rx: 8px; ry: 8px; }
      .cluster rect { rx: 12px; ry: 12px; }
      .cluster-label, .cluster-label span { font-weight: 600; }
      .flowchart-link { stroke-width: 1.5px; }
      .edgeLabel { font-size: 13px; }
    `,
    flowchart: {
      nodeSpacing: 24,
      rankSpacing: 40,
      padding: 12,
      diagramPadding: 20,
      subGraphTitleMargin: { top: 8, bottom: 12 },
      curve: 'basis'
    }
  };
}
