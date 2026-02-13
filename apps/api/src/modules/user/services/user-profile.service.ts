/**
 * User Profile Service
 *
 * Business logic for user profile updates
 */

import { userRepository } from "../auth/repositories/user.repository";
import type { User } from "@agentifui/db/schema";

/**
 * Profile update result
 */
export interface ProfileUpdateResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * User Profile Service
 */
export class UserProfileService {
  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: {
      name?: string;
      avatar?: string;
      locale?: string;
      theme?: string;
    }
  ): Promise<ProfileUpdateResult> {
    const user = await userRepository.findById(userId);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Validate name
    if (data.name !== undefined) {
      if (data.name.trim().length < 2) {
        return { success: false, error: "Name must be at least 2 characters" };
      }
      data.name = data.name.trim();
    }

    const updated = await userRepository.update(userId, data);

    if (!updated) {
      return { success: false, error: "Failed to update profile" };
    }

    return { success: true, user: updated };
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<ProfileUpdateResult & { user?: User }> {
    const user = await userRepository.findById(userId);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    return { success: true, user };
  }

  /**
   * Update preferences
   */
  async updatePreferences(
    userId: string,
    preferences: {
      locale?: string;
      theme?: string;
      timezone?: string;
    }
  ): Promise<ProfileUpdateResult> {
    return this.updateProfile(userId, preferences);
  }
}

// Singleton instance
export const userProfileService = new UserProfileService();
