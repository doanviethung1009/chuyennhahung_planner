import { seedTravelContent } from '../src/content/travel/seed';
import { TravelContentRepository } from '../src/server/content/repository';
import type { Place } from '../src/server/content/schemas';
import { createMemoryStore } from '../src/server/content/store';
import { createContentCatalog, type PlannerCatalog } from '../src/server/planner/catalog';
import { PlannerRepository } from '../src/server/planner/repository';
import type {
  TripActivityCreateInput,
  TripCreateInput,
  TripExpenseCreateInput,
} from '../src/server/planner/schemas';
import { createMemoryPlannerStore, type PlannerStore } from '../src/server/planner/store';

/** A frozen clock, so assertions can name exact timestamps. */
export const FROZEN_NOW = '2026-03-01T08:00:00.000Z';

/**
 * A planner on an isolated in-memory store with a frozen clock and counted
 * ids (`trip_1`, `day_1`, `act_1`, …), so a test can name the row it means.
 */
export function makePlanner(
  options: {
    catalog?: PlannerCatalog;
    store?: PlannerStore;
    /** Pass a movable clock to test anything time-dependent, such as expiry. */
    now?: () => Date;
    /** scrypt cost; tests default to a cheap 2^10 so the suite stays fast. */
    scryptCostLog2?: number;
  } = {},
): PlannerRepository {
  const counters = new Map<string, number>();
  return new PlannerRepository({
    store: options.store ?? createMemoryPlannerStore(),
    catalog: options.catalog ?? fakeCatalog(),
    now: options.now ?? (() => new Date(FROZEN_NOW)),
    scryptCostLog2: options.scryptCostLog2 ?? 10,
    newId: (prefix) => {
      const next = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, next);
      return `${prefix}_${next}`;
    },
  });
}

/**
 * A planner wired to the **real** seeded content system, so the template clone
 * is exercised against the committed Đà Lạt template rather than a stand-in.
 */
/** A clock the test advances by hand. */
export function makeClock(start = FROZEN_NOW): {
  now: () => Date;
  advanceDays: (days: number) => void;
  advanceMinutes: (minutes: number) => void;
} {
  let current = Date.parse(start);
  return {
    now: () => new Date(current),
    advanceDays: (days) => {
      current += days * 24 * 60 * 60 * 1000;
    },
    advanceMinutes: (minutes) => {
      current += minutes * 60 * 1000;
    },
  };
}

export async function makeSeededPlanner(
  store?: PlannerStore,
): Promise<{ planner: PlannerRepository; content: TravelContentRepository }> {
  let activityCounter = 0;
  const content = new TravelContentRepository({
    store: createMemoryStore(),
    now: () => new Date(FROZEN_NOW),
    newId: () => `tplact_${++activityCounter}`,
  });
  await seedTravelContent(content);

  return {
    planner: makePlanner({ catalog: createContentCatalog(content), store }),
    content,
  };
}

/** Provisions an owner and returns the id plus the token issued for it. */
export async function makeOwner(
  planner: PlannerRepository,
  handle = 'hung-tran',
): Promise<{ userId: string; token: string }> {
  const issued = await planner.createUser({ handle, displayName: 'Hưng Trần' });
  return { userId: issued.user.id, token: issued.accessToken };
}

const place = (slug: string, category: Place['category'], nameVi: string): Place => ({
  slug,
  name: { vi: nameVi, en: nameVi },
  destinationSlug: 'da-lat',
  location: { vi: 'Đà Lạt', en: 'Đà Lạt' },
  coords: { lat: 11.94, lng: 108.44 },
  category,
  images: [],
  description: { vi: ['Mô tả.'], en: ['Description.'] },
  suggestedMinutes: 60,
  estimatedCostVnd: 50_000,
  rating: 4,
  personalNote: null,
  affiliateLinks: [],
  createdAt: FROZEN_NOW,
  updatedAt: FROZEN_NOW,
});

/** Just enough catalog to resolve the references the unit tests use. */
export function fakeCatalog(
  overrides: Partial<PlannerCatalog> = {},
): PlannerCatalog {
  const places = new Map<string, Place>([
    ['ho-xuan-huong', place('ho-xuan-huong', 'nature', 'Hồ Xuân Hương')],
    ['vuon-ca-phe-me-linh', place('vuon-ca-phe-me-linh', 'cafe', 'Cà phê Mê Linh')],
    ['khach-san-trung-tam', place('khach-san-trung-tam', 'stay', 'Khách sạn trung tâm')],
  ]);

  return {
    hasDestination: (slug) => slug === 'da-lat' || slug === 'moc-chau',
    getPlace: async (slug) => places.get(slug) ?? null,
    getApprovedTemplate: async () => null,
    getLinkedStory: async () => null,
    ...overrides,
  };
}

/** The demo trip from the brief: Đà Lạt, 3 ngày 2 đêm, 2 người, 5 triệu. */
export function daLatTripInput(
  overrides: Partial<Extract<TripCreateInput, { source: 'blank' }>> = {},
): TripCreateInput {
  return {
    source: 'blank',
    title: 'Đà Lạt 3 ngày 2 đêm',
    destinationSlug: 'da-lat',
    startDate: '2026-04-10',
    durationDays: 3,
    partySize: 2,
    travelStyle: 'romantic',
    pace: 'relaxed',
    budget: { targetTotalVnd: 5_000_000, currency: 'VND' },
    note: null,
    ...overrides,
  };
}

export function activityInput(
  overrides: Partial<TripActivityCreateInput> = {},
): TripActivityCreateInput {
  return {
    dayNumber: 1,
    title: 'Đi bộ quanh hồ',
    placeSlug: null,
    startTime: '07:00',
    durationMinutes: 60,
    estimatedCostVnd: 0,
    costScope: 'group',
    note: null,
    ...overrides,
  };
}

export function expenseInput(
  overrides: Partial<TripExpenseCreateInput> = {},
): TripExpenseCreateInput {
  return {
    label: 'Ăn trưa',
    category: 'food',
    amountVnd: 200_000,
    costScope: 'group',
    dayNumber: null,
    activityId: null,
    paidOn: null,
    note: null,
    ...overrides,
  };
}
