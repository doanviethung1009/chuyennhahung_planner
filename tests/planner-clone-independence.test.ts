import { describe, expect, it } from 'vitest';
import type { TravelTemplate } from '../src/server/content/schemas';
import { createContentCatalog, type PlannerCatalog } from '../src/server/planner/catalog';
import type { TripCreateInput } from '../src/server/planner/schemas';
import { expenseInput, makeOwner, makePlanner, makeSeededPlanner } from './planner-helpers';

/**
 * ADR 0005 / ADR 0006: a cloned trip is a value copy of a template. Templates
 * live in the content store and trips in the planner store, linked only by the
 * `sourceTemplate` snapshot. These tests pin the three guarantees the
 * follow-hung-footsteps contract addendum listed as untested.
 */

const SLUG = 'da-lat-3-ngay-lang-man';

const fromTemplate: TripCreateInput = {
  source: 'template',
  templateSlug: SLUG,
  startDate: '2026-04-10',
  partySize: 2,
  budget: { targetTotalVnd: 5_000_000, currency: 'VND' },
  note: null,
};

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** A catalog over one template object the test holds a reference to. */
function heldCatalog(template: TravelTemplate, base: PlannerCatalog): PlannerCatalog {
  return {
    ...base,
    getApprovedTemplate: async (slug) => (slug === template.slug ? template : null),
  };
}

describe('a cloned trip is independent of its template', () => {
  it('keeps its days, activities and snapshot when the template is edited, withdrawn and deleted', async () => {
    const { planner, content } = await makeSeededPlanner();
    const { userId } = await makeOwner(planner);
    const view = await planner.createTrip(userId, fromTemplate);
    await planner.addExpense(userId, view.trip.id, expenseInput(), null);
    const before = JSON.stringify(await planner.getTrip(userId, view.trip.id));

    // Rewrite every day and activity, and drop the last day.
    const template = await content.getTemplate(SLUG);
    const days = template.days.slice(0, -1).map((day) => ({
      title: { vi: `${day.title.vi} (sửa)`, en: `${day.title.en} (edited)` },
      summary: null,
      activities: day.activities.map(({ id: _id, order: _order, ...activity }) => ({
        ...activity,
        title: { vi: 'Hoạt động mới', en: 'New activity' },
        estimatedCostVnd: activity.estimatedCostVnd + 1_000,
      })),
    }));
    await content.updateTemplate(SLUG, { days });
    expect(JSON.stringify(await planner.getTrip(userId, view.trip.id))).toBe(before);

    await content.updateTemplate(SLUG, { visibility: 'private' });
    expect(JSON.stringify(await planner.getTrip(userId, view.trip.id))).toBe(before);

    // A template a story still links cannot be deleted; unlink it first.
    for (const story of await content.listStories()) {
      if (story.plannerTemplateSlug === SLUG) {
        await content.updateStory(story.slug, { plannerTemplateSlug: null });
      }
    }
    await content.deleteTemplate(SLUG);
    expect(JSON.stringify(await planner.getTrip(userId, view.trip.id))).toBe(before);
  });

  it('shares no object with the template it was cloned from', async () => {
    const { content } = await makeSeededPlanner();
    const seeded = createContentCatalog(content);
    const template = await content.getPublicTemplate(SLUG);

    // Cloning from a deep-frozen template must not try to write into it.
    const frozen = makePlanner({ catalog: heldCatalog(deepFreeze(structuredClone(template)), seeded) });
    const frozenOwner = await makeOwner(frozen);
    await expect(frozen.createTrip(frozenOwner.userId, fromTemplate)).resolves.toBeDefined();

    const held = structuredClone(template);
    const planner = makePlanner({ catalog: heldCatalog(held, seeded) });
    const { userId } = await makeOwner(planner);
    const view = await planner.createTrip(userId, fromTemplate);
    const before = JSON.stringify(await planner.getTrip(userId, view.trip.id));

    // Mutate the held template in place after the clone: the trip does not move.
    held.title.vi = 'ĐÃ ĐỔI';
    for (const day of held.days) {
      day.title.vi = 'ĐÃ ĐỔI';
      for (const activity of day.activities) {
        activity.title.vi = 'ĐÃ ĐỔI';
        activity.estimatedCostVnd = 0;
      }
    }
    held.days.pop();
    expect(JSON.stringify(await planner.getTrip(userId, view.trip.id))).toBe(before);

    // And the other way: mutating a returned view leaves template and trip alone.
    const pristine = JSON.stringify(held);
    const returned = await planner.getTrip(userId, view.trip.id);
    returned.days[0]!.activities[0]!.title = 'TỪ TRIP';
    returned.trip.sourceTemplate!.title.vi = 'TỪ TRIP';
    if (returned.trip.sourceTemplate) returned.trip.sourceTemplate.templateSlug = 'tu-trip';
    expect(JSON.stringify(held)).toBe(pristine);
    expect(JSON.stringify(await planner.getTrip(userId, view.trip.id))).toBe(before);
  });

  it('leaves the template untouched, and still clonable, when a clone is purged', async () => {
    const { planner, content } = await makeSeededPlanner();
    const { userId } = await makeOwner(planner);
    const templateBefore = JSON.stringify(await content.getTemplate(SLUG));

    const view = await planner.createTrip(userId, fromTemplate);
    const archived = await planner.archiveTrip(userId, view.trip.id, view.trip.version);
    await planner.purgeTrip(userId, view.trip.id, archived.version);

    expect(JSON.stringify(await content.getTemplate(SLUG))).toBe(templateBefore);
    const again = await planner.createTrip(userId, fromTemplate);
    expect(again.trip.sourceTemplate?.templateSlug).toBe(SLUG);
    expect(again.days.length).toBe(view.days.length);
  });
});
