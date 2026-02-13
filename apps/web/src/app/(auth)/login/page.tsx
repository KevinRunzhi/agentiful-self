/**
 * Login Page
 *
 * User authentication page
 */

import { LoginForm } from "../../features/auth/components";

interface LoginPageProps {
  searchParams: {
    tenant?: string;
    redirect?: string;
    accepted?: string;
    reset?: string;
  };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Logo/brand header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Agentiful</h1>
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>

        {/* Success message from password reset */}
        {searchParams.reset === "true" && (
          <div className="p-4 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
            Your password has been reset. Please sign in with your new password.
          </div>
        )}

        {/* Success message from invitation acceptance */}
        {searchParams.accepted === "true" && (
          <div className="p-4 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
            Your account has been created. Please sign in with your credentials.
          </div>
        )}

        {/* Login form */}
        <LoginForm
          initialTenantSlug={searchParams.tenant}
          redirectTo={searchParams.redirect || "/dashboard"}
        />
      </div>
    </div>
  );
}
