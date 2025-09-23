import { afterEach, describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";

import type { City as CityRecord, CityEnvironmentDetails } from "@/utils/worldEnvironment";

const buildSnapshot = (city: CityRecord) => ({
  weather: [],
  cities: [city],
  worldEvents: [],
  randomEvents: [],
});

afterEach(() => {
  mock.restore();
});

describe("City page", () => {
  const sampleCity: CityRecord = {
    id: "luna-bay",
    name: "Luna Bay",
    country: "Auroria",
    description: "A glittering coastal metropolis where neon tides meet starry skies.",
    profileDescription: "Producers flock here for the midnight skyline and late-night sessions.",
    bonuses: undefined,
    unlocked: true,
    population: 4_200_000,
    music_scene: 82,
    cost_of_living: 68,
    dominant_genre: "Dream Pop",
    venues: 145,
    local_bonus: 1.3,
    busking_value: 1.1,
    cultural_events: ["Luna Lights Festival", "Harbor Sessions"],
    locations: [],
    venueHighlights: [
      {
        name: "Nebula Hall",
        description: "A futuristic amphitheater pulsing with immersive holographic shows.",
        district: "Skylight Quarter",
        capacity: "8,000",
      },
      {
        name: "Harborline Pavilion",
        description: "Floating stage that anchors the bay's weekend concert series.",
        district: "Harbor Promenade",
        capacity: "5,500",
      },
    ],
    studioProfiles: [
      {
        name: "Satellite Sound Lab",
        specialties: ["Analog synth design", "Mastering", "Immersive mixing"],
        neighborhood: "Artisan Wharf",
      },
    ],
    transportLinks: [
      {
        type: "rail",
        name: "Luna Central Terminal",
        description: "Express rail hub linking Auroria's creative capitals.",
        distance: "5 minute walk",
      },
      {
        type: "air",
        name: "Luna International",
        description: "Direct overnight flights to every major touring market.",
        distance: "25 minute aero-shuttle",
      },
    ],
    famousResident: "DJ Celeste",
    travelHub: "Luna Transit Nexus",
    travelOptions: [],
    distanceKm: null,
  };

  const sampleDetails: CityEnvironmentDetails = {
    cityId: sampleCity.id,
    cityName: sampleCity.name,
    country: sampleCity.country,
    metadata: {
      id: "luna-bay-metadata",
      cityId: sampleCity.id,
      summary: "A port city that blends interstellar tourism with avant-garde nightlife.",
      famousResident: "DJ Celeste",
      signatureSound: "Neon Chillwave",
      metroArea: "Greater Luna",
      timezone: "UTC+2",
      aliases: ["City of Lights"],
      locations: [],
      travelModes: [],
      updatedAt: new Date().toISOString(),
    },
    locations: [],
    travelModes: [],
    players: [],
    gigs: [],
  };

  it("renders fetched city data when utilities resolve", async () => {
    const snapshotMock = mock(async () => buildSnapshot(sampleCity));
    const detailsMock = mock(async () => sampleDetails);

    mock.module("@/utils/worldEnvironment", () => ({
      fetchWorldEnvironmentSnapshot: snapshotMock,
      fetchCityEnvironmentDetails: detailsMock,
    }));

    const { CityContent, loadCityPageData } = await import("../City");

    const result = await loadCityPageData(sampleCity.id);

    expect(snapshotMock.mock.calls.length).toBe(1);
    expect(detailsMock.mock.calls.length).toBe(1);
    expect(result.city.name).toBe("Luna Bay");
    expect(result.details).not.toBeNull();

    const markup = renderToStaticMarkup(
      <StaticRouter location={`/cities/${sampleCity.id}`}>
        <CityContent
          city={result.city}
          details={result.details}
          detailsLoading={false}
          loading={false}
          error={null}
          detailsError={result.detailsError}
          onRetry={() => {}}
        />
      </StaticRouter>,
    );

    expect(markup).toContain("Luna Bay");
    expect(markup).toContain("Nebula Hall");
    expect(markup).toContain("Satellite Sound Lab");
    expect(markup).toContain("Luna Central Terminal");
    expect(markup).toContain("Luna Lights Festival");
    expect(markup).toContain("Back to cities");
    expect(markup).toContain("href=\"/cities\"");
  });

  it("throws a descriptive error when a city cannot be found", async () => {
    mock.module("@/utils/worldEnvironment", () => ({
      fetchWorldEnvironmentSnapshot: mock(async () => ({
        weather: [],
        cities: [],
        worldEvents: [],
        randomEvents: [],
      })),
      fetchCityEnvironmentDetails: mock(async () => sampleDetails),
    }));

    const { loadCityPageData, CITY_NOT_FOUND_ERROR } = await import("../City");

    await expect(loadCityPageData("missing-city"))
      .rejects.toThrow(CITY_NOT_FOUND_ERROR);
  });
});
