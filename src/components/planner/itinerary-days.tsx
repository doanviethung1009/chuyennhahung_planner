import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { formatDate } from '@/lib/format';

export interface DayView {
  dayNumber: number;
  title: string | null;
  date: string | null;
  summary?: string | null;
  activities: Array<{
    title: string;
    startTime: string | null;
    endTime?: string | null;
    note: string | null;
  }>;
}

/**
 * Read-only day-by-day list. Pure markup, server-rendered, used for the story's
 * real itinerary, the share page and the owner's detail view. Text arrives as
 * plain strings and is rendered only through React (never as HTML).
 */
export async function ItineraryDays({
  days,
  locale,
  headingLevel = 3,
}: {
  days: DayView[];
  locale: Locale;
  headingLevel?: 2 | 3;
}) {
  const t = await getTranslations('itineraryDays');
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <ol className="grid list-none gap-5 p-0">
      {days.map((day) => (
        <li key={day.dayNumber} className="rounded-xl border border-border-subtle bg-surface p-5 md:p-6">
          <Heading className="font-display text-lg font-semibold md:text-xl">
            {day.title ?? t('day', { number: day.dayNumber })}
          </Heading>
          {day.date ? (
            <p className="mt-1 text-sm text-foreground-muted">{formatDate(day.date, locale)}</p>
          ) : null}
          {day.summary ? (
            <p className="mt-2 text-base text-foreground-muted">{day.summary}</p>
          ) : null}
          <ul className="mt-4 grid list-none gap-3 p-0">
            {day.activities.map((activity, index) => (
              <li key={index} className="flex gap-4">
                <span className="w-24 shrink-0 text-sm font-medium text-primary-strong tabular-nums">
                  {activity.startTime
                    ? activity.endTime
                      ? `${activity.startTime}–${activity.endTime}`
                      : activity.startTime
                    : t('anytime')}
                </span>
                <span>
                  <span className="block text-base text-foreground">{activity.title}</span>
                  {activity.note ? (
                    <span className="mt-0.5 block text-sm text-foreground-muted">{activity.note}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
