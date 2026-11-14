import { describe, expect, it } from 'vitest';
import { filterUsers, normalizeSearch } from '../src/components/admin/filter-users';
import type { AdminUser } from '../src/components/admin/types';

const users: AdminUser[] = [
  { id: '1', handle: 'hung', displayName: 'Đoàn Việt Hưng', email: 'owner@example.com', role: 'admin', createdAt: '2026-01-01T00:00:00Z' },
  { id: '2', handle: 'lan-editor', displayName: 'Lan Anh', email: 'lan@example.com', role: 'editor', createdAt: '2026-01-02T00:00:00Z' },
  { id: '3', handle: 'guest-01', displayName: 'Khách', email: null, createdAt: '2026-01-03T00:00:00Z' },
];

const ids = (list: AdminUser[]) => list.map((u) => u.id);

describe('admin user filter', () => {
  it('returns everyone for an empty query and role "all"', () => {
    expect(ids(filterUsers(users, '  ', 'all'))).toEqual(['1', '2', '3']);
  });

  it('matches name, handle and email, ignoring case and Vietnamese diacritics', () => {
    expect(ids(filterUsers(users, 'duong hung', 'all'))).toEqual([]);
    expect(ids(filterUsers(users, 'doan viet hung', 'all'))).toEqual(['1']);
    expect(ids(filterUsers(users, 'LAN-ED', 'all'))).toEqual(['2']);
    expect(ids(filterUsers(users, 'lan@example', 'all'))).toEqual(['2']);
    expect(ids(filterUsers(users, 'khach', 'all'))).toEqual(['3']);
  });

  it('treats a missing role as member', () => {
    expect(ids(filterUsers(users, '', 'member'))).toEqual(['3']);
    expect(ids(filterUsers(users, '', 'editor'))).toEqual(['2']);
  });

  it('combines the query and the role', () => {
    expect(ids(filterUsers(users, 'example', 'admin'))).toEqual(['1']);
    expect(ids(filterUsers(users, 'lan', 'admin'))).toEqual([]);
  });

  it('folds đ to d', () => {
    expect(normalizeSearch('Đà Lạt')).toBe('da lat');
  });
});
