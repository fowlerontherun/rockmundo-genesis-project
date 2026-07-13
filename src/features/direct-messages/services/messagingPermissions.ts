export type MessagingPreference = "everyone" | "friends" | "none" | "existing_conversations" | "friends_and_band";

export interface MessagingPermissionContext {
  senderProfileId?: string | null;
  recipientProfileId?: string | null;
  recipientPreference?: MessagingPreference | null;
  areFriends?: boolean;
  shareBand?: boolean;
  shareCompany?: boolean;
  hasExistingConversation?: boolean;
  blocked?: boolean;
  senderSuspended?: boolean;
  recipientSuspended?: boolean;
}

export interface MessagingPermissionResult {
  allowed: boolean;
  reason: "allowed" | "same_player" | "missing_profile" | "player_unavailable" | "blocked_or_restricted" | "preference_restricted";
  userMessage: string;
}

const neutralRestriction = "Messaging is unavailable for this conversation.";

export class MessagingPermissionService {
  canStartConversation(context: MessagingPermissionContext): MessagingPermissionResult {
    return this.evaluate(context, false);
  }

  canSendMessage(context: MessagingPermissionContext): MessagingPermissionResult {
    return this.evaluate(context, true);
  }

  canReadConversation(isParticipant: boolean): MessagingPermissionResult {
    return isParticipant
      ? { allowed: true, reason: "allowed", userMessage: "Conversation is available." }
      : { allowed: false, reason: "blocked_or_restricted", userMessage: neutralRestriction };
  }

  canUploadAttachment(context: MessagingPermissionContext): MessagingPermissionResult {
    return this.canSendMessage(context);
  }

  canReportMessage(isParticipant: boolean): MessagingPermissionResult {
    return this.canReadConversation(isParticipant);
  }

  canArchiveConversation(isParticipant: boolean): MessagingPermissionResult {
    return this.canReadConversation(isParticipant);
  }

  canLeaveConversation(isParticipant: boolean): MessagingPermissionResult {
    return this.canReadConversation(isParticipant);
  }

  private evaluate(context: MessagingPermissionContext, continuation: boolean): MessagingPermissionResult {
    if (!context.senderProfileId || !context.recipientProfileId) {
      return { allowed: false, reason: "missing_profile", userMessage: "Choose a valid player to message." };
    }
    if (context.senderProfileId === context.recipientProfileId) {
      return { allowed: false, reason: "same_player", userMessage: "Choose another player to message." };
    }
    if (context.senderSuspended || context.recipientSuspended) {
      return { allowed: false, reason: "player_unavailable", userMessage: neutralRestriction };
    }
    if (context.blocked) {
      return { allowed: false, reason: "blocked_or_restricted", userMessage: neutralRestriction };
    }
    const preference = context.recipientPreference ?? "friends";
    const relationshipAllowed = Boolean(context.areFriends || context.shareBand || context.shareCompany);
    const existingAllowed = continuation && Boolean(context.hasExistingConversation);
    if (preference === "everyone" || relationshipAllowed || existingAllowed) {
      return { allowed: true, reason: "allowed", userMessage: "Messaging is available." };
    }
    return { allowed: false, reason: "preference_restricted", userMessage: neutralRestriction };
  }
}

export const messagingPermissionService = new MessagingPermissionService();
