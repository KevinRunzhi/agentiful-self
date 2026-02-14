/**
 * Login Page
 *
 * User authentication page
 */

import { LoginForm } from "../../../features/auth/components";

interface LoginPageSearchParams {
  tenant?: string | string[];
  redirect?: string | string[];
  accepted?: string | string[];
  reset?: string | string[];
}

interface LoginPageProps {
  searchParams?: Promise<LoginPageSearchParams>;
}

function getParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const tenant = getParamValue(params.tenant);
  const redirect = getParamValue(params.redirect);
  const accepted = getParamValue(params.accepted);
  const reset = getParamValue(params.reset);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Logo/brand header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Agentiful</h1>
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>

        {/* Success message from password reset */}
        {reset === "true" && (
          <div className="p-4 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
            Your password has been reset. Please sign in with your new password.
          </div>
        )}

        {/* Success message from invitation acceptance */}
        {accepted === "true" && (
          <div className="p-4 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
            Your account has been created. Please sign in with your credentials.
          </div>
        )}

        {/* Login form */}
        <LoginForm
          initialTenantSlug={tenant}
          redirectTo={redirect || "/apps"}
        />
      </div>
    </div>
  );
}
