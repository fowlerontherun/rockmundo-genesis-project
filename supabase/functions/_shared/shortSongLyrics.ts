/**
 * Build a short, recognizable radio edit from the player's existing lyrics.
 * Music-1.5 has no duration input, so use a bounded verse/chorus arrangement
 * instead of accidentally truncating long lyrics to an intro-only fragment.
 * The original song lyrics in the database are never changed by this helper.
 */
export function compactLyricsForShortAudio(rawLyrics: string | null, maxChars = 580): string | null {
  if (!rawLyrics?.trim()) return rawLyrics;
  const text = rawLyrics.trim();
  const marker = /\[(intro|verse(?:\s*\d+)?|pre-?chorus|chorus(?:\s*\d+)?|hook|bridge|outro)\]/gi;
  const matches = Array.from(text.matchAll(marker));
  const sections = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    const name = match[1].toLowerCase();
    return {
      kind: name.startsWith('verse') ? 'verse' : name.startsWith('chorus') || name === 'hook' ? 'chorus' : name,
      lines: text.slice(start, end).split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^\[.*\]$/.test(l)),
    };
  });
  const allLines = text.replace(/\[[^\]]+\]/g, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const verses = sections.filter(s => s.kind === 'verse');
  const choruses = sections.filter(s => s.kind === 'chorus');
  const firstVerse = verses[0]?.lines.length ? verses[0].lines : allLines.slice(0, 8);
  const chorus = choruses[0]?.lines.length ? choruses[0].lines : allLines.slice(8, 13).length ? allLines.slice(8, 13) : firstVerse.slice(0, 4);
  const secondVerse = verses[1]?.lines.length ? verses[1].lines : firstVerse.slice(-4);
  const blocks: Array<{ label: string; lines: string[]; max: number; count: number }> = [
    { label: '[Verse]', lines: firstVerse, max: 175, count: 6 },
    { label: '[Chorus]', lines: chorus, max: 130, count: 4 },
    { label: '[Verse]', lines: secondVerse, max: 105, count: 3 },
    { label: '[Chorus]', lines: chorus, max: 100, count: 3 },
  ];
  const output = blocks.map(({ label, lines, max, count }) => {
    const kept: string[] = [];
    let used = 0;
    for (const line of lines) {
      if (kept.length >= count) break;
      const space = max - used - (kept.length ? 1 : 0);
      if (space < 12) break;
      const clipped = line.length <= space ? line : line.slice(0, space).replace(/\s+\S*$/, '').trim();
      if (!clipped) continue;
      kept.push(clipped);
      used += clipped.length + (kept.length > 1 ? 1 : 0);
    }
    return kept.length ? `${label}\n${kept.join('\n')}` : '';
  }).filter(Boolean).join('\n\n');
  return output.length > maxChars ? output.slice(0, maxChars).trimEnd() : output || text.slice(0, maxChars);
}
