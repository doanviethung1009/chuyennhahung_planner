import { ContentError } from '@/server/content/errors';
import type { PlannerRepository } from './repository';
import { plannerUserCreateSchema } from './schemas';

/**
 * Creates an admin straight in the Planner store, for `npm run admin:create`
 * (ADR 0010). No HTTP and no `ADMIN_API_TOKEN`: whoever can run this already
 * holds the database credentials. The account gets a random temporary
 * password and `mustChangePassword`, so the first sign-in is sent to the
 * change-password page before it can reach `/quan-tri`.
 */
export interface AdminBootstrapArgs {
  email: string;
  displayName: string;
  handle: string;
}

export const ADMIN_CREATE_USAGE =
  'usage: npm run admin:create -- --email <email> --name "<display name>" [--handle <handle>]';

/** Parses `--email`, `--name` and the optional `--handle`. Throws on anything else. */
export function parseAdminBootstrapArgs(argv: readonly string[]): AdminBootstrapArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag !== '--email' && flag !== '--name' && flag !== '--handle') {
      throw new Error(`unknown argument "${flag}"\n${ADMIN_CREATE_USAGE}`);
    }
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${flag} needs a value\n${ADMIN_CREATE_USAGE}`);
    }
    values.set(flag, value);
    index += 1;
  }

  const email = values.get('--email')?.trim().toLowerCase();
  const displayName = values.get('--name')?.trim();
  if (!email || !displayName) throw new Error(ADMIN_CREATE_USAGE);
  return { email, displayName, handle: values.get('--handle') ?? handleFromEmail(email) };
}

/** `Hung.Tran+x@site.vn` → `hung-tran-x`; too short → `admin`. */
export function handleFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  const slug = local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug.length >= 3 ? slug : 'admin';
}

export interface AdminBootstrapResult {
  userId: string;
  handle: string;
  email: string;
  temporaryPassword: string;
}

export async function createAdminAccount(
  repository: PlannerRepository,
  args: AdminBootstrapArgs,
): Promise<AdminBootstrapResult> {
  const parsed = plannerUserCreateSchema.safeParse({
    handle: args.handle,
    displayName: args.displayName,
    email: args.email,
    role: 'admin',
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.') || 'input');
    throw new Error(`invalid ${[...new Set(fields)].join(', ')}\n${ADMIN_CREATE_USAGE}`);
  }

  try {
    const issued = await repository.createUser(parsed.data);
    if (!('temporaryPassword' in issued) || !issued.temporaryPassword) {
      throw new Error('no temporary password was issued');
    }
    return {
      userId: issued.user.id,
      handle: issued.user.handle,
      email: parsed.data.email ?? args.email,
      temporaryPassword: issued.temporaryPassword,
    };
  } catch (error) {
    if (error instanceof ContentError && error.code === 'slug_conflict') {
      throw new Error(
        'an account with that email or handle already exists — pass another --handle, ' +
          'or reset its password with POST /api/admin/planner/users/<userId>/reset-password',
      );
    }
    throw error;
  }
}
