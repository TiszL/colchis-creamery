import { getSession } from './session';

/**
 * Global (non-location) role guard for Server Actions.
 *
 * Next.js Server Actions are PUBLIC POST endpoints. A page-level `redirect()`
 * or a middleware path-gate only governs navigation to the rendering route —
 * it does NOT protect the action's POST endpoint, which the browser can invoke
 * directly once its action id is known. Every mutating action must therefore
 * re-assert the caller's role server-side. These helpers make that uniform so
 * the check is impossible to forget.
 *
 * For per-location (row-level) access use `assertLocationRole` /
 * `requireLocationAccess` in `./location-rbac` instead.
 */

/** Returns the session iff the caller holds one of `allowedRoles`, else null. */
export async function authorize(allowedRoles: readonly string[]) {
  const session = await getSession();
  if (!session || !allowedRoles.includes(session.role)) return null;
  return session;
}

/** Throws "Unauthorized" unless the caller holds one of `allowedRoles`. Returns the session. */
export async function requireRole(allowedRoles: readonly string[]) {
  const session = await authorize(allowedRoles);
  if (!session) throw new Error('Unauthorized');
  return session;
}

/** Convenience guard: master-admin only. */
export async function requireMasterAdmin() {
  return requireRole(['MASTER_ADMIN']);
}
