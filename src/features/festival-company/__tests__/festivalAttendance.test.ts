import { describe, expect, it } from "vitest";
import {
  parseFestivalPlayerAttendance,
  parseFestivalPlayerAttendanceList,
} from "../attendance/festivalAttendance";

const id = "11111111-1111-4111-8111-111111111111";
const ticketId = "22222222-2222-4222-8222-222222222222";

const attendance = {
  id,
  festivalLaunchId: id,
  festivalEditionId: id,
  festivalName: "Shock Festival",
  festivalSlug: "shock-festival",
  startsOn: "2030-07-01",
  endsOn: "2030-07-03",
  cityId: null,
  admissionTicketId: ticketId,
  ticketReference: "FEST-ABC123",
  ticketType: "full_festival",
  includesCamping: true,
  includesVipArea: false,
  status: "ticketed",
  checkedInAt: null,
  leftAt: null,
  completedAt: null,
  createdAt: "2030-01-01T12:00:00Z",
};

describe("Festival attendee contracts", () => {
  it("parses an authoritative ticketed attendee", () => {
    expect(parseFestivalPlayerAttendance(attendance)).toMatchObject({
      festivalName: "Shock Festival",
      status: "ticketed",
      includesCamping: true,
    });
  });

  it("parses the attendee wallet list", () => {
    expect(parseFestivalPlayerAttendanceList([attendance])).toHaveLength(1);
  });

  it("rejects browser-invented attendee states", () => {
    expect(() => parseFestivalPlayerAttendance({ ...attendance, status: "inside_the_festival" }))
      .toThrow("malformed_festival_attendance");
  });

  it("rejects an attendee without an authoritative admission ticket", () => {
    expect(() => parseFestivalPlayerAttendance({ ...attendance, admissionTicketId: "not-a-ticket" }))
      .toThrow("malformed_festival_attendance");
  });
});
