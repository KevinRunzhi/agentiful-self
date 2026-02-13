/**
 * Groups List Page
 *
 * Page for viewing and managing groups in a tenant
 */

import { Suspense } from "react";
import { GroupForm, GroupMemberList } from "../../../features/group/components";
import { useGroups } from "../../../features/group/hooks";
import { Button } from "../../../components/ui/Button";
import { PlusIcon } from "lucide-react";

/**
 * Groups loading skeleton
 */
function GroupsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

/**
 * Groups Page Component
 */
async function GroupsPageContent() {
  // This would typically use server-side fetching
  // For now, we'll use client-side rendering
  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Groups</h1>
          <p className="text-muted-foreground">
            Manage groups and their members
          </p>
        </div>
        <GroupsPageClient />
      </div>

      <Suspense fallback={<GroupsLoadingSkeleton />}>
        <GroupsListClient />
      </Suspense>
    </div>
  );
}

/**
 * Client component for the page actions
 */
function GroupsPageClient() {
  return (
    <Button>
      <PlusIcon className="w-4 h-4 mr-2" />
      New Group
    </Button>
  );
}

/**
 * Client component for the groups list
 */
function GroupsListClient() {
  const { groups, isLoading } = useGroups();

  if (isLoading) {
    return <GroupsLoadingSkeleton />;
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <PlusIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
        <p className="text-muted-foreground mb-4">
          Create your first group to organize team members
        </p>
        <Button>
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Group
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <GroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}

/**
 * Group card component
 */
function GroupCard({ group }: { group: any }) {
  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <h3 className="font-semibold text-lg mb-1">{group.name}</h3>
      {group.description && (
        <p className="text-sm text-muted-foreground mb-3">{group.description}</p>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {group.memberCount || 0} members
        </span>
        <Button variant="ghost" size="sm" asChild>
          <a href={`/groups/${group.id}`}>View</a>
        </Button>
      </div>
    </div>
  );
}

export default GroupsPageContent;
