import type { Role } from "./contracts";
export function canManageStaff(role: Role): boolean {
  return role === "owner";
}
export function canManagePlans(role: Role): boolean {
  return role === "owner";
}
export function canManageMembers(role: Role): boolean {
  return role === "owner" || role === "staff";
}
export function canAccessMember(
  role: Role,
  ownMemberId: string | undefined,
  targetMemberId: string,
): boolean {
  return role !== "member" || ownMemberId === targetMemberId;
}
