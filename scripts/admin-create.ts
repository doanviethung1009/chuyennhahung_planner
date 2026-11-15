import {
  createAdminAccount,
  parseAdminBootstrapArgs,
} from '@/server/planner/admin-bootstrap';
import { getPlannerRepository } from '@/server/planner/instance';

// Creates an account (admin unless --role says otherwise) with a random temporary password in the store the app
// uses: PostgreSQL when PLANNER_DATABASE_URL is set, else the JSON file.
// The password is printed once and never stored in clear text.
let args;
try {
  args = parseAdminBootstrapArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const store = process.env.PLANNER_DATABASE_URL?.trim()
  ? 'PostgreSQL (PLANNER_DATABASE_URL)'
  : `JSON file (${process.env.PLANNER_STORE?.trim() || '.data/planner.json'})`;

try {
  const result = await createAdminAccount(await getPlannerRepository(), args);
  console.log(`${result.role} created in ${store}`);
  console.log(`  handle:             ${result.handle}`);
  console.log(`  email:              ${result.email}`);
  console.log(`  role:               ${result.role}`);
  console.log(`  temporary password: ${result.temporaryPassword}`);
  console.log('Shown once. Sign in at /dang-nhap?returnTo=/quan-tri — you will be asked');
  console.log('to choose your own password before the admin page opens (staff roles only).');
  process.exit(0);
} catch (error) {
  // Never the connection string: driver errors do not carry it, and ours do not.
  console.error(`admin:create failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exit(1);
}
