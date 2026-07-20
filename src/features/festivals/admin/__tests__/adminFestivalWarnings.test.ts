import { describe, expect, it } from "vitest";
import { issueFromUnknown, mapCatalogueRow } from "../mappers";

describe("festival admin data health warning mapping", () => {
  it.each([
    [null, []],
    [[null], []],
    [[{}, null], []],
    [[5, "abc", [], true], []],
  ])("ignores malformed warning payload %#", (input, expected) => {
    expect(issueFromUnknown(input)).toEqual(expected);
  });

  it("preserves valid warning objects while ignoring null placeholders", () => {
    expect(
      issueFromUnknown([
        null,
        { code: "x", message: "y", severity: "warning" },
        null,
      ]),
    ).toEqual([{ code: "x", message: "y", severity: "warning" }]);
  });

  it("maps the legacy RPC payload without throwing or dropping valid warnings", () => {
    expect(() =>
      mapCatalogueRow({
        festival_id: "006da810-3fca-4c5c-a895-b0e73b60c9e4",
        data_health_warnings: [
          null,
          {
            code: "edition_without_stages",
            message: "Selected edition has no edition-scoped stages",
            severity: "warning",
          },
          null,
        ],
      }),
    ).not.toThrow();

    const row = mapCatalogueRow({
      festival_id: "006da810-3fca-4c5c-a895-b0e73b60c9e4",
      data_health_warnings: [
        null,
        {
          code: "edition_without_stages",
          message: "Selected edition has no edition-scoped stages",
          severity: "warning",
        },
        null,
      ],
    });

    expect(row.dataHealthWarnings).toEqual([
      {
        code: "edition_without_stages",
        message: "Selected edition has no edition-scoped stages",
        severity: "warning",
      },
    ]);
  });
});
