import { describe, expect, it } from "vitest";
import {
  assessSingleTenantCapacity,
  calculateAvailabilityPercent,
  meetsMonthlyAvailabilityTarget,
} from "../../src/modules/platform/services/reliability-targets.service";

describe("reliability targets", () => {
  it("calculates monthly availability and validates >= 99.9%", () => {
    const availability = calculateAvailabilityPercent({
      totalMinutes: 43_200, // 30 days
      outageMinutes: 30,
    });

    expect(availability).toBeCloseTo(99.9306, 3);
    expect(
      meetsMonthlyAvailabilityTarget({
        totalMinutes: 43_200,
        outageMinutes: 30,
      })
    ).toBe(true);
  });

  it("checks single tenant capacity targets", () => {
    expect(
      assessSingleTenantCapacity({
        userCount: 50_000,
        concurrentOnlineUsers: 1_000,
      })
    ).toEqual({
      userCapacityMet: true,
      concurrentCapacityMet: true,
    });

    expect(
      assessSingleTenantCapacity({
        userCount: 12_000,
        concurrentOnlineUsers: 450,
      })
    ).toEqual({
      userCapacityMet: false,
      concurrentCapacityMet: false,
    });
  });
});
