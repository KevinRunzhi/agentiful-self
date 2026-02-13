/**
 * Invite Accept Page
 *
 * Page for accepting invitations and creating accounts
 */

import { InviteAcceptForm } from "../../../features/auth/components";

interface InvitePageProps {
  searchParams: {
    token?: string;
  };
}

export default function InvitePage({ searchParams }: InvitePageProps) {
  const token = searchParams.token;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-md">
          <div className="p-6 rounded-lg border bg-card text-center space-y-4">
            <h1 className="text-xl font-semibold text-destructive">Invalid Invitation</h1>
            <p className="text-muted-foreground">
              This invitation link is invalid or has expired.
            </p>
            <a
              href="/login"
              className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Back to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Logo/brand header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Agentiful</h1>
          <p className="text-muted-foreground">Accept your invitation</p>
        </div>

        {/* Invite accept form */}
        <InviteAcceptForm token={token} />
      </div>
    </div>
  );
}
