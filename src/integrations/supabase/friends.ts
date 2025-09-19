// Simplified friend request integration - disabled until friendship system is implemented
export type SendFriendRequestParams = {
  senderProfileId: string;
  senderUserId: string;
  recipientProfileId: string;
  recipientUserId: string;
};

export const sendFriendRequest = async (_params: SendFriendRequestParams) => {
  // Friendship system not yet implemented - pretend the request succeeded
};
