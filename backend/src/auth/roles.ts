import { Role } from '../users/user.types';

/** Ranga roli: wyższa liczba = więcej uprawnień (admin dziedziczy po analyst, analyst po resident). */
export const ROLE_RANK: Record<Role, number> = { resident: 1, analyst: 2, admin: 3 };

/**
 * Czy użytkownik z rolą `userRole` spełnia wymaganie? Wymagana rola oznacza "ta rola lub wyższa":
 * @Roles('analyst') wpuści analityka i administratora, ale nie mieszkańca.
 */
export function hasRole(userRole: Role, required: Role[]): boolean {
  if (required.length === 0) return true;
  const minimum = Math.min(...required.map((r) => ROLE_RANK[r]));
  return ROLE_RANK[userRole] >= minimum;
}
