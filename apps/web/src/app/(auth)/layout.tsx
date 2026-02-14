/**
 * Auth Layout
 *
 * Layout for authentication pages
 */

import { NextIntlClientProvider } from "next-intl";

const authMessages = {
  auth: {
    login: {
      title: "Sign in",
      description: "Use your email and password to continue",
      noAccount: "Don't have an account?",
      fields: {
        email: {
          label: "Email",
          placeholder: "you@example.com",
        },
        password: {
          label: "Password",
          placeholder: "Enter your password",
        },
      },
      actions: {
        hidePassword: "Hide",
        showPassword: "Show",
        forgotPassword: "Forgot password?",
        signingIn: "Signing in...",
        signIn: "Sign in",
        signUp: "Sign up",
      },
      errors: {
        emailRequired: "Email is required",
        emailInvalid: "Please enter a valid email address",
        passwordRequired: "Password is required",
        accountLocked: "Account is locked",
        lockoutTimeRemaining: "Try again in {minutes} minutes",
        remainingAttempts: "{count} attempts remaining",
        loginFailed: "Authentication failed",
      },
    },
    tenant: {
      current: "Current",
      noTenants: "No tenants available",
      errors: {
        switchFailed: "Failed to switch tenant",
      },
      status: {
        active: "Active",
        pending: "Pending",
        suspended: "Suspended",
      },
    },
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider locale="en" messages={authMessages}>
      {children}
    </NextIntlClientProvider>
  );
}
