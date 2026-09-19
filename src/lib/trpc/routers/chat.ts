import { createTRPCRouter, protectedProcedure } from "../server";
import {
  OrganizationAuthorizationError,
  organizationRoles,
  requireOrganizationRoleForUser,
} from "@/lib/organization-authorization";

export const chatRouter = createTRPCRouter({
  // The chat desk persists through Supabase under org-scoped RLS (ADR-0004), so
  // the browser needs the active organization id before writing history.
  // Membership failure returns a null scope (not an error) so the desk can keep
  // serving the localStorage fallback instead of erroring out.
  getOrgContext: protectedProcedure.query(async ({ ctx }) => {
    try {
      const authorization = await requireOrganizationRoleForUser(
        ctx.session.user.id,
        organizationRoles,
      );
      return { organizationId: authorization.organizationId };
    } catch (error) {
      if (error instanceof OrganizationAuthorizationError) {
        return { organizationId: null };
      }
      throw error;
    }
  }),
});
