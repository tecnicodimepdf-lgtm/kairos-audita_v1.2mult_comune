/**
 * Utility function for RBAC Permission checking across Auditoria Trabalhista UI.
 */
export interface UserPermissions {
  perfilAcesso?: string;
  permissoes?: string[];
}

export function hasPermission(
  user: UserPermissions | null | undefined,
  requiredPerm: string | string[]
): boolean {
  if (!user) return false;

  // Master profile or full admin wildcard bypass
  if (
    user.perfilAcesso === 'Master' ||
    user.permissoes?.includes('admin_acesso_total') ||
    user.permissoes?.includes('*')
  ) {
    return true;
  }

  const userPerms = user.permissoes || [];
  if (Array.isArray(requiredPerm)) {
    return requiredPerm.some((p) => userPerms.includes(p));
  }
  return userPerms.includes(requiredPerm);
}
