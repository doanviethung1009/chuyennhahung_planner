'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';
import { Field, inputClass } from '@/components/planner/field';
import { assignableRoles, type AdminRole } from './types';

export interface CreateUserInput {
  handle: string;
  displayName: string;
  email?: string;
  role: AdminRole;
}

/** Returns true when the user was created, so the form can clear itself. */
export function CreateUserForm({ onCreate, actorRole }: { onCreate: (input: CreateUserInput) => Promise<boolean>; actorRole: AdminRole }) {
  const t = useTranslations('admin.create');
  const tr = useTranslations('admin.roles');
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('member');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const trimmedEmail = email.trim();
    const created = await onCreate({
      handle: handle.trim(),
      displayName: displayName.trim(),
      ...(trimmedEmail ? { email: trimmedEmail } : {}),
      role,
    });
    setBusy(false);
    if (created) {
      setHandle('');
      setDisplayName('');
      setEmail('');
      setRole('member');
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls="admin-create-form"
          className={buttonClass({ size: 'md' })}
        >
          {t('open')}
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="admin-create-heading" className="grid gap-5 rounded-md border border-border-strong bg-surface p-5">
      <div>
        <h3 id="admin-create-heading" className="font-display text-xl text-foreground">
          {t('heading')}
        </h3>
        <p className="mt-1 text-sm text-foreground-muted">{t('intro')}</p>
      </div>
      <form id="admin-create-form" onSubmit={submit} className="grid gap-5 md:grid-cols-2" aria-busy={busy}>
        <Field id="admin-handle" label={t('handleLabel')} hint={t('handleHint')}>
          <input
            id="admin-handle"
            required
            minLength={3}
            maxLength={96}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="admin-handle-hint"
            className={inputClass}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </Field>
        <Field id="admin-display-name" label={t('displayNameLabel')}>
          <input
            id="admin-display-name"
            required
            minLength={2}
            maxLength={80}
            autoComplete="off"
            className={inputClass}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <Field id="admin-email" label={t('emailLabel')} hint={t('emailHint')}>
          <input
            id="admin-email"
            type="email"
            maxLength={254}
            autoComplete="off"
            aria-describedby="admin-email-hint"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field id="admin-role" label={t('roleLabel')}>
          <select
            id="admin-role"
            className={inputClass}
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
          >
            {assignableRoles(actorRole).map((value) => (
              <option key={value} value={value}>
                {tr(value)}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-wrap gap-3 md:col-span-2">
          <button type="submit" disabled={busy} className={buttonClass({ size: 'md' })}>
            {busy ? t('submitting') : t('submit')}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={busy}
            aria-expanded
            aria-controls="admin-create-form"
            className={buttonClass({ variant: 'secondary', size: 'md' })}
          >
            {t('cancel')}
          </button>
        </div>
      </form>
    </section>
  );
}
