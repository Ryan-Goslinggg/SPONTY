import { z } from "zod";

/** Validation for everything the browser sends. Limits mirror the UI and the database checks. */

export const PlaceInput = z.object({
  name: z.string().trim().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const LatLngInput = PlaceInput.pick({ lat: true, lng: true });

export const IdInput = z.string().min(1).max(64);

export const ProfilePatchInput = z
  .object({
    name: z.string().trim().min(1).max(60),
    bio: z.string().trim().max(300),
    hobbies: z.array(z.string().trim().min(1).max(40)).max(20),
    location: PlaceInput,
  })
  .partial();
export type ProfilePatch = z.infer<typeof ProfilePatchInput>;

export const MAX_PHOTOS = 4;

export const PostInput = z
  .object({
    place: PlaceInput,
    caption: z.string().trim().max(500),
    // Ownership of each photo URL is checked against storage by the caller.
    photos: z.array(z.string().min(1).max(500)).max(MAX_PHOTOS),
  })
  .refine((p) => p.caption.length > 0 || p.photos.length > 0, "A post needs a caption or a photo");
export type PostInput = z.infer<typeof PostInput>;

export const MessageInput = z.object({
  friendId: IdInput,
  text: z.string().trim().min(1).max(1000),
});

export const ReviewInput = z.object({
  placeName: z.string().trim().min(1).max(80),
  category: z.enum(["food", "spot"]),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(1).max(400),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type ReviewInput = z.infer<typeof ReviewInput>;
