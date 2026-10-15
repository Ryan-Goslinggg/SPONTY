export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place extends LatLng {
  name: string;
}

export interface User {
  id: string;
  name: string;
  handle: string;
  /** Soft background tint used for the avatar bubble. */
  tint: string;
  bio: string;
  hobbies: string[];
  location: Place;
}

export interface Post {
  id: string;
  authorId: string;
  place: Place;
  caption: string;
  photos: string[];
  createdAt: number;
  likeCount: number;
  likedByMe: boolean;
}

export type ReviewCategory = "food" | "spot";

export interface Review {
  id: string;
  authorId: string;
  placeName: string;
  category: ReviewCategory;
  rating: number;
  text: string;
  lat: number;
  lng: number;
  createdAt: number;
}

export interface Message {
  id: string;
  /** The friend this conversation is with. */
  threadId: string;
  fromId: string;
  text: string;
  createdAt: number;
}

/** Everything the app needs on first paint for the signed-in user. */
export interface Snapshot {
  me: User;
  /** Everyone referenced by the rest of the snapshot, including `me`. */
  users: User[];
  friends: string[];
  /** Newest first. */
  posts: Post[];
  /** Oldest first. Holds the latest message of each thread; full threads load on demand. */
  messages: Message[];
}

export interface MatchResult {
  id: string;
  score: number;
  reason: string;
}

export interface MatchCandidate {
  id: string;
  name: string;
  bio: string;
  hobbies: string[];
  location: Place;
}
