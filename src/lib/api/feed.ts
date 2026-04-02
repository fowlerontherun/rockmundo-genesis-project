import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

export type ReactionType = "like" | "love" | "fire" | "wow" | "laugh";

const REACTION_TYPES: ReactionType[] = ["like", "love", "fire", "wow", "laugh"];
const DEFAULT_PAGE_SIZE = 15;

const isReactionType = (value: string | null | undefined): value is ReactionType =>
  value !== null && value !== undefined && REACTION_TYPES.includes(value as ReactionType);

export type CommunityPostRecord = Tables<"community_posts">;
export type CommunityPostReactionRecord = Tables<"community_post_reactions">;

type CommunityPostAuthor = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type CommunityPostQueryRow = CommunityPostRecord & {
  author: CommunityPostAuthor | null;
  reactions: CommunityPostReactionRecord[] | null;
};

export interface CommunityFeedPost extends CommunityPostRecord {
  author: CommunityPostAuthor | null;
  reactions: CommunityPostReactionRecord[];
  reactionCounts: Record<ReactionType, number>;
  totalReactions: number;
  viewerReaction: ReactionType | null;
}

export interface FetchCommunityFeedParams {
  limit?: number;
  cursor?: string | null;
  viewerId?: string | null;
}

export interface CommunityFeedPage {
  posts: CommunityFeedPost[];
  nextCursor: string | null;
}

export interface CreateCommunityPostInput {
  authorId: string;
  content: string;
  mediaUrl?: string | null;
}

export interface ToggleCommunityReactionInput {
  postId: string;
  profileId: string;
  reactionType: ReactionType;
}

const mapQueryRowToFeedPost = (
  row: CommunityPostQueryRow,
  viewerId?: string | null,
): CommunityFeedPost => {
  const reactions = row.reactions ?? [];
  const reactionCounts: Record<ReactionType, number> = {
    like: 0,
    love: 0,
    fire: 0,
    wow: 0,
    laugh: 0,
  };

  for (const reaction of reactions) {
    if (!reaction || !isReactionType(reaction.reaction_type)) continue;
    const type = reaction.reaction_type;
    reactionCounts[type] += 1;
  }

  const viewerReaction = viewerId
    ? reactions.find((reaction) => reaction.profile_id === viewerId && isReactionType(reaction.reaction_type))
        ?.reaction_type ?? null
    : null;

  return {
    ...row,
    reactions,
    author: row.author,
    reactionCounts,
    totalReactions: reactions.length,
    viewerReaction,
  };
};

const withAuthorAndReactionsSelect = `
  id,
  author_id,
  content,
  media_url,
  created_at,
  updated_at,
  author:profiles (
    id,
    username,
    display_name,
    avatar_url
  ),
  reactions:community_post_reactions (
    id,
    post_id,
    profile_id,
    reaction_type,
    created_at,
    updated_at
  )
`;

export const fetchCommunityFeed = async (
  params: FetchCommunityFeedParams = {},
): Promise<CommunityFeedPage> => {
  const { limit = DEFAULT_PAGE_SIZE, cursor, viewerId } = params;

  let query = supabase
    .from("community_posts")
    .select(withAuthorAndReactionsSelect)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CommunityPostQueryRow[];
  const hasMore = rows.length > limit;
  const limitedRows = hasMore ? rows.slice(0, limit) : rows;
  const posts = limitedRows.map((row) => mapQueryRowToFeedPost(row, viewerId));
  const lastRow = limitedRows[limitedRows.length - 1];
  const nextCursor = hasMore && lastRow ? lastRow.created_at : null;

  return {
    posts,
    nextCursor,
  };
};

export const fetchCommunityPost = async (
  postId: string,
  viewerId?: string | null,
): Promise<CommunityFeedPost | null> => {
  const { data, error } = await supabase
    .from("community_posts")
    .select(withAuthorAndReactionsSelect)
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapQueryRowToFeedPost(data as CommunityPostQueryRow, viewerId);
};

export const createCommunityPost = async (
  input: CreateCommunityPostInput,
  viewerId?: string | null,
): Promise<CommunityFeedPost> => {
  const { authorId, content, mediaUrl = null } = input;
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    throw new Error("Post content cannot be empty.");
  }

  if (trimmedContent.length > 500) {
    throw new Error("Post content exceeds the 500 character limit.");
  }

  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      author_id: authorId,
      content: trimmedContent,
      media_url: mediaUrl,
    })
    .select(withAuthorAndReactionsSelect)
    .single();

  if (error) {
    throw error;
  }

  return mapQueryRowToFeedPost(data as CommunityPostQueryRow, viewerId ?? authorId);
};

export const toggleCommunityReaction = async (
  input: ToggleCommunityReactionInput,
  viewerId?: string | null,
): Promise<CommunityFeedPost | null> => {
  const { postId, profileId, reactionType } = input;

  const { data: existingReaction, error: selectError } = await supabase
    .from("community_post_reactions")
    .select("*")
    .eq("post_id", postId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existingReaction) {
    if (existingReaction.reaction_type === reactionType) {
      const { error: deleteError } = await supabase
        .from("community_post_reactions")
        .delete()
        .eq("id", existingReaction.id);

      if (deleteError) {
        throw deleteError;
      }
    } else {
      const { error: updateError } = await supabase
        .from("community_post_reactions")
        .update({ reaction_type: reactionType })
        .eq("id", existingReaction.id);

      if (updateError) {
        throw updateError;
      }
    }
  } else {
    const { error: insertError } = await supabase
      .from("community_post_reactions")
      .insert({
        post_id: postId,
        profile_id: profileId,
        reaction_type: reactionType,
      });

    if (insertError) {
      throw insertError;
    }
  }

  return fetchCommunityPost(postId, viewerId ?? profileId);
};

