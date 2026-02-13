/**
 * Password Reset Page
 *
 * Page for requesting password reset and resetting with token
 */

import { PasswordResetForm } from "../../../features/auth/components";

interface ForgotPasswordPageProps {
  searchParams: {
    token?: string;
  };
}

export default function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Logo/brand header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Agentiful</h1>
          <p className="text-muted-foreground">
            {searchParams.token ? "Reset your password" : "Forgot your password?"}
          </p>
        </div>

        {/* Password reset form */}
        <PasswordResetForm token={searchParams.token} />
      </div>
    </div>
  );
}
