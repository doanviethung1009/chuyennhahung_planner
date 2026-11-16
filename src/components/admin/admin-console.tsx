'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/button';
import { ApiError, api, signInUrl } from '@/components/planner/api';
import { CreateUserForm, type CreateUserInput } from './create-user-form';
import { SecretPanel } from './secret-panel';
import { UserTable } from './user-table';
import type { AccountAction, AccountImpact, AdminRole, AdminUser, OneTimeSecret } from './types';

interface Props {
  currentUserId: string;
  actorRole: AdminRole;
  currentHandle: string;
}

type Status = { kind: 'ok' | 'error'; text: string; expired?: boolean } | null;

const ERROR_CODES = [
  'unauthorized',
  'forbidden',
  'password_change_required',
  'invalid_state',
  'rate_limited',
  'not_found',
  'conflict',
] as const;
const FIELD_NAMES = ['handle', 'displayName', 'email', 'role'] as const;

/**
 * The one client island of the admin page. It is a client component because it
 * holds form state, fires same-origin `fetch` calls with the session cookie
 * and keeps one-time secrets in memory; everything around it (the gate, the
 * heading, metadata) stays on the server. It never sees a service token: the
 * browser authenticates with the session cookie alone.
 */
export function AdminConsole({ currentUserId, currentHandle, actorRole }: Props) {
  const t = useTranslations('admin');
  const locale = useLocale() as Locale;
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [secrets, setSecrets] = useState<OneTimeSecret[]>([]);
  const [signingOut, setSigningOut] = useState(false);

  const fail = useCallback(
    (failure: unknown) => {
      if (!(failure instanceof ApiError)) return setStatus({ kind: 'error', text: t('errors.generic') });
      const code = failure.code;
      if (failure.status === 401) return setStatus({ kind: 'error', text: t('errors.unauthorized'), expired: true });
      if (code === 'validation_failed') {
        const fields = [...new Set(failure.issuePaths.map((path) => path.split('.')[0]))]
          .filter((name): name is (typeof FIELD_NAMES)[number] => FIELD_NAMES.includes(name as never))
          .map((name) => t(`fields.${name}`));
        return setStatus({
          kind: 'error',
          text: fields.length > 0 ? t('errors.validation_fields', { fields: fields.join(', ') }) : t('errors.validation_failed'),
        });
      }
      if (code === 'rate_limited') {
        return setStatus({ kind: 'error', text: t('errors.rate_limited', { seconds: failure.retryAfterSeconds ?? 60 }) });
      }
      if ((ERROR_CODES as readonly string[]).includes(code)) {
        return setStatus({ kind: 'error', text: t(`errors.${code as (typeof ERROR_CODES)[number]}`) });
      }
      setStatus({ kind: 'error', text: t('errors.generic') });
    },
    [t],
  );

  const load = useCallback(async () => {
    try {
      const data = await api<{ users: AdminUser[] }>('/api/admin/planner/users');
      setUsers(data.users);
      return true;
    } catch (failure) {
      fail(failure);
      return false;
    }
  }, [fail]);

  useEffect(() => {
    // Initial fetch on mount; setState happens after the awaited response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const addSecret = (secret: Omit<OneTimeSecret, 'key'>) =>
    setSecrets((current) => [...current, { ...secret, key: `${Date.now()}-${current.length}` }]);

  async function createUser(input: CreateUserInput): Promise<boolean> {
    setStatus(null);
    try {
      const result = await api<{ user: AdminUser; accessToken?: string; temporaryPassword?: string }>(
        '/api/admin/planner/users',
        { method: 'POST', body: input },
      );
      addSecret({
        handle: result.user.handle,
        accessToken: result.accessToken,
        temporaryPassword: result.temporaryPassword,
      });
      setStatus({ kind: 'ok', text: t('status.created', { handle: result.user.handle }) });
      await load();
      return true;
    } catch (failure) {
      fail(failure);
      return false;
    }
  }

  async function saveRole(user: AdminUser, role: AdminRole) {
    setStatus(null);
    try {
      const result = await api<{ user: AdminUser }>(`/api/admin/planner/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        body: { role },
      });
      setUsers((current) => current?.map((u) => (u.id === user.id ? result.user : u)) ?? current);
      setStatus({ kind: 'ok', text: t('status.roleSaved', { handle: user.handle, role: t(`roles.${role}`) }) });
    } catch (failure) {
      fail(failure);
    }
  }

  async function resetPassword(user: AdminUser) {
    setStatus(null);
    try {
      const result = await api<{ temporaryPassword: string }>(
        `/api/admin/planner/users/${encodeURIComponent(user.id)}/reset-password`,
        { method: 'POST', body: {} },
      );
      addSecret({ handle: user.handle, temporaryPassword: result.temporaryPassword });
      setStatus({ kind: 'ok', text: t('status.resetDone', { handle: user.handle }) });
    } catch (failure) {
      fail(failure);
    }
  }

  async function loadImpact(user: AdminUser): Promise<AccountImpact | null> {
    try {
      const result = await api<{ impact: AccountImpact }>(
        `/api/admin/planner/users/${encodeURIComponent(user.id)}/impact`,
      );
      return result.impact;
    } catch (failure) {
      fail(failure);
      return null;
    }
  }

  async function accountAction(user: AdminUser, kind: AccountAction, confirmHandle?: string) {
    setStatus(null);
    const base = `/api/admin/planner/users/${encodeURIComponent(user.id)}`;
    try {
      if (kind === 'purge') {
        const confirmQuery = confirmHandle ? `&confirm=${encodeURIComponent(confirmHandle)}` : '';
        await api(`${base}?mode=hard${confirmQuery}`, { method: 'DELETE' });
        setUsers((current) => current?.filter((u) => u.id !== user.id) ?? current);
      } else {
        const result = await api<{ user: AdminUser }>(
          kind === 'delete' ? `${base}?mode=soft` : `${base}/${kind}`,
          { method: kind === 'delete' ? 'DELETE' : 'POST', ...(kind === 'delete' ? {} : { body: {} }) },
        );
        setUsers((current) => current?.map((u) => (u.id === user.id ? result.user : u)) ?? current);
      }
      setStatus({ kind: 'ok', text: t(`status.${kind}Done`, { handle: user.handle }) });
    } catch (failure) {
      // `invalid_state` here is one of several lifecycle refusals (own account, last
      // admin, not soft-deleted first, handle not confirmed), unlike the role / reset wording of `errors.invalid_state`.
      if (failure instanceof ApiError && failure.code === 'invalid_state') {
        return setStatus({ kind: 'error', text: t('errors.account_state') });
      }
      fail(failure);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await api('/api/planner/session', { method: 'DELETE' });
      setSecrets([]);
      window.location.assign(signInUrl(locale));
    } catch {
      setSigningOut(false);
      setStatus({ kind: 'error', text: t('status.signedOutFailed') });
    }
  }

  return (
    <div className="grid gap-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-foreground-muted">{t('signedInAs', { handle: currentHandle })}</p>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className={buttonClass({ variant: 'secondary', size: 'sm' })}
        >
          {signingOut ? t('signingOut') : t('signOut')}
        </button>
      </div>

      <div role="status" aria-live="polite" className="min-h-6">
        {status ? (
          <p
            className={`rounded-md border px-4 py-3 text-base text-foreground ${
              status.kind === 'error' ? 'border-primary bg-surface-muted' : 'border-border-strong bg-surface'
            }`}
          >
            {status.text}{' '}
            {status.expired ? (
              <a href={signInUrl(locale)} className="font-medium text-primary-strong underline underline-offset-4">
                {t('errors.signInAgain')}
              </a>
            ) : null}
          </p>
        ) : null}
      </div>

      {secrets.length > 0 ? (
        <div className="grid gap-5">
          {secrets.map((secret) => (
            <SecretPanel
              key={secret.key}
              secret={secret}
              onDismiss={() => setSecrets((current) => current.filter((s) => s.key !== secret.key))}
            />
          ))}
        </div>
      ) : null}

      <section aria-labelledby="admin-users-heading" className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="admin-users-heading" className="font-display text-2xl text-foreground">
            {t('users.heading')}
          </h2>
          {users ? <p className="text-sm text-foreground-muted">{t('users.count', { count: users.length })}</p> : null}
        </div>
        {users === null ? (
          <p className="text-base text-foreground-muted">{t('users.loading')}</p>
        ) : users.length === 0 ? (
          <p className="text-base text-foreground-muted">{t('users.empty')}</p>
        ) : (
          <UserTable users={users} currentUserId={currentUserId} actorRole={actorRole} onSaveRole={saveRole} onReset={resetPassword} onAccount={accountAction} onLoadImpact={loadImpact} />
        )}
        {users === null && status?.kind === 'error' ? (
          <div>
            <button type="button" onClick={() => void load()} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
              {t('users.retry')}
            </button>
          </div>
        ) : null}
      </section>

      <CreateUserForm actorRole={actorRole} onCreate={createUser} />
    </div>
  );
}
