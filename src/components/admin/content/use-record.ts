'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { ApiError, api, signInUrl } from '@/components/planner/api';
import type { Draft, Json } from './form-kit';
import { setAt } from './form-kit';

export type StatusAction = 'publish' | 'unpublish' | 'archive';

export interface Notice {
  kind: 'ok' | 'error';
  text: string;
  /** Session expired: offer a sign-in link. */
  expired?: boolean;
  /** Someone else saved first (412): offer a reload. */
  stale?: boolean;
}

const KNOWN_ERRORS = [
  'forbidden',
  'password_change_required',
  'invalid_state',
  'not_found',
  'bad_request',
  'slug_conflict',
  'place_in_use',
] as const;

/** Maps an API failure onto a message under `adminContent.errors`. */
export function useErrorNotice(): (failure: unknown) => Notice {
  const t = useTranslations('adminContent.errors');
  return useCallback(
    (failure: unknown): Notice => {
      if (!(failure instanceof ApiError)) return { kind: 'error', text: t('generic') };
      if (failure.status === 401) return { kind: 'error', text: t('unauthorized'), expired: true };
      if (failure.status === 412 || failure.code === 'version_conflict') {
        return { kind: 'error', text: t('version_conflict'), stale: true };
      }
      if (failure.code === 'validation_failed') return { kind: 'error', text: t('validation_failed') };
      if (failure.code === 'rate_limited') {
        return { kind: 'error', text: t('rate_limited', { seconds: failure.retryAfterSeconds ?? 60 }) };
      }
      if ((KNOWN_ERRORS as readonly string[]).includes(failure.code)) {
        return { kind: 'error', text: t(failure.code as (typeof KNOWN_ERRORS)[number]) };
      }
      return { kind: 'error', text: t('generic') };
    },
    [t],
  );
}

/**
 * Loads one record, keeps an editable draft beside it, and saves with
 * `If-Match: "<updatedAt>"`. Status changes go through the separate status
 * endpoint and leave unsaved edits in place.
 */
export function useRecord(path: string, fields: readonly string[], statusPath: string | null) {
  const t = useTranslations('adminContent.status');
  const locale = useLocale() as Locale;
  const describe = useErrorNotice();
  const [record, setRecord] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadFailed, setLoadFailed] = useState<Notice | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [issues, setIssues] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<'save' | 'action' | null>(null);
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    setLoadFailed(null);
    try {
      const data = await api<Draft>(path);
      setRecord(data);
      setDraft(data);
      setIssues(new Set());
      setFormKey((key) => key + 1);
      return true;
    } catch (failure) {
      setLoadFailed(describe(failure));
      return false;
    }
  }, [path, describe]);

  useEffect(() => {
    // Initial fetch on mount; state is set after the awaited response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const set = useCallback((fieldPath: string, value: Json) => {
    setDraft((current) => (current ? setAt(current, fieldPath, value) : current));
    setNotice(null);
  }, []);

  const dirty = useMemo(
    () => (record && draft ? fields.some((key) => JSON.stringify(record[key]) !== JSON.stringify(draft[key])) : false),
    [record, draft, fields],
  );

  async function save() {
    if (!record || !draft) return;
    setPending('save');
    setNotice(null);
    setIssues(new Set());
    try {
      const body: Draft = {};
      for (const key of fields) if (key in draft) body[key] = draft[key] as Json;
      const saved = await api<Draft>(path, { method: 'PATCH', body, version: String(record.updatedAt) });
      setRecord(saved);
      setDraft(saved);
      setNotice({ kind: 'ok', text: t('saved') });
      return saved;
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'validation_failed') {
        setIssues(new Set(failure.issuePaths));
      }
      setNotice(describe(failure));
    } finally {
      setPending(null);
    }
    return undefined;
  }

  async function runAction(action: StatusAction) {
    if (!record || !statusPath) return;
    setPending('action');
    setNotice(null);
    try {
      const result = await api<Draft>(statusPath, { method: 'POST', body: { action } });
      setRecord(result);
      setDraft((current) => ({
        ...(current ?? result),
        status: result.status as Json,
        publishedAt: (result.publishedAt ?? null) as Json,
        updatedAt: result.updatedAt as Json,
      }));
      setNotice({ kind: 'ok', text: t(action) });
      return result;
    } catch (failure) {
      setNotice(describe(failure));
    } finally {
      setPending(null);
    }
    return undefined;
  }

  return { record, draft, loadFailed, notice, issues, pending, dirty, formKey, set, save, runAction, reload: load, locale };
}

export { signInUrl };
