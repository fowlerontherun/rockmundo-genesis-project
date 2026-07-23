export interface FestivalCompanyCapabilities {
  newFestivalSystemEnabled: boolean;
  festivalCompanyCreationEnabled: boolean;
  festivalCompanyManagementEnabled: boolean;
  festivalConfigurationEnabled: boolean;
  companyLimit: number;
}

export const disabledFestivalCompanyCapabilities: FestivalCompanyCapabilities = {
  newFestivalSystemEnabled: false,
  festivalCompanyCreationEnabled: false,
  festivalCompanyManagementEnabled: false,
  festivalConfigurationEnabled: false,
  companyLimit: 3,
};

const isIntegerAtLeastZero = (value: unknown) => Number.isInteger(value) && Number(value) >= 0;

export const parseFestivalCompanyCapabilities = (value: unknown): FestivalCompanyCapabilities => {
  if (!value || typeof value !== "object") return disabledFestivalCompanyCapabilities;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.newFestivalSystemEnabled !== "boolean"
    || typeof candidate.festivalCompanyCreationEnabled !== "boolean"
    || typeof candidate.festivalCompanyManagementEnabled !== "boolean"
    || typeof candidate.festivalConfigurationEnabled !== "boolean"
    || !isIntegerAtLeastZero(candidate.companyLimit)) {
    return disabledFestivalCompanyCapabilities;
  }
  return candidate as unknown as FestivalCompanyCapabilities;
};
