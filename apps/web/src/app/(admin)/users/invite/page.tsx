/**
 * Invite Users Page
 *
 * Page for tenant admins to invite new users
 */

import { Suspense } from "react";
import { InviteUserForm } from "../../../../features/admin/components/InviteUserForm";
import { UserApprovalList } from "../../../../features/admin/components/UserApprovalList";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/Card";
import { UserPlusIcon } from "lucide-react";

/**
 * Invite Users Page
 */
export default function InviteUsersPage() {
  const [pendingUsers, setPendingUsers] = React.useState([
    { userId: "1", userName: "John Doe", userEmail: "john@example.com", role: "member", createdAt: new Date().toISOString() },
  ]);

  /**
   * Handle invite
   */
  const handleInvite = async (data: { email: string; role: string; message?: string }) => {
    console.log("Invite user:", data);
    // TODO: Call API
    alert(`Invitation sent to ${data.email}`);
  };

  /**
   * Handle approve
   */
  const handleApprove = async (userId: string) => {
    console.log("Approve user:", userId);
    setPendingUsers((prev) => prev.filter((u) => u.userId !== userId));
  };

  /**
   * Handle reject
   */
  const handleReject = async (userId: string, reason?: string) => {
    console.log("Reject user:", userId, "reason:", reason);
    setPendingUsers((prev) => prev.filter((u) => u.userId !== userId));
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            Manage users and invitations
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Invite Form */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlusIcon className="w-5 h-5" />
                Invite User
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InviteUserForm onInvite={handleInvite} />
            </CardContent>
          </Card>
        </div>

        {/* Approval Queue */}
        <div>
          <Suspense fallback={<div>Loading...</div>}>
            <UserApprovalList
              users={pendingUsers}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
