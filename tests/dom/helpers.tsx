import type { ReactElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, vi } from 'vitest';
import vi_messages from '../../messages/vi.json';
import en_messages from '../../messages/en.json';

/**
 * Shared setup for component tests (ADR 0027). A test file opts in to the DOM with
 * `// @vitest-environment jsdom` on its first line; the default stays `node`.
 * Components are rendered under the real message catalogues, and the network is a
 * `fetch` stub so the real `api()` wrapper (status, code, Retry-After) is exercised.
 */
export const messages = { vi: vi_messages, en: en_messages } as const;

export function renderWithIntl(ui: ReactElement, locale: 'vi' | 'en' = 'vi') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
}

export type FetchCall = { path: string; method: string; body: unknown; ifMatch?: string };

/** A JSON `Response`; `headers` lets a test set `Retry-After`. */
export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/**
 * Installs a `fetch` stub for the file and records every call. `respond` may return a
 * `Response` or a promise of one (to hold a request open).
 */
export function stubFetch(respond: (call: FetchCall) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  const stub = vi.fn(async (path: string, init?: RequestInit) => {
    const call: FetchCall = {
      path,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      ifMatch: (init?.headers as Record<string, string> | undefined)?.['if-match'],
    };
    calls.push(call);
    return respond(call);
  });
  vi.stubGlobal('fetch', stub);
  return calls;
}

/** jsdom has no modal `<dialog>`: model the two calls the components use. */
export function polyfillDialog() {
  const proto = HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}

export function useDomCleanup() {
  beforeEach(() => polyfillDialog());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}
