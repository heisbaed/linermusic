const timestamp = /([0-9]{1,3}):([0-9]{1,2})(?:[.:]([0-9]{1,3}))?/;
function seconds(match: RegExpMatchArray) {
  return Number(match[1]) * 60 + Number(match[2]) + Number('0.' + (match[3] || '0'));
}
export interface TvLyricLine { time: number; text: string; words: { time: number; text: string }[] }
export function parseTvLyrics(text: string): TvLyricLine[] {
  const offset = Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;
  const bracket = new RegExp('\\[' + timestamp.source + '\\]', 'g');
  const angle = new RegExp('<' + timestamp.source + '>', 'g');
  return text.split(/\r?\n/).flatMap(line => {
    const lineStamps = [...line.matchAll(bracket)];
    if (!lineStamps.length) return [];
    const body = line.replace(bracket, '').trim();
    const plain = body.replace(angle, '');
    if (!plain.trim()) return [];
    const stamps = [...body.matchAll(angle)];
    const words = stamps.map((match, i) => ({
      time: seconds(match) + offset,
      text: body.slice(match.index! + match[0].length, stamps[i + 1]?.index),
    })).filter(word => word.text.trim());
    const complete = words.map(word => word.text).join('').trim() === plain.trim();
    return lineStamps.map(stamp => ({ time: seconds(stamp) + offset, text: plain, words: complete && lineStamps.length === 1 ? words : [] }));
  }).sort((a, b) => a.time - b.time);
}
