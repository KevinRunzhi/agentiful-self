/**
 * useGroups Hook
 *
 * React hook for group management
 */

"use client";

import { useState, useCallback } from "react";
import { groupApi } from "../api/groupApi";

/**
 * Group with stats
 */
export interface Group {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  sortOrder: number;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Group member
 */
export interface GroupMember {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  addedAt: string;
}

/**
 * Hook return type
 */
export interface UseGroupsReturn {
  // State
  groups: Group[];
  members: GroupMember[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchGroups: () => Promise<void>;
  fetchGroupMembers: (groupId: string) => Promise<void>;
  createGroup: (data: { name: string; description?: string }) => Promise<void>;
  updateGroup: (groupId: string, data: { name?: string; description?: string }) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  addMember: (groupId: string, userId: string, role?: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: string) => Promise<void>;
  clearError: () => void;
}

/**
 * useGroups hook
 */
export function useGroups(): UseGroupsReturn {
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch groups for current tenant
   */
  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await groupApi.getGroups();
      setGroups(response.groups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch groups");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch members for a group
   */
  const fetchGroupMembers = useCallback(async (groupId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await groupApi.getGroupMembers(groupId);
      setMembers(response.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch members");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new group
   */
  const createGroup = useCallback(async (data: { name: string; description?: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      const newGroup = await groupApi.createGroup(data);
      setGroups((prev) => [...prev, newGroup]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create group";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update a group
   */
  const updateGroup = useCallback(async (
    groupId: string,
    data: { name?: string; description?: string }
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const updated = await groupApi.updateGroup(groupId, data);
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? updated : g))
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update group";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Delete a group
   */
  const deleteGroup = useCallback(async (groupId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await groupApi.deleteGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete group";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Add a member to a group
   */
  const addMember = useCallback(async (
    groupId: string,
    userId: string,
    role: string = "member"
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const newMember = await groupApi.addMember(groupId, { userId, role });
      setMembers((prev) => [...prev, newMember]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to add member";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Remove a member from group
   */
  const removeMember = useCallback(async (memberId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await groupApi.removeMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to remove member";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update member role
   */
  const updateMemberRole = useCallback(async (memberId: string, role: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const updated = await groupApi.updateMemberRole(memberId, { role });
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? updated : m))
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update role";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    groups,
    members,
    isLoading,
    error,
    fetchGroups,
    fetchGroupMembers,
    createGroup,
    updateGroup,
    deleteGroup,
    addMember,
    removeMember,
    updateMemberRole,
    clearError,
  };
}
