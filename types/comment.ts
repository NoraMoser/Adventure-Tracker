
export interface CommentUser {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
}

export interface Comment {
  id: string;
  text: string;
  created_at: string;
  reply_to_id?: string;
  user: CommentUser;
}