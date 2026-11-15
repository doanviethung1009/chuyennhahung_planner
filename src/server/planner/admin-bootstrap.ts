import { ContentError } from '@/server/content/errors';
import type { PlannerRepository } from './repository';
import { roleSchema, type Role } from '@/server/identity/permissions';
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
  /** Absent means `admin`, as before `--role` existed. */
  role?: Role;
}

export const ADMIN_CREATE_USAGE =
  'usage: npm run admin:create -- --email <email> --name "<display name>" [--handle <handle>] [--role member|editor|admin|super_admin]';

/** Parses `--email`, `--name` and the optional `--handle` and `--role`. Throws on anything else. */
export function parseAdminBootstrapArgs(argv: readonly string[]): AdminBootstrapArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag !== '--email' && flag !== '--name' && flag !== '--handle' && flag !== '--role') {
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
  const rawRole = values.get('--role');
  const role = rawRole === undefined ? undefined : roleSchema.safeParse(rawRole);
  if (role && !role.success) {
    throw new Error(`--role must be member, editor, admin or super_admin\n${ADMIN_CREATE_USAGE}`);
  }
  return {
    email,
    displayName,
    handle: values.get('--handle') ?? handleFromEmail(email),
    ...(role?.success ? { role: role.data } : {}),
  };
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
  role: Role;
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
    role: args.role ?? 'admin',
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
      role: parsed.data.role ?? 'admin',
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
