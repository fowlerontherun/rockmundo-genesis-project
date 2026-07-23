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
