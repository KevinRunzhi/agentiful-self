/**
 * Email Templates
 *
 * Reusable email template generators
 */

/**
 * Template variables for invitation email
 */
export interface InvitationTemplateVars {
  toName: string;
  tenantName: string;
  inviterName: string;
  inviteUrl: string;
  role?: string;
  expiryDays?: number;
}

/**
 * Template variables for password reset email
 */
export interface PasswordResetTemplateVars {
  resetUrl: string;
  tenantName?: string;
  expiryHours?: number;
}

/**
 * Template variables for email verification
 */
export interface EmailVerificationTemplateVars {
  toName: string;
  verifyUrl: string;
  expiryHours?: number;
}

/**
 * Common email styles
 */
const styles = {
  body: "font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; padding: 20px;",
  container: "max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;",
  header: "background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; text-align: center;",
  headerTitle: "color: white; margin: 0; font-size: 24px; font-weight: 600;",
  content: "padding: 30px;",
  heading: "margin: 0 0 20px; font-size: 20px; color: #111827;",
  text: "margin: 0 0 10px;",
  mutedText: "font-size: 14px; color: #6b7280;",
  button: "display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 500;",
  buttonContainer: "text-align: center; margin: 30px 0;",
  footer: "padding: 20px 30px; background: #f9fafb; border-top: 1px solid #e5e7eb;",
  footerText: "margin: 0; font-size: 12px; color: #9ca3af;",
};

/**
 * Generate invitation email HTML
 */
export function invitationTemplate(vars: InvitationTemplateVars): string {
  const { toName, tenantName, inviterName, inviteUrl, role, expiryDays = 7 } = vars;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="format-detection" content="telephone=no">
        <title>Invitation to join ${tenantName}</title>
      </head>
      <body style="${styles.body}">
        <div style="${styles.container}">
          <!-- Header -->
          <div style="${styles.header}">
            <h1 style="${styles.headerTitle}">Agentiful</h1>
          </div>

          <!-- Content -->
          <div style="${styles.content}">
            <h2 style="${styles.heading}">You're invited!</h2>

            <p style="${styles.text}">Hi ${toName},</p>

            <p style="${styles.text}">
              <strong>${inviterName}</strong> has invited you to join <strong>${tenantName}</strong> on Agentiful
              ${role ? `as a <strong>${role}</strong>` : ""}.
            </p>

            <p style="${styles.text}">Click the button below to accept your invitation and create your account.</p>

            <!-- CTA Button -->
            <div style="${styles.buttonContainer}">
              <a href="${inviteUrl}" style="${styles.button}">
                Accept Invitation
              </a>
            </div>

            <p style="${styles.mutedText}">Or copy and paste this link into your browser:</p>
            <p style="${styles.mutedText}; word-break: break-all;">${inviteUrl}</p>

            <p style="${styles.mutedText}">This invitation will expire in ${expiryDays} day${expiryDays > 1 ? "s" : ""}.</p>
          </div>

          <!-- Footer -->
          <div style="${styles.footer}">
            <p style="${styles.footerText}">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate password reset email HTML
 */
export function passwordResetTemplate(vars: PasswordResetTemplateVars): string {
  const { resetUrl, tenantName, expiryHours = 1 } = vars;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="format-detection" content="telephone=no">
        <title>Reset your password</title>
      </head>
      <body style="${styles.body}">
        <div style="${styles.container}">
          <!-- Header -->
          <div style="${styles.header}">
            <h1 style="${styles.headerTitle}">Agentiful</h1>
          </div>

          <!-- Content -->
          <div style="${styles.content}">
            <h2 style="${styles.heading}">Reset your password</h2>

            <p style="${styles.text}">
              We received a request to reset the password for your account${tenantName ? ` at ${tenantName}` : ""}.
            </p>

            <p style="${styles.text}">Click the button below to create a new password.</p>

            <!-- CTA Button -->
            <div style="${styles.buttonContainer}">
              <a href="${resetUrl}" style="${styles.button}">
                Reset Password
              </a>
            </div>

            <p style="${styles.mutedText}">Or copy and paste this link into your browser:</p>
            <p style="${styles.mutedText}; word-break: break-all;">${resetUrl}</p>

            <p style="${styles.mutedText}">This link will expire in ${expiryHours} hour${expiryHours > 1 ? "s" : ""}.</p>

            <p style="${styles.mutedText}; margin-top: 20px;">
              If you didn't request this password reset, please ignore this email or contact support if you have concerns.
            </p>
          </div>

          <!-- Footer -->
          <div style="${styles.footer}">
            <p style="${styles.footerText}">This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate email verification HTML
 */
export function emailVerificationTemplate(vars: EmailVerificationTemplateVars): string {
  const { toName, verifyUrl, expiryHours = 24 } = vars;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="format-detection" content="telephone=no">
        <title>Verify your email address</title>
      </head>
      <body style="${styles.body}">
        <div style="${styles.container}">
          <!-- Header -->
          <div style="${styles.header}">
            <h1 style="${styles.headerTitle}">Agentiful</h1>
          </div>

          <!-- Content -->
          <div style="${styles.content}">
            <h2 style="${styles.heading}">Verify your email address</h2>

            <p style="${styles.text}">Hi ${toName},</p>

            <p style="${styles.text}">Please verify your email address by clicking the button below.</p>

            <!-- CTA Button -->
            <div style="${styles.buttonContainer}">
              <a href="${verifyUrl}" style="${styles.button}">
                Verify Email
              </a>
            </div>

            <p style="${styles.mutedText}">Or copy and paste this link into your browser:</p>
            <p style="${styles.mutedText}; word-break: break-all;">${verifyUrl}</p>

            <p style="${styles.mutedText}">This link will expire in ${expiryHours} hours.</p>
          </div>

          <!-- Footer -->
          <div style="${styles.footer}">
            <p style="${styles.footerText}">If you didn't create an account, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Plain text version of invitation email
 */
export function invitationPlainText(vars: InvitationTemplateVars): string {
  const { toName, tenantName, inviterName, inviteUrl, role, expiryDays = 7 } = vars;

  return `
You're invited to join ${tenantName}

Hi ${toName},

${inviterName} has invited you to join ${tenantName} on Agentiful${role ? ` as a ${role}` : ""}.

Click the link below to accept your invitation and create your account:
${inviteUrl}

This invitation will expire in ${expiryDays} day${expiryDays > 1 ? "s" : ""}.

If you didn't expect this invitation, you can safely ignore this email.
  `.trim();
}

/**
 * Plain text version of password reset email
 */
export function passwordResetPlainText(vars: PasswordResetTemplateVars): string {
  const { resetUrl, tenantName, expiryHours = 1 } = vars;

  return `
Reset your password

We received a request to reset the password for your account${tenantName ? ` at ${tenantName}` : ""}.

Click the link below to create a new password:
${resetUrl}

This link will expire in ${expiryHours} hour${expiryHours > 1 ? "s" : ""}.

If you didn't request this password reset, please ignore this email or contact support if you have concerns.
  `.trim();
}
