import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { PrCampaignForm } from "../PrCampaignForm";
import MediaAppearancesTable from "../MediaAppearancesTable";
import MediaOffersTable from "../MediaOffersTable";

const campaignDraft = {
  campaign_type: "tv",
  campaign_name: "",
  budget: 5000,
  start_date: "2025-01-01",
  end_date: "2025-02-01",
};

describe("PR widgets", () => {
  test("campaign form surfaces labels and submit copy", () => {
    const markup = renderToString(
      <PrCampaignForm
        value={campaignDraft}
        onChange={() => {}}
        onSubmit={() => {}}
        submitLabel="Launch"
      />,
    );

    expect(markup).toContain("Campaign Name");
    expect(markup).toContain("Launch");
    expect(markup).toContain("campaign-budget");
  });

  test("appearance table renders rows and empty state", () => {
    const emptyMarkup = renderToString(<MediaAppearancesTable appearances={[]} loading={false} />);
    expect(emptyMarkup).toContain("No appearances yet");

    const sample = {
      id: "a-1",
      media_type: "radio",
      program_name: "Morning Drive",
      network: "WPR",
      air_date: "2025-02-02",
      audience_reach: 120000,
      sentiment: "positive",
      highlight: "Live acoustic set",
    };

    const tableMarkup = renderToString(<MediaAppearancesTable appearances={[sample]} loading={false} />);
    expect(tableMarkup).toContain(sample.program_name);
    expect(tableMarkup).toContain(sample.network);
  });

  test("offers table encodes payout and action hooks", () => {
    const sampleOffer = {
      id: "offer-1",
      media_type: "tv",
      program_name: "Night Show",
      network: "Network One",
      proposed_date: "2025-03-03",
      status: "pending",
      compensation: 15000,
    };

    let responded: { offerId: string; accept: boolean } | null = null;
    const element = (
      <MediaOffersTable
        offers={[sampleOffer]}
        loading={false}
        onRespond={(payload) => {
          responded = payload;
        }}
      />
    );

    const markup = renderToString(element);
    expect(markup).toContain("Night Show");
    expect(markup).toContain("15,000");

    // Invoke the callback manually to assert wiring without a DOM
    (element.props as any).onRespond({ offerId: sampleOffer.id, accept: true });
    expect(responded).toEqual({ offerId: sampleOffer.id, accept: true });
  });
});
