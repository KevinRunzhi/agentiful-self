/**
 * Group Detail Page
 *
 * Page for viewing and managing a single group
 */

import { Suspense } from "react";
import { GroupForm, GroupMemberList } from "../../../../features/group/components";
import { useGroups } from "../../../../features/group/hooks";
import { Button } from "../../../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/Card";
import { PencilIcon, Trash2Icon, UserPlusIcon } from "lucide-react";

interface GroupPageProps {
  params: {
    groupId: string;
  };
}

/**
 * Group loading skeleton
 */
function GroupLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 bg-muted rounded w-64 animate-pulse" />
      <div className="h-64 bg-muted rounded-lg animate-pulse" />
    </div>
  );
}

/**
 * Group Page Component
 */
export default function GroupPage({ params }: GroupPageProps) {
  return (
    <div className="container mx-auto py-8">
      <Suspense fallback={<GroupLoadingSkeleton />}>
        <GroupPageContent groupId={params.groupId} />
      </Suspense>
    </div>
  );
}

/**
 * Group page content
 */
function GroupPageContent({ groupId }: { groupId: string }) {
  const { groups, members, isLoading } = useGroups();

  // Find the current group
  const group = groups.find((g) => g.id === groupId);

  if (isLoading) {
    return <GroupLoadingSkeleton />;
  }

  if (!group) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Group not found</h2>
        <p className="text-muted-foreground mb-4">
          The group you're looking for doesn't exist or you don't have access to it.
        </p>
        <Button asChild>
          <a href="/groups">Back to Groups</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold">{group.name}</h1>
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-muted">
              {members.length} members
            </span>
          </div>
          {group.description && (
            <p className="text-muted-foreground">{group.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <UserPlusIcon className="w-4 h-4 mr-2" />
            Add Members
          </Button>
          <Button variant="outline" size="sm">
            <PencilIcon className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" size="sm">
            <Trash2Icon className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Members */}
      <GroupMemberList
        members={members}
        canManage={true}
        onRemove={(memberId) => console.log("Remove member:", memberId)}
        onUpdateRole={(memberId, role) => console.log("Update role:", memberId, role)}
      />

      {/* Edit form (hidden by default, shown when edit button clicked) */}
      <div className="hidden">
        <Card>
          <CardHeader>
            <CardTitle>Edit Group</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupForm
              initialValues={{
                name: group.name,
                description: group.description,
              }}
              onSubmit={async (data) => {
                console.log("Update group:", data);
              }}
              onCancel={() => console.log("Cancel edit")}
              mode="edit"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
