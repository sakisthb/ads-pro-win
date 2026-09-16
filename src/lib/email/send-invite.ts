/**
 * Email utility for sending team invitations
 * Currently a stub — integrate with Brevo transactional API when BREVO_API_KEY is configured
 */

import { BRAND, inviteEmailCopy } from "@/lib/brand";

export interface SendInviteParams {
  email: string;
  orgName: string;
  inviterName: string;
  token: string;
  role: string;
}

export async function sendInviteEmail(params: SendInviteParams) {
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    BRAND.siteUrl
  ).replace(/\/$/, "");
  const acceptUrl = `${origin}/invite/accept?token=${params.token}`;
  const copy = inviteEmailCopy({
    orgName: params.orgName,
    inviterName: params.inviterName,
  });

  // TODO: Implement via Brevo transactional API when BREVO_API_KEY is configured.
  // The raw token must only travel inside the email link; never log it.
  console.log(`[invite] ${copy.subject} → ${params.email}`);

  return { success: true, acceptUrl, ...copy };
}
