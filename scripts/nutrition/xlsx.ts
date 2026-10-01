/**
 * Minimal reader for the first worksheet of an .xlsx file (Office Open XML), built on Node's
 * zlib only – no spreadsheet dependency. Enough for plain data tables such as the BLS export:
 * shared strings, inline strings, numbers and booleans. Formulas are read as their cached
 * values. Used only by build-time scripts, never by the app.
 */
import { inflateRawSync } from 'node:zlib';

export type Cell = string | number | null;

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function readZipEntries(zip: Buffer): Map<string, ZipEntry> {
  // End of central directory record: signature 0x06054b50, searched from the end.
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('Not a zip/xlsx file (no central directory)');
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const entries = new Map<string, ZipEntry>();
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error('Broken zip central directory');
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.set(name, { name, method, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readEntry(zip: Buffer, entry: ZipEntry): string {
  const offset = entry.localHeaderOffset;
  const nameLength = zip.readUInt16LE(offset + 26);
  const extraLength = zip.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const data = zip.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data.toString('utf8');
  if (entry.method === 8) return inflateRawSync(data).toString('utf8');
  throw new Error(`Unsupported zip compression method ${String(entry.method)}`);
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');
}

/** Text of all <t> elements inside a fragment (rich text runs are concatenated). */
function textOf(fragment: string): string {
  return [...fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((m) => decodeXml(m[1] ?? ''))
    .join('');
}

function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? 'A';
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

/** Rows of the first worksheet; empty cells are `null`. */
export function readFirstSheet(file: Buffer): Cell[][] {
  const entries = readZipEntries(file);
  const shared: string[] = [];
  const sharedEntry = entries.get('xl/sharedStrings.xml');
  if (sharedEntry) {
    for (const match of readEntry(file, sharedEntry).matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push(textOf(match[1] ?? ''));
    }
  }
  const sheetName =
    [...entries.keys()].filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0] ?? null;
  const sheetEntry = sheetName ? entries.get(sheetName) : undefined;
  if (!sheetEntry) throw new Error('No worksheet found');
  const xml = readEntry(file, sheetEntry);

  const rows: Cell[][] = [];
  for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: Cell[] = [];
    for (const cell of (rowMatch[1] ?? '').matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cell[1] ?? '';
      const body = cell[2] ?? '';
      const reference = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1] ?? '';
      const type = /\bt="(\w+)"/.exec(attributes)?.[1] ?? 'n';
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value: Cell = null;
      if (type === 's' && raw !== undefined) value = shared[Number(raw)] ?? null;
      else if (type === 'inlineStr') value = textOf(body);
      else if (type === 'str' && raw !== undefined) value = decodeXml(raw);
      else if (type === 'b' && raw !== undefined) value = raw === '1' ? 1 : 0;
      else if (raw !== undefined && raw !== '') value = Number(raw);
      const index = reference ? columnIndex(reference) : row.length;
      while (row.length < index) row.push(null);
      row[index] = typeof value === 'string' && value.trim() === '' ? null : value;
    }
    rows.push(row);
  }
  return rows;
}
