'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';
import { inputClass } from '@/components/planner/field';
import { ADMIN_ROLES, type AdminRole, type AdminUser } from './types';

interface Props {
  users: AdminUser[];
  currentUserId: string;
  /** Resolves when the server has answered, success or not. */
  onSaveRole: (user: AdminUser, role: AdminRole) => Promise<void>;
  onReset: (user: AdminUser) => Promise<void>;
}

export function UserTable({ users, currentUserId, onSaveRole, onReset }: Props) {
  const t = useTranslations('admin.users');
  const tr = useTranslations('admin.roles');
  const format = useFormatter();
  const [drafts, setDrafts] = useState<Record<string, AdminRole>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<void>) {
    setBusyId(id);
    try {
      await action();
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[56rem] border-collapse text-left text-base">
        <caption className="sr-only">{t('caption')}</caption>
        <thead className="bg-surface-muted text-sm text-foreground">
          <tr>
            {(['colHandle', 'colName', 'colEmail', 'colRole', 'colCreated', 'colActions'] as const).map((key) => (
              <th key={key} scope="col" className="px-4 py-3 font-medium">
                {t(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const role = user.role ?? 'member';
            const draft = drafts[user.id] ?? role;
            const isSelf = user.id === currentUserId;
            const busy = busyId === user.id;
            return (
              <tr key={user.id} className="border-t border-border-subtle align-top">
                <th scope="row" className="px-4 py-3 font-medium text-foreground">
                  <span className="break-all">{user.handle}</span>
                  {isSelf ? (
                    <span className="ml-2 rounded-pill bg-surface-muted px-2 py-0.5 text-xs text-primary-strong">
                      {t('you')}
                    </span>
                  ) : null}
                </th>
                <td className="px-4 py-3 text-foreground">{user.displayName}</td>
                <td className="px-4 py-3 break-all text-foreground-muted">{user.email || t('noEmail')}</td>
                <td className="px-4 py-3">
                  {isSelf ? (
                    <>
                      <span className="text-foreground">{tr(role)}</span>
                      <p className="mt-1 max-w-48 text-sm text-foreground-muted">{t('selfNote')}</p>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={t('roleSelect', { handle: user.handle })}
                        className={`${inputClass} w-auto`}
                        value={draft}
                        disabled={busy}
                        onChange={(e) => setDrafts({ ...drafts, [user.id]: e.target.value as AdminRole })}
                      >
                        {ADMIN_ROLES.map((value) => (
                          <option key={value} value={value}>
                            {tr(value)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy || draft === role}
                        onClick={() => run(user.id, () => onSaveRole(user, draft))}
                        className={buttonClass({ variant: 'secondary', size: 'sm' })}
                      >
                        {busy ? t('saving') : t('saveRole')}
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-foreground-muted">
                  <time dateTime={user.createdAt}>
                    {format.dateTime(new Date(user.createdAt), { dateStyle: 'medium' })}
                  </time>
                </td>
                <td className="px-4 py-3">
                  {isSelf ? null : confirmId === user.id ? (
                    <div role="group" aria-label={t('reset')} className="grid max-w-64 gap-2">
                      <p className="text-sm text-foreground">{t('resetConfirm', { handle: user.handle })}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(user.id, () => onReset(user))}
                          className={buttonClass({ size: 'sm' })}
                        >
                          {t('resetYes')}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmId(null)}
                          className={buttonClass({ variant: 'ghost', size: 'sm' })}
                        >
                          {t('resetNo')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmId(user.id)}
                      className={buttonClass({ variant: 'secondary', size: 'sm' })}
                    >
                      {t('reset')}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
