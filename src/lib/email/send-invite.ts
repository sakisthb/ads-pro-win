/**
 * Email utility for sending team invitations
 * Currently a stub — integrate with Brevo transactional API when BREVO_API_KEY is configured
 */

export interface SendInviteParams {
  email: string;
  orgName: string;
  inviterName: string;
  token: string;
  role: string;
}

export async function sendInviteEmail(params: SendInviteParams) {
  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite/accept?token=${params.token}`;

  // TODO: Implement via Brevo transactional API when BREVO_API_KEY is configured.
  // The raw token must only travel inside the email link; never log it.
  console.log(
    `[invite] Invitation email prepared for ${params.email} to join ${params.orgName}`,
  );

  return { success: true, acceptUrl };
}
