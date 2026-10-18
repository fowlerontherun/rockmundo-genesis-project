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
  const bridge = sections.find(s => s.kind === 'bridge' && s.lines.length)?.lines
    || secondVerse.slice(-2);
  const outro = sections.find(s => s.kind === 'outro' && s.lines.length)?.lines
    || chorus.slice(-2);

  // Music-1.5 has no length parameter. Add a bridge and closing chorus to
  // encourage a complete performance; validated >90s results are clipped.
  // This never changes the stored original song lyrics.
  const blocks: Array<{ label: string; lines: string[]; max: number; count: number }> = [
    { label: '[Verse]', lines: firstVerse, max: 132, count: 5 },
    { label: '[Chorus]', lines: chorus, max: 96, count: 4 },
    { label: '[Verse]', lines: secondVerse, max: 86, count: 3 },
    { label: '[Chorus]', lines: chorus, max: 72, count: 3 },
    { label: '[Bridge]', lines: bridge, max: 52, count: 2 },
    { label: '[Chorus]', lines: chorus, max: 70, count: 3 },
    { label: '[Outro]', lines: outro, max: 26, count: 2 },
  ];
  const parts: string[] = [];
  let totalLength = 0;
  for (const [index, block] of blocks.entries()) {
    const separator = parts.length ? '\n\n' : '';
    const laterBlocks = blocks.length - index - 1;
    // Reserve some space for every remaining section instead of truncating
    // the lyrics in the middle of the bridge or outro.
    const budget = Math.min(block.max,
      maxChars - totalLength - separator.length - block.label.length - 1 - laterBlocks * 19);
    if (budget < 12) continue;
    const kept: string[] = [];
    let used = 0;
    for (const line of block.lines) {
      if (kept.length >= block.count) break;
      const room = budget - used - (kept.length ? 1 : 0);
      if (room < 8) break;
      const clipped = line.length <= room ? line : line.slice(0, room).replace(/\s+\S*$/, '').trim();
      if (!clipped) continue;
      kept.push(clipped);
      used += clipped.length + (kept.length > 1 ? 1 : 0);
    }
    if (!kept.length) continue;
    const part = block.label + '\n' + kept.join('\n');
    parts.push(part);
    totalLength += separator.length + part.length;
  }
  return parts.length ? parts.join('\n\n') : text.slice(0, maxChars);
}
