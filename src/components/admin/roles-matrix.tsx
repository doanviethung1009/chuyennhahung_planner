import { getTranslations } from 'next-intl/server';
import { ADMIN_ROLES, type AdminRole } from './types';

/**
 * Read-only role matrix (P07-12). Every cell is computed from what the page
 * passes in — `ROLE_ACTIONS` and `canManageRole`, imported by the server page,
 * since a component here may not import server modules — so the table cannot
 * drift from what the API enforces. `tests/admin-roles-matrix.test.ts` fails
 * when a role or action is added without a message for it.
 */
export type RoleActions = Record<AdminRole | 'service', readonly string[]>;

export function allActions(roleActions: RoleActions): string[] {
  return [...new Set(Object.values(roleActions).flat())];
}

/** `user:provision` -> `user_provision`: a message key may not hold a colon. */
export const actionKey = (action: string) => action.replace(':', '_') as ActionKey;
type ActionKey = 'user_provision' | 'user_promote' | 'template_write' | 'story_publish' | 'content_write' | 'content_delete' | 'community_moderate' | 'community_restrict' | 'community_erase' | 'runbook_read' | 'audit_read';

export async function RolesMatrix({
  roleActions,
  canManage,
}: {
  roleActions: RoleActions;
  canManage: (actor: AdminRole, target: AdminRole) => boolean;
}) {
  const t = await getTranslations('adminRoles');
  const tr = await getTranslations('admin.roles');
  const actions = allActions(roleActions);
  const yes = t('yes');
  const no = t('no');

  const head = 'px-4 py-3 font-medium';
  const cell = 'px-4 py-3 text-center text-foreground';

  return (
    <div className="grid gap-12">
      <section aria-labelledby="roles-actions-heading" className="grid gap-3">
        <h2 id="roles-actions-heading" className="font-display text-2xl text-foreground">
          {t('actionsHeading')}
        </h2>
        <p className="max-w-prose text-base text-foreground-muted">{t('actionsNote')}</p>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[40rem] border-collapse text-left text-base">
            <caption className="sr-only">{t('actionsCaption')}</caption>
            <thead className="bg-surface-muted text-sm text-foreground">
              <tr>
                <th scope="col" className={head}>{t('colAction')}</th>
                {ADMIN_ROLES.map((role) => (
                  <th key={role} scope="col" className={`${head} text-center`}>{tr(role)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action} className="border-t border-border-subtle">
                  <th scope="row" className="px-4 py-3 font-medium text-foreground">
                    {t(`actions.${actionKey(action)}`)}
                    <code className="mt-0.5 block text-xs font-normal text-foreground-muted">{action}</code>
                  </th>
                  {ADMIN_ROLES.map((role) => (
                    <td key={role} className={cell}>
                      {roleActions[role].includes(action) ? yes : no}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="roles-manage-heading" className="grid gap-3">
        <h2 id="roles-manage-heading" className="font-display text-2xl text-foreground">
          {t('manageHeading')}
        </h2>
        <p className="max-w-prose text-base text-foreground-muted">{t('manageNote')}</p>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[32rem] border-collapse text-left text-base">
            <caption className="sr-only">{t('manageCaption')}</caption>
            <thead className="bg-surface-muted text-sm text-foreground">
              <tr>
                <th scope="col" className={head}>{t('colActor')}</th>
                {ADMIN_ROLES.map((role) => (
                  <th key={role} scope="col" className={`${head} text-center`}>{tr(role)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ADMIN_ROLES.filter((actor) => roleActions[actor].includes('user:provision')).map((actor) => (
                <tr key={actor} className="border-t border-border-subtle">
                  <th scope="row" className="px-4 py-3 font-medium text-foreground">{tr(actor)}</th>
                  {ADMIN_ROLES.map((target) => (
                    <td key={target} className={cell}>
                      {canManage(actor, target) ? yes : no}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
