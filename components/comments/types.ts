export interface Comment {
  id: string;
  postSlug: string;
  userId: string;
  username: string;
  name?: string;
  profilePic?: string;
  content: string;
  parentCommentId: string | null;
  status: "approved" | "hidden";
  isPinned?: boolean;
  isSpoiler?: boolean;
  createdAt: string;
  updatedAt: string | null;
}
