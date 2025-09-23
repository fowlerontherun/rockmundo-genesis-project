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
    type MockTravelRow = {
      id: string;
      city_from: string;
      city_to: string;
      cost: number;
      duration_minutes: number;
      health_impact: number;
    };

    const travelDataset: Record<string, MockTravelRow[]> = {
      travel_flights: [
        {
          id: "flight-neo-aster",
          city_from: sampleCity.id,
          city_to: "asterhaven-city-id",
          cost: 880,
          duration_minutes: 720,
          health_impact: 12,
        },
      ],
      travel_trains: [
        {
          id: "train-neo-solace",
          city_from: sampleCity.id,
          city_to: "solace-city-id",
          cost: 135,
          duration_minutes: 240,
          health_impact: 3,
        },
      ],
      travel_taxis: [
        {
          id: "taxi-neo-local",
          city_from: sampleCity.id,
          city_to: sampleCity.id,
          cost: 32,
          duration_minutes: 22,
          health_impact: 4,
        },
      ],
      travel_ferries: [],
    };

    const destinationCities = [
      { id: "asterhaven-city-id", name: "Asterhaven" },
      { id: "solace-city-id", name: "Solace City" },
      { id: sampleCity.id, name: sampleCity.name },
    ];

    mock.module("@/integrations/supabase/client", () => ({
      supabase: {
        from: (table: string) => ({
          select: () => ({
            eq: async (column: string, value: string) => {
              if (column === "city_from") {
                const matches = (travelDataset[table] ?? []).filter(
                  (entry) => entry.city_from === value,
                );
                return { data: matches, error: null };
              }
              return { data: [], error: null };
            },
            in: async (column: string, values: string[]) => {
              if (table === "cities" && column === "id") {
                const matches = destinationCities.filter((entry) => values.includes(entry.id));
                return { data: matches, error: null };
              }
              return { data: [], error: null };
            },
          }),
          insert: async () => ({ error: null }),
        }),
      },
    }));
    mock.module("@/hooks/useGameData", () => ({
      useGameData: () => ({
        profile: {
          id: "profile-1",
          health: 100,
          current_city_id: sampleCity.id,
        },
        skills: null,
        attributes: null,
        xpWallet: null,
        xpLedger: [],
        skillProgress: [],
        unlockedSkills: {},
        activities: [],
        dailyXpGrant: null,
        freshWeeklyBonusAvailable: false,
        currentCity: sampleCity,
        loading: false,
        error: null,
        refetch: async () => {},
        updateProfile: async () => ({
          id: "profile-1",
          health: 100,
          current_city_id: sampleCity.id,
        }),
        updateSkills: async () => null,
        updateXpWallet: async () => null,
        updateAttributes: async () => null,
        addActivity: async () => {},
        awardActionXp: async () => {},
        claimDailyXp: async () => {},
        spendAttributeXp: async () => {},
        spendSkillXp: async () => {},
        upsertProfileWithDefaults: async () => ({
          profile: {
            id: "profile-1",
            health: 100,
            current_city_id: sampleCity.id,
          },
          attributes: null,
        }),
      }),
    }));

    const { CityContent } = await import("../City");
    const { loadCityPageData } = await import("../city-data");

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

  it("normalizes seeded travel rows into booking options", async () => {
    const { __cityTravelTestUtils } = await import("../City");
    const { flattenTravelRows, groupTravelOptionsByMode } = __cityTravelTestUtils;

    const rows = [
      {
        id: "flight-neo-aster",
        mode: "flight",
        mode_label: "Flight",
        city_to: "asterhaven-city-id",
        destination_city_id: "asterhaven-city-id",
        destination_name: "Asterhaven",
        cost: 880,
        duration_minutes: 720,
        health_impact: 12,
        currency: "USD",
      },
    ];

    const options = flattenTravelRows(rows as Record<string, unknown>[]);
    const groups = groupTravelOptionsByMode(options);
    const flightGroup = groups.find((group) => group.mode === "flight");

    expect(flightGroup).toBeDefined();
    expect(flightGroup?.options.some((option) => option.destinationName === "Asterhaven")).toBe(true);
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
    mock.module("@/integrations/supabase/client", () => ({
      supabase: {
        from: () => ({
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
          insert: async () => ({ error: null }),
        }),
      },
    }));
    mock.module("@/hooks/useGameData", () => ({
      useGameData: () => ({
        profile: null,
        skills: null,
        attributes: null,
        xpWallet: null,
        xpLedger: [],
        skillProgress: [],
        unlockedSkills: {},
        activities: [],
        dailyXpGrant: null,
        freshWeeklyBonusAvailable: false,
        currentCity: null,
        loading: false,
        error: null,
        refetch: async () => {},
        updateProfile: async () => ({ id: "profile-1" }),
        updateSkills: async () => null,
        updateXpWallet: async () => null,
        updateAttributes: async () => null,
        addActivity: async () => {},
        awardActionXp: async () => {},
        claimDailyXp: async () => {},
        spendAttributeXp: async () => {},
        spendSkillXp: async () => {},
        upsertProfileWithDefaults: async () => ({
          profile: { id: "profile-1" },
          attributes: null,
        }),
      }),
    }));

    const { loadCityPageData, CITY_NOT_FOUND_ERROR } = await import("../city-data");

    await expect(loadCityPageData("missing-city"))
      .rejects.toThrow(CITY_NOT_FOUND_ERROR);
  });
});
