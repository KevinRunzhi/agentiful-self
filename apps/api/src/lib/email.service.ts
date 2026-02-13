/**
 * Email Service
 *
 * Email sending service using Resend
 */

import Resend from "resend";

/**
 * Email service configuration
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@agentiful.com";
const FROM_NAME = process.env.RESEND_FROM_NAME || "Agentiful";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Get Resend client
 */
function getResendClient(): Resend | null {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured, emails will be logged only");
    return null;
  }
  return new Resend(RESEND_API_KEY);
}

/**
 * Send email result
 */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send invitation email
 */
export async function sendInvitationEmail(params: {
  to: string;
  toName: string;
  tenantName: string;
  inviterName: string;
  token: string;
  role: string;
}): Promise<SendEmailResult> {
  const { to, toName, tenantName, inviterName, token, role } = params;

  const subject = `You're invited to join ${tenantName}`;
  const inviteUrl = `${APP_URL}/invite?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitation to join ${tenantName}</title>
      </head>
      <body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Agentiful</h1>
          </div>

          <!-- Content -->
          <div style="padding: 30px;">
            <h2 style="margin: 0 0 20px; font-size: 20px; color: #111827;">You're invited!</h2>

            <p style="margin: 0 0 10px;">Hi ${toName},</p>

            <p style="margin: 0 0 20px;">
              <strong>${inviterName}</strong> has invited you to join <strong>${tenantName}</strong> on Agentiful
              ${role ? `as a <strong>${role}</strong>` : ""}.
            </p>

            <p style="margin: 0 0 20px;">Click the button below to accept your invitation and create your account.</p>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
                Accept Invitation
              </a>
            </div>

            <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">
              Or copy and paste this link into your browser:
            </p>
            <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280; word-break: break-all;">
              ${inviteUrl}
            </p>

            <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">
              This invitation will expire in 7 days.
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 30px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const resend = getResendClient();

  if (!resend) {
    // Log email when Resend is not configured
    console.log("[Email] Invitation email (not sent, RESEND_API_KEY not configured):", {
      to,
      subject,
      inviteUrl,
    });
    return { success: true, messageId: "logged" };
  }

  try {
    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  token: string;
  tenantName?: string;
}): Promise<SendEmailResult> {
  const { to, token, tenantName } = params;

  const subject = "Reset your password";
  const resetUrl = `${APP_URL}/forgot-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset your password</title>
      </head>
      <body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Agentiful</h1>
          </div>

          <!-- Content -->
          <div style="padding: 30px;">
            <h2 style="margin: 0 0 20px; font-size: 20px; color: #111827;">Reset your password</h2>

            <p style="margin: 0 0 20px;">
              We received a request to reset the password for your account${tenantName ? ` at ${tenantName}` : ""}.
            </p>

            <p style="margin: 0 0 20px;">Click the button below to create a new password.</p>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
                Reset Password
              </a>
            </div>

            <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">
              Or copy and paste this link into your browser:
            </p>
            <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280; word-break: break-all;">
              ${resetUrl}
            </p>

            <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">
              This link will expire in 1 hour.
            </p>

            <p style="margin: 20px 0 0; font-size: 14px; color: #6b7280;">
              If you didn't request this password reset, please ignore this email or contact support if you have concerns.
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 30px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">
              This is an automated email, please do not reply.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const resend = getResendClient();

  if (!resend) {
    console.log("[Email] Password reset email (not sent, RESEND_API_KEY not configured):", {
      to,
      subject,
      resetUrl,
    });
    return { success: true, messageId: "logged" };
  }

  try {
    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

/**
 * Send email verification email
 */
export async function sendEmailVerificationEmail(params: {
  to: string;
  toName: string;
  token: string;
}): Promise<SendEmailResult> {
  const { to, toName, token } = params;

  const subject = "Verify your email address";
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify your email address</title>
      </head>
      <body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Agentiful</h1>
          </div>

          <!-- Content -->
          <div style="padding: 30px;">
            <h2 style="margin: 0 0 20px; font-size: 20px; color: #111827;">Verify your email address</h2>

            <p style="margin: 0 0 10px;">Hi ${toName},</p>

            <p style="margin: 0 0 20px;">
              Please verify your email address by clicking the button below.
            </p>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
                Verify Email
              </a>
            </div>

            <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">
              Or copy and paste this link into your browser:
            </p>
            <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280; word-break: break-all;">
              ${verifyUrl}
            </p>

            <p style="margin: 0; font-size: 14px; color: #6b7280;">
              This link will expire in 24 hours.
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 30px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">
              If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const resend = getResendClient();

  if (!resend) {
    console.log("[Email] Email verification (not sent, RESEND_API_KEY not configured):", {
      to,
      subject,
      verifyUrl,
    });
    return { success: true, messageId: "logged" };
  }

  try {
    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}
