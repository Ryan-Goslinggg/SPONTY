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
  likes: string[];
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
