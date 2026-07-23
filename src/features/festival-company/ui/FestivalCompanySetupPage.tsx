import { useParams } from "react-router-dom";
import { Tent } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { PageLoadingState } from "@/components/ui/page-state";
import { useFestivalFeatureFlags } from "../config/featureFlags";
import { mapFestivalSetupError } from "../domain/festivalSetup";
import { useFestivalCompanySetup } from "../application/useFestivalCompanySetup";
import { FestivalSetupSummary } from "./FestivalSetupSummary";
import { FestivalSetupState } from "./FestivalSetupState";

const FestivalCompanySetupPage = () => {
  const { festivalCompanyId } = useParams();
  const flags = useFestivalFeatureFlags();
  const featureEnabled = flags.newFestivalSystemEnabled;
  const setupQuery = useFestivalCompanySetup(festivalCompanyId, featureEnabled);

  if (!festivalCompanyId) {
    return <FMPageScaffold title="Festival setup unavailable" subtitle="Missing festival company." icon={Tent} backTo="/my-companies"><FestivalSetupState title="Unavailable" message="Festival setup is unavailable." /></FMPageScaffold>;
  }

  if (!featureEnabled) {
    return <FMPageScaffold title="Festival setup unavailable" subtitle="The festival rollout is currently disabled." icon={Tent} backTo="/my-companies"><FestivalSetupState title="Feature disabled" message={mapFestivalSetupError("festival_system_disabled")} /></FMPageScaffold>;
  }

  if (setupQuery.isLoading) {
    return <FMPageScaffold title="Loading festival setup" subtitle="Checking permissions and setup state." icon={Tent} backTo="/my-companies"><PageLoadingState title="Loading festival setup" description="Loading authorised festival company data." /></FMPageScaffold>;
  }

  if (setupQuery.isError || !setupQuery.data) {
    return <FMPageScaffold title="Festival setup unavailable" subtitle="We could not load this festival company." icon={Tent} backTo="/my-companies"><FestivalSetupState title="Unavailable" message={mapFestivalSetupError(setupQuery.error?.message)} /></FMPageScaffold>;
  }

  const setup = setupQuery.data;
  if (setup.companyStatus === "suspended" || setup.companyStatus === "bankrupt" || setup.companyStatus === "dissolved" || setup.isBankrupt || setup.setupStatus === "retired") {
    return <FMPageScaffold title={setup.publicName} subtitle="Setup is locked for this company." icon={Tent} backTo="/my-companies"><FestivalSetupSummary setup={setup} /><FestivalSetupState title="Setup locked" message="This festival company is suspended, bankrupt, dissolved or retired." /></FMPageScaffold>;
  }

  if (!setup.capabilities.festivalConfigurationEnabled) {
    return <FMPageScaffold title={setup.publicName} subtitle="Festival configuration is paused." icon={Tent} backTo="/my-companies"><FestivalSetupSummary setup={setup} /><FestivalSetupState title="Configuration unavailable" message="The setup shell is readable, but configuration submission is disabled by server rollout settings." /></FMPageScaffold>;
  }

  if (setup.setupCompleted) {
    return <FMPageScaffold title={setup.publicName} subtitle="Setup already completed." icon={Tent} backTo="/my-companies"><FestivalSetupSummary setup={setup} /><FestivalSetupState title="Setup complete" message="The full configuration console will be extended in the next festival PR." /></FMPageScaffold>;
  }

  return <FMPageScaffold title={setup.publicName} subtitle="Festival company setup foundation" icon={Tent} backTo="/my-companies"><FestivalSetupSummary setup={setup} /><FestivalSetupState title="Configuration wizard coming next" message="Secure setup loading is in place. Month, location, vibe, site type, duration and first edition creation remain non-goals for this PR." /></FMPageScaffold>;
};

export default FestivalCompanySetupPage;
