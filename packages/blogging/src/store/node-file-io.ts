/**
 * Node `fs/promises` implementation of the `FileIO` seam used by `JsonFilePostStore`.
 *
 * Kept separate from the store so the store stays pure/testable (tests inject an in-memory FileIO)
 * and the only real filesystem dependency lives here.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FileIO } from './PostStore.js';

export const nodeFileIO: FileIO = {
  readFile: (path) => readFile(path, 'utf8'),
  async writeFile(path, data) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data, 'utf8');
  },
  async exists(path) {
    try {
      await readFile(path, 'utf8');
      return true;
    } catch {
      return false;
    }
  },
};
