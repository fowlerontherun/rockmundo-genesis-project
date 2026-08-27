import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve("src/mobile/pages/MobileSocial.tsx"), "utf8");
const mobileChat = fs.readFileSync(path.resolve("src/mobile/components/MobileInstantChat.tsx"), "utf8");
const desktopChat = fs.readFileSync(path.resolve("src/components/fm/chat/FMChatDock.tsx"), "utf8");
const roomView = fs.readFileSync(path.resolve("src/components/fm/chat/ChatRoomView.tsx"), "utf8");

describe("Mobile Social companion contract", () => {
  it("keeps quick communication flows on mobile", () => {
    for (const route of ["/mobile/social/chat", "/mobile/social/messages", "/mobile/social/friends", "/mobile/social/twaater", "/mobile/social/notifications"]) {
      expect(source).toContain(route);
    }
    expect(source).toContain("useDirectMessages");
    expect(source).toContain("useFriendships");
    expect(source).toContain("useNotificationsFeed");
    expect(source).toContain("useUnifiedInbox");
  });

  it("uses one Inbox surface for game messages, outcomes and alerts", () => {
    expect(source).toContain('["notifications", "Inbox", "/mobile/social/notifications"]');
    expect(source).toContain('title="Inbox"');
    expect(source).toContain("Game messages, activity outcomes and alerts in one place.");
    expect(source).toContain("inbox.messages.map");
    expect(source).toContain("inbox.markAllAsRead");
    expect(source).not.toContain('title="Notifications"');
  });

  it("mirrors the current desktop instant-chat rooms instead of the legacy dashboard chat", () => {
    expect(source).toContain('import { MobileInstantChat } from "../components/MobileInstantChat"');
    expect(source).not.toContain("ChatChannelSelector");
    expect(source).not.toContain("useVipStatus");
    expect(source).toContain("World, Help, Recruit, Band and Friends");
    expect(source).toContain('if (section === "chat") return <ChatPage/>');

    for (const room of ["world", "help", "recruit", "band", "friends"]) {
      expect(mobileChat).toContain(`id: \"${room}\" as RoomId`);
      expect(desktopChat).toContain(`id: \"${room}\" as RoomId`);
    }

    expect(mobileChat).toContain('channelKey="world"');
    expect(mobileChat).toContain('channelKey="help"');
    expect(mobileChat).toContain('channelKey="recruit"');
    expect(mobileChat).toContain('channelKey={bandId ? `band:${bandId}` : null}');
    expect(desktopChat).toContain('channelKey={bandId ? `band:${bandId}` : null}');
    expect(mobileChat).toContain('import { ChatRoomView } from "@/components/fm/chat/ChatRoomView"');
    expect(roomView).toContain('import { useChatRoom } from "./useChatRoom"');
    expect(mobileChat).toContain('navigate(`/mobile/social/conversation/${other.id}`)');
  });

  it("uses authoritative conversation and public-profile services", () => {
    expect(source).toContain('import { listConversations } from "@/features/direct-messages/services/conversations"');
    expect(source).toContain('import { getPublicProfileDetail } from "@/services/publicProfileDetail"');
    expect(source).toContain("listConversations({ limit: 50 })");
    expect(source).toContain("getPublicProfileDetail(id, profileId)");
    expect(source).not.toContain('.from("direct_messages")');
    expect(source).not.toContain('.from("profiles")');
  });

  it("only exposes incoming pending requests as actionable requests", () => {
    expect(source).toContain('x.friendship?.status === "pending" && x.friendship?.addressee_id === profileId');
    expect(source).toContain("No incoming friend requests");
  });

  it("routes notification actions through the shared companion resolver", () => {
    expect(source).toContain('import { resolveCompanionPath } from "@/mobile/routeRegistry"');
    expect(source).toContain("navigate(resolveCompanionPath(n.action_path))");
    expect(source).toContain("navigate(resolveCompanionPath(route))");
    expect(source).not.toContain("location.assign(");
  });

  it("shows explicit failure and empty states rather than blank mobile panels", () => {
    expect(source).toContain("Friends could not be loaded.");
    expect(source).toContain("Conversations could not be loaded.");
    expect(source).toContain("Inbox could not be loaded.");
    expect(source).toContain("Inbox is clear");
    expect(source).toContain("No public posts");
  });

  it("keeps long-form mail management behind a desktop boundary", () => {
    expect(source).toContain("Desktop-only communication");
    expect(source).toContain("Long-form mail management stays on desktop");
    expect(source).toContain("Compose, archive, flag and attachment-heavy mail workflows are desktop-only");
  });
});
