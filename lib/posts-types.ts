import type { ResolvedVideo } from "@/lib/video-link-resolver";

export interface PostUser {
  id: string;
  username: string;
  name: string | null;
  profilePic: string | null;
  role: string | null;
  isVerified: boolean | null;
}

export interface Post {
  id: number;
  userId: string;
  content: string;
  likesCount: number;
  repostsCount: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  user: PostUser | null;
  liked?: boolean;
  reposted?: boolean;
  isOwner?: boolean;
  story?: PostStory | null;
  /**
   * Video links found in `content`, resolved server-side and keyed by the
   * exact URL substring as it appears in the text. `PostCard` swaps the bare
   * URL for an inline player when there's a hit here.
   *
   * Resolution has to happen in the API route: our own `/videos/<id>` links
   * need a DB read, and every consumer of these posts is a client component.
   */
  videos?: Record<string, ResolvedVideo>;
}

export interface PostStory {
  slug: string;
  title: string;
  cover: string | null;
}

export interface PostComment {
  id: string;
  postId: number;
  userId: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  user: PostUser | null;
}