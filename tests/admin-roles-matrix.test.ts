import { describe, expect, it, vi } from 'vitest';

// roles-matrix pulls in next-intl/server, which needs a request: only its pure exports are used here.
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));

import vi_messages from '../messages/vi.json';
import en_messages from '../messages/en.json';
import { allActions, actionKey } from '../src/components/admin/roles-matrix';
import { ADMIN_ROLES } from '../src/components/admin/types';
import { ROLE_ACTIONS, roleSchema } from '../src/server/identity/permissions';
import { pathnames } from '../src/i18n/routing';

/** P07-12: the matrix is generated from the permission rules; a rule added without the page following fails here. */
describe('roles matrix follows the permission source', () => {
  it('lists exactly the roles the schema defines', () => {
    expect([...ADMIN_ROLES].sort()).toEqual([...roleSchema.options].sort());
  });

  it('shows every action any role (or the service token) holds', () => {
    const fromSource = new Set(Object.values(ROLE_ACTIONS).flat());
    expect(new Set(allActions(ROLE_ACTIONS))).toEqual(fromSource);
  });

  for (const [locale, messages] of [['vi', vi_messages], ['en', en_messages]] as const) {
    it(`${locale}: every action and role has a label`, () => {
      const labels = messages.adminRoles.actions as Record<string, string>;
      for (const action of allActions(ROLE_ACTIONS)) expect(labels[actionKey(action)], action).toBeTruthy();
      for (const role of ADMIN_ROLES) expect((messages.admin.roles as Record<string, string>)[role], role).toBeTruthy();
    });
  }

  for (const [locale, messages] of [['vi', vi_messages], ['en', en_messages]] as const) {
    it(`${locale}: the manage_role refusal has a message`, () => {
      expect((messages.admin.errors.reason as Record<string, string>).manage_role).toBeTruthy();
    });
  }

  it('has a Vietnamese and an English path', () => {
    expect(pathnames['/admin/users/roles']).toEqual({ vi: '/quan-tri/nguoi-dung/vai-tro', en: '/admin/users/roles' });
  });
});
