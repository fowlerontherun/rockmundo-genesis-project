// Simplified friendships hook - disabled until friendship system is implemented
export const useFriendships = () => {
  return {
    friends: [],
    pendingRequests: [],
    sentRequests: [],
    onlineFriends: [],
    sendFriendRequest: async () => {},
    acceptFriendRequest: async () => {},
    declineFriendRequest: async () => {},
    removeFriend: async () => {},
    blockUser: async () => {},
    unblockUser: async () => {},
    isLoading: false,
    error: null
  };
};