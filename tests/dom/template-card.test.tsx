// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { TemplateCard } from '../../src/components/templates/template-card';
import { TemplatesEmpty, TemplatesError } from '../../src/components/templates/template-states';
import { messages, renderWithIntl, useDomCleanup } from './helpers';

const labels = {
  title: 'Đà Lạt 3 ngày lãng mạn',
  summary: 'Ba ngày thưa, mỗi ngày hai điểm.',
  duration: '3 ngày',
  style: 'Lãng mạn',
  pace: 'Đi chậm',
  group: '2 người',
  cost: 'Ước tính 4,4 triệu đ',
  destination: 'Đà Lạt',
  useCta: 'Dùng mẫu này',
  paceLabel: 'Nhịp độ',
  groupLabel: 'Đi cùng',
  costLabel: 'Chi phí',
};

describe('TemplateCard', () => {
  useDomCleanup();

  it('renders one h2 and exactly one link to the setup page for the slug', () => {
    const { container } = renderWithIntl(<TemplateCard slug="da-lat-3-ngay" labels={labels} />);
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(labels.title);
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute('href')).toBe('/tao-chuyen-di/da-lat-3-ngay');
    expect(container.querySelector('a[href="#"]')).toBeNull();
  });

  it('names the template in the link for screen readers, and uses the EN path under en', () => {
    const { container } = renderWithIntl(<TemplateCard slug="da-lat-3-ngay" labels={labels} />, 'en');
    const link = container.querySelector('a')!;
    expect(link.textContent).toContain(labels.useCta);
    expect(link.querySelector('.sr-only')?.textContent).toContain(labels.title);
    expect(link.getAttribute('href')).toBe('/en/trip-setup/da-lat-3-ngay');
  });
});

describe('template states', () => {
  useDomCleanup();
  const t = messages.vi.tripTemplates;

  it('empty state links onward with real hrefs', () => {
    const { container } = renderWithIntl(
      <TemplatesEmpty title={t.emptyTitle} body={t.emptyBody} storiesLabel={t.emptyStories} newTripLabel={t.emptyNewTrip} />,
    );
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/chuyen-di-choi', '/chuyen-di-cua-toi/moi']);
  });

  it('error state is an alert with a retry link back to the list', () => {
    const { container } = renderWithIntl(<TemplatesError title={t.errorTitle} body={t.errorBody} retryLabel={t.retry} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(container.querySelector('a')!.getAttribute('href')).toBe('/lich-trinh-mau');
  });
});
