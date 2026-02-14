export const MONTHLY_AVAILABILITY_TARGET_PERCENT = 99.9;
export const SINGLE_TENANT_USER_CAPACITY_TARGET = 50_000;
export const SINGLE_TENANT_CONCURRENT_ONLINE_TARGET = 1_000;

export function calculateAvailabilityPercent(input: {
  totalMinutes: number;
  outageMinutes: number;
}): number {
  if (input.totalMinutes <= 0) {
    return 0;
  }
  const uptimeMinutes = Math.max(0, input.totalMinutes - Math.max(0, input.outageMinutes));
  return Number(((uptimeMinutes / input.totalMinutes) * 100).toFixed(4));
}

export function meetsMonthlyAvailabilityTarget(input: {
  totalMinutes: number;
  outageMinutes: number;
}): boolean {
  return calculateAvailabilityPercent(input) >= MONTHLY_AVAILABILITY_TARGET_PERCENT;
}

export function assessSingleTenantCapacity(input: {
  userCount: number;
  concurrentOnlineUsers: number;
}): {
  userCapacityMet: boolean;
  concurrentCapacityMet: boolean;
} {
  return {
    userCapacityMet: input.userCount >= SINGLE_TENANT_USER_CAPACITY_TARGET,
    concurrentCapacityMet: input.concurrentOnlineUsers >= SINGLE_TENANT_CONCURRENT_ONLINE_TARGET,
  };
}
