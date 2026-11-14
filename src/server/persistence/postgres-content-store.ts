import type { ContentStore } from '@/server/content/store';
import { CONTENT_TABLES } from './content-rows';
import {
  CONTENT_LOCK_KEY,
  createPostgresTableStore,
  type PgPoolLike,
} from './postgres-planner-store';

/**
 * Travel Content on PostgreSQL (ADR 0013): the shared table engine with the
 * content table list, its own write lock and its own revision counter. The
 * repository above it is the one that ran on the JSON file — nothing about its
 * invariants lives here.
 */
export function createPostgresContentStore(pool: PgPoolLike): ContentStore {
  return createPostgresTableStore(pool, {
    tables: CONTENT_TABLES,
    lockKey: CONTENT_LOCK_KEY,
    revisionTable: 'content_revision',
    label: 'Travel Content',
  });
}
