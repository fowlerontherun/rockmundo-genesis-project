import { describe, expect, it } from "vitest";
import {
  parseFestivalCheckInEligibility,
  parseFestivalCheckInEligibilityList,
  parseFestivalCheckInResult,
  parseFestivalLeaveEarlyResult,
  parseFestivalMemorabiliaItem,
  parseFestivalMemorabiliaList,
} from "../attendance/festivalAttendeeExtras";

const attendanceId = "11111111-1111-4111-8111-111111111111";
const launchId = "22222222-2222-4222-8222-222222222222";
const editionId = "33333333-3333-4333-8333-333333333333";
const cityId = "44444444-4444-4444-8444-444444444444";
const memorabiliaId = "55555555-5555-4555-8555-555555555555";

const eligibility = {
  attendanceId,
  festivalLaunchId: launchId,
  festivalEditionId: editionId,
  attendanceStatus: "ticketed",
  canCheckIn: true,
  blockReason: null,
  startsOn: "2030-07-01",
  endsOn: "2030-07-03",
  cityId,
  cityName: "London",
  timezone: "Europe/London",
  festivalLocalDate: "2030-07-01",
  currentCityId: cityId,
  characterIsTraveling: false,
  ticketStatus: "valid",
  launchStatus: "sales_closed",
  editionStatus: "live",
  wristbandIssued: false,
};

const wristband = {
  id: memorabiliaId,
  festivalLaunchId: launchId,
  festivalEditionId: editionId,
  attendanceId,
  itemType: "wristband",
  itemKey: `festival_wristband:${editionId}`,
  displayName: "Shock Festival 2030 Wristband",
  description: "Festival souvenir",
  rarity: "common",
  metadata: { ticketType: "full_festival" },
  issuedAt: "2030-07-01T10:00:00Z",
};

describe("Festival check-in readiness contracts", () => {
  it("parses an eligible character in the festival city", () => {
    expect(parseFestivalCheckInEligibility(eligibility)).toMatchObject({
      canCheckIn: true,
      blockReason: null,
      cityName: "London",
    });
  });

  it("parses an authoritative blocked reason", () => {
    expect(parseFestivalCheckInEligibility({
      ...eligibility,
      canCheckIn: false,
      blockReason: "wrong_city",
      currentCityId: null,
    })).toMatchObject({
      canCheckIn: false,
      blockReason: "wrong_city",
    });
  });

  it("parses the readiness list", () => {
    expect(parseFestivalCheckInEligibilityList([eligibility])).toHaveLength(1);
  });

  it("rejects browser-invented check-in reasons", () => {
    expect(() => parseFestivalCheckInEligibility({
      ...eligibility,
      canCheckIn: false,
      blockReason: "skip_the_queue",
    })).toThrow("malformed_festival_check_in_eligibility");
  });

  it("rejects inconsistent canCheckIn and blockReason values", () => {
    expect(() => parseFestivalCheckInEligibility({
      ...eligibility,
      canCheckIn: true,
      blockReason: "wrong_city",
    })).toThrow("malformed_festival_check_in_eligibility");
  });
});

describe("Festival memorabilia contracts", () => {
  it("parses an issued wristband", () => {
    expect(parseFestivalMemorabiliaItem(wristband)).toMatchObject({
      itemType: "wristband",
      rarity: "common",
    });
  });

  it("parses the memorabilia inventory list", () => {
    expect(parseFestivalMemorabiliaList([wristband])).toHaveLength(1);
  });

  it("rejects memorabilia types that the server does not issue", () => {
    expect(() => parseFestivalMemorabiliaItem({ ...wristband, itemType: "golden_ticket" }))
      .toThrow("malformed_festival_memorabilia");
  });

  it("rejects malformed memorabilia metadata", () => {
    expect(() => parseFestivalMemorabiliaItem({ ...wristband, metadata: [] }))
      .toThrow("malformed_festival_memorabilia");
  });
});

describe("Festival attendee mutation contracts", () => {
  it("accepts an authoritative check-in result", () => {
    expect(parseFestivalCheckInResult({
      attendanceId,
      festivalLaunchId: launchId,
      festivalEditionId: editionId,
      status: "attending",
      checkedInAt: "2030-07-01T10:00:00Z",
      ticketStatus: "used",
      wristbandIssued: true,
      alreadyCheckedIn: false,
    })).toMatchObject({
      status: "attending",
      ticketStatus: "used",
      wristbandIssued: true,
    });
  });

  it("rejects a check-in response that leaves admission reusable", () => {
    expect(() => parseFestivalCheckInResult({
      attendanceId,
      festivalLaunchId: launchId,
      festivalEditionId: editionId,
      status: "attending",
      checkedInAt: "2030-07-01T10:00:00Z",
      ticketStatus: "valid",
      wristbandIssued: true,
      alreadyCheckedIn: false,
    })).toThrow("malformed_festival_check_in_result");
  });

  it("accepts an authoritative early-leave result", () => {
    expect(parseFestivalLeaveEarlyResult({
      attendanceId,
      festivalLaunchId: launchId,
      festivalEditionId: editionId,
      status: "left_early",
      checkedInAt: "2030-07-01T10:00:00Z",
      leftAt: "2030-07-01T18:00:00Z",
      alreadyLeft: false,
    })).toMatchObject({
      status: "left_early",
      alreadyLeft: false,
    });
  });

  it("rejects a client-invented completed leave result", () => {
    expect(() => parseFestivalLeaveEarlyResult({
      attendanceId,
      festivalLaunchId: launchId,
      festivalEditionId: editionId,
      status: "completed",
      checkedInAt: "2030-07-01T10:00:00Z",
      leftAt: "2030-07-01T18:00:00Z",
      alreadyLeft: false,
    })).toThrow("malformed_festival_leave_result");
  });
});
