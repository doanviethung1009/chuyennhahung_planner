import { rmSync } from 'node:fs';
import { dataDir } from './support/accounts';

/** Removes this run's throwaway store, accounts file and storage states. */
export default function globalTeardown(): void {
  rmSync(dataDir(), { recursive: true, force: true });
}
