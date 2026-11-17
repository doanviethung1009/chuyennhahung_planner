import { contributionOpen } from '@/content/site';
import { ContentError } from '@/server/content/errors';

/**
 * Server-side counterpart of the `contributionOpen` UI gate (batch 10.6a, P10-15).
 * Until the owner fills in the Creator Terms and the takedown contact
 * (`src/content/site.ts`), the API must refuse community *writes* too, not only
 * hide the forms. Reads and reports stay open (reporting is never closed).
 *
 * One helper, called first in the three write routes: listing request, Planner
 * review, guest review. `403 forbidden`, reason `contribution_closed`.
 */
export function requireContributionOpen(open: boolean = contributionOpen): void {
  if (!open) {
    throw new ContentError(
      'forbidden',
      'community contributions are not open yet',
      [],
      null,
      'contribution_closed',
    );
  }
}
