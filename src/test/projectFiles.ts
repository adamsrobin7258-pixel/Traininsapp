/**
 * Reading files of the project in tests (bundled assets under `public/`). The app's TypeScript
 * setup has no Node types on purpose, so the Node API is described here with just what the tests
 * use.
 */
interface NodeFs {
  readFileSync(path: string): Uint8Array;
  existsSync(path: string): boolean;
}

// A plain string variable: resolved at run time by Node, not checked against missing types.
const NODE_FS: string = 'node:fs';
const fs = (await import(/* @vite-ignore */ NODE_FS)) as NodeFs;

/** Path relative to the project root (tests run from there). */
export function projectFileExists(path: string): boolean {
  return fs.existsSync(path);
}

export function readProjectFile(path: string): ArrayBuffer {
  const bytes = fs.readFileSync(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
