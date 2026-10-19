import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(relativePath), "utf8");

describe("Shareable Moments migrated entrypoint contracts", () => {
  it("keeps every automatic contextual prompt button-first", () => {
    const promptCallers = [
      "src/components/crafting/CraftedItemReveal.tsx",
      "src/pages/PlayerProfile.tsx",
      "src/components/band/BandOverview.tsx",
      "src/components/SkillTree.tsx",
      "src/pages/TourManager.tsx",
      "src/components/charts/MyChartPositions.tsx",
      "src/components/gig/GigOutcomeReport.tsx",
      "src/components/releases/MyReleasesTab.tsx",
      "src/components/streaming/StreamingMyReleasesTab.tsx",
    ];

    for (const caller of promptCallers) {
      const source = read(caller);
      expect(source, caller).toContain("shouldOfferSharePrompt(");
      expect(source, caller).toContain("promptOnly: true");
      expect(source, caller).not.toContain("markSharePromptSeen(");
    }
  });

  it("keeps Share Studio persistently visible across desktop and mobile navigation", () => {
    const dashboard = read("src/pages/Dashboard.tsx");
    const fmNavigation = read("src/config/fmNavigation.ts");
    const mobileFab = read("src/mobile/shell/FabMenu.tsx");
    const hubNavigation = read("src/config/hubNavigation.ts");
    const socialHub = read("src/pages/SocialHub.tsx");

    expect(dashboard).toContain('to="/social/share-studio"');
    expect(dashboard).toContain(">Share</Button>");
    expect(fmNavigation).toContain('{ label: "Share Studio", path: "/social/share-studio", icon: Share2');
    expect(mobileFab).toContain('key: "share"');
    expect(mobileFab).toContain('to: "/social/share-studio"');
    expect(hubNavigation).toContain('id: "share-studio"');
    expect(socialHub).toContain('to="/social/share-studio"');
    expect(socialHub).toContain('label: "Share Studio", path: "/social/share-studio"');
  });

  it("reopens avatar-capable gallery cards through the retry-capable renderer", () => {
    const source = read("src/pages/ShareStudio.tsx");
    expect(source).toContain('{selected && shouldCaptureGalleryAvatar(selected, primaryBand?.bands?.id)');
    expect(source).not.toContain("selected && !selected.avatar");
  });

  it("does not mount AvatarShareStudio without a character promo", () => {
    const source = read("src/pages/ShareStudio.tsx");
    expect(source).toContain("{characterPromo && <AvatarShareStudio");
    expect(source).not.toContain("<AvatarShareStudio moment={characterPromo} open={!!characterPromo}");
  });

  it("keeps Dashboard achievement sharing on AvatarShareStudio", () => {
    const source = read("src/pages/Dashboard.tsx");
    expect(source).toContain('from "@/features/shareable-moments/CharacterShareStudio"');
    expect(source).toContain("Share milestone");
    expect(source).toContain('type: "achievement"');
    expect(source).toContain("<AvatarShareStudio");
  });

  it("keeps chart sharing avatar-aware with a button-first #1 prompt", () => {
    const source = read("src/components/charts/MyChartPositions.tsx");
    expect(source).toContain('from "@/features/shareable-moments/CharacterShareStudio"');
    expect(source).toContain('promptOnly: true');
    expect(source).toContain('promptKind: "chart-number-one"');
    expect(source).toContain('promptLabel: "Share #1 milestone"');
    expect(source).toContain("Share chart result");
    expect(source).toContain("<AvatarShareStudio");
  });

  it("routes Share Studio gig creation to the mounted gig picker and avatar-aware export", () => {
    const studio = read("src/pages/ShareStudio.tsx");
    const advanced = read("src/pages/AdvancedGigSystem.tsx");
    const schedule = read("src/pages/Schedule.tsx");
    const app = read("src/App.tsx");
    expect(app).toContain('<Route path="gigs/advanced/:gigId" element={<AdvancedGigSystem />} />');
    expect(studio).toContain('path: "/gigs/advanced/upcoming?shareCreate=gig"');
    expect(advanced).toContain('<Tabs defaultValue={gigId === "upcoming" ? "upcoming" : "offers"}');
    expect(advanced).toContain('{shareMoment && <AvatarShareStudio');
    expect(advanced).toContain('<AvatarShareStudio moment={shareMoment}');
    expect(schedule).toContain('to="/gigs/advanced/upcoming?shareCreate=gig"');
  });

  it("includes the active player avatar in source-page gig, band and release posters", () => {
    const gig = read("src/components/schedule/GigDetailsDialog.tsx");
    const band = read("src/pages/BandProfile.tsx");
    const releases = read("src/components/releases/MyReleasesTab.tsx");
    expect(gig).toContain("{shareMoment && <AvatarShareStudio");
    expect(band).toContain("band.band_members?.some(member => member.profile_id === profileId)");
    expect(band).toContain("<AvatarShareStudio moment={shareMoment}");
    expect(releases).toContain("{promoMoment && <AvatarShareStudio");
    expect(releases).toContain("{shareMoment && <AvatarShareStudio");
  });

  it("uses the real player avatar in musician-owned milestone and festival share images", () => {
    const ownedEntrypoints = [
      "src/components/crafting/CraftedItemReveal.tsx",
      "src/components/SkillTree.tsx",
      "src/components/streaming/StreamingMyReleasesTab.tsx",
      "src/components/band/BandOverview.tsx",
      "src/pages/AdvancedGigSystem.tsx",
    ];
    for (const sourceFile of ownedEntrypoints) {
      const source = read(sourceFile);
      expect(source, sourceFile).toContain('from "@/features/shareable-moments/CharacterShareStudio"'.replaceAll('"', sourceFile.includes('BandOverview') ? "'" : '"'));
      expect(source, sourceFile).toContain("<AvatarShareStudio");
      expect(source, sourceFile).not.toContain("<ShareMomentSheet");
    }
    // Public spectator graphics should not silently display the viewer's character.
    const publicFestival = read("src/features/festival-company/ui/PublicFestivalPage.tsx");
    expect(publicFestival).toContain("<ShareMomentSheet");
  });

  it("defers automatic avatar capture until prompt acceptance", () => {
    const avatar = read("src/features/shareable-moments/CharacterShareStudio.tsx");
    const sheet = read("src/features/shareable-moments/ShareMomentSheet.tsx");
    expect(avatar).toContain('const captureEnabled = !moment.promptOnly || promptAccepted');
    expect(avatar).toContain('onPromptAccepted={() => setPromptAccepted(true)}');
    expect(sheet).toContain('onPromptAccepted?.()');
  });

  it("renders band recruitment invitation art with the recruiter's character avatar", () => {
    const source = read("src/components/band/InviteFriendToBand.tsx");
    expect(source).toContain("type: 'band_profile'");
    expect(source).toContain("BAND RECRUITMENT");
    expect(source).toContain("<AvatarShareStudio moment={shareMoment}");
    expect(source).not.toContain("<ShareMomentSheet moment={shareMoment}");
  });

  it("keeps release milestones button-first and avatar-aware", () => {
    const source = read("src/components/releases/MyReleasesTab.tsx");
    expect(source).toContain('from "@/features/shareable-moments/CharacterShareStudio"');
    expect(source).toContain('promptOnly: true');
    expect(source).toContain('promptKind: "release-revenue-milestone"');
    expect(source).toContain('promptLabel: "Share release milestone"');
    expect(source).toContain('type: "release"');
    expect(source).toContain("{milestoneMoment && <AvatarShareStudio");
  });
});
