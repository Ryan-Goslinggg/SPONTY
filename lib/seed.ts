import type { Message, Post, Review, User } from "./types";

export const ME_ID = "u_me";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Seed timestamps are relative to first launch so the demo always looks fresh. */
export function createSeed(now = Date.now()) {
  const users: User[] = [
    {
      id: ME_ID,
      name: "You",
      handle: "you",
      tint: "#c8e8d2",
      bio: "Spontaneous weekend explorer. Always hunting for hole-in-the-wall food and quiet sunset spots.",
      hobbies: ["Food trips", "Hiking", "Photography"],
      location: { name: "Manila", lat: 14.5995, lng: 120.9842 },
    },
    {
      id: "u_mika",
      name: "Mika Santos",
      handle: "mikawanders",
      tint: "#fde2e4",
      bio: "Coffee first, then adventure. I photograph street food and the people who make it.",
      hobbies: ["Coffee", "Photography", "Street food"],
      location: { name: "Poblacion, Makati", lat: 14.5649, lng: 121.03 },
    },
    {
      id: "u_paolo",
      name: "Paolo Reyes",
      handle: "paolosurfs",
      tint: "#dbeafe",
      bio: "Surfing in La Union on weekends, climbing mountains when the waves are flat.",
      hobbies: ["Surfing", "Hiking", "Camping"],
      location: { name: "BGC, Taguig", lat: 14.5509, lng: 121.0509 },
    },
    {
      id: "u_andrea",
      name: "Andrea Lim",
      handle: "andreaexplores",
      tint: "#fef3c7",
      bio: "History nerd. I can spend a whole day in a museum and then find the best kopi nearby.",
      hobbies: ["Museums", "History", "Coffee"],
      location: { name: "Quezon City", lat: 14.676, lng: 121.0437 },
    },
    {
      id: "u_jules",
      name: "Jules Garcia",
      handle: "julesg",
      tint: "#ede9fe",
      bio: "Walking food tours around old Manila. Ask me where to get the best siopao.",
      hobbies: ["Food trips", "History", "Walking tours"],
      location: { name: "Intramuros, Manila", lat: 14.5896, lng: 120.9747 },
    },
    {
      id: "u_bea",
      name: "Bea Villanueva",
      handle: "beaoutdoors",
      tint: "#d1fae5",
      bio: "Mountain hiker and camper. Sunrise chaser with a film camera.",
      hobbies: ["Hiking", "Camping", "Photography"],
      location: { name: "Baguio", lat: 16.4023, lng: 120.596 },
    },
    {
      id: "u_carlo",
      name: "Carlo Mendoza",
      handle: "carlodives",
      tint: "#cffafe",
      bio: "Scuba diver and island hopper. The ocean is my office.",
      hobbies: ["Diving", "Island hopping", "Beaches"],
      location: { name: "Cebu City", lat: 10.3157, lng: 123.8854 },
    },
    {
      id: "u_nina",
      name: "Nina Cruz",
      handle: "ninacafe",
      tint: "#fce7f3",
      bio: "Cafe hopping, art galleries and taking photos of pretty storefronts in Makati.",
      hobbies: ["Cafe hopping", "Art", "Photography"],
      location: { name: "Legazpi Village, Makati", lat: 14.5534, lng: 121.0164 },
    },
    {
      id: "u_tess",
      name: "Tess Aquino",
      handle: "tesseats",
      tint: "#ffedd5",
      bio: "Night market regular. I will travel 2 hours for a good bowl of street food.",
      hobbies: ["Street food", "Food trips", "Night markets"],
      location: { name: "Binondo, Manila", lat: 14.6, lng: 120.974 },
    },
    {
      id: "u_rafa",
      name: "Rafa Domingo",
      handle: "rafaplays",
      tint: "#e0e7ff",
      bio: "Mostly indoors playing games and watching anime, trying to go out more.",
      hobbies: ["Gaming", "Anime"],
      location: { name: "Pasig", lat: 14.5764, lng: 121.0851 },
    },
    {
      id: "u_leo",
      name: "Leo Navarro",
      handle: "leorides",
      tint: "#ecfccb",
      bio: "Long bike rides to Tagaytay for coffee and the view of Taal.",
      hobbies: ["Cycling", "Coffee", "Hiking"],
      location: { name: "Tagaytay", lat: 14.1153, lng: 120.9621 },
    },
  ];

  const friends = ["u_mika", "u_paolo", "u_andrea", "u_jules"];

  const photo = (id: number) => `https://picsum.photos/id/${id}/900/700`;

  const posts: Post[] = [
    {
      id: "p1",
      authorId: "u_mika",
      place: { name: "Poblacion, Makati", lat: 14.5649, lng: 121.03 },
      caption: "Unplanned food crawl turned into the best night of the month. That tiny ramen bar on the corner? Go.",
      photos: [photo(1047), photo(292)],
      createdAt: now - 3 * HOUR,
      likes: ["u_paolo", "u_jules"],
    },
    {
      id: "p2",
      authorId: "u_bea",
      place: { name: "Mt. Ulap, Benguet", lat: 16.3, lng: 120.63 },
      caption: "Woke up at 3am for this sea of clouds. Worth every step.",
      photos: [photo(1018)],
      createdAt: now - 9 * HOUR,
      likes: ["u_leo"],
    },
    {
      id: "p3",
      authorId: "u_paolo",
      place: { name: "San Juan, La Union", lat: 16.6696, lng: 120.3214 },
      caption: "Flat waves, so we hiked to the falls instead. Spontaneous plan B always wins.",
      photos: [photo(16), photo(1039), photo(28)],
      createdAt: now - 1 * DAY,
      likes: ["u_mika", ME_ID],
    },
    {
      id: "p4",
      authorId: "u_carlo",
      place: { name: "Moalboal, Cebu", lat: 9.9396, lng: 123.3699 },
      caption: "Sardine run this morning. Millions of them, ten meters from the shore.",
      photos: [photo(1050)],
      createdAt: now - 2 * DAY,
      likes: [],
    },
    {
      id: "p5",
      authorId: "u_jules",
      place: { name: "Intramuros, Manila", lat: 14.5896, lng: 120.9747 },
      caption: "Calesa ride, then halo-halo in a 100 year old building. Old Manila never gets old.",
      photos: [photo(1059)],
      createdAt: now - 3 * DAY,
      likes: ["u_andrea", "u_tess"],
    },
    {
      id: "p6",
      authorId: "u_leo",
      place: { name: "Tagaytay Ridge", lat: 14.1153, lng: 120.9621 },
      caption: "60km on the bike for one cup of coffee and this view of Taal.",
      photos: [photo(1015)],
      createdAt: now - 4 * DAY,
      likes: ["u_bea"],
    },
  ];

  const R = (
    id: string,
    authorId: string,
    placeName: string,
    category: Review["category"],
    rating: number,
    text: string,
    lat: number,
    lng: number,
    daysAgo: number,
  ): Review => ({ id, authorId, placeName, category, rating, text, lat, lng, createdAt: now - daysAgo * DAY });

  const reviews: Review[] = [
    // Poblacion, Makati cluster
    R("r1", "u_mika", "Corner ramen bar", "food", 5, "Tiny 8-seat bar, rich tonkotsu, and the owner remembers your name.", 14.5652, 121.0297, 2),
    R("r2", "u_nina", "Kalye coffee", "food", 4, "Quiet in the mornings. The sea salt latte is a must.", 14.5644, 121.0309, 5),
    R("r3", "u_tess", "Midnight isaw stall", "food", 5, "Only opens after 10pm. Grilled isaw with spicy vinegar, 15 pesos a stick.", 14.5659, 121.0291, 8),
    R("r4", "u_paolo", "Rooftop above the bookstore", "spot", 4, "Free to go up if you buy a book. Great skyline at sunset.", 14.5641, 121.0315, 12),
    R("r5", "u_rafa", "Retro arcade", "spot", 3, "Small but has working old cabinets. Gets crowded on Fridays.", 14.5664, 121.0306, 20),
    // Intramuros cluster
    R("r6", "u_jules", "Old house halo-halo", "food", 5, "Served in a 100-year-old bahay na bato. Generous leche flan on top.", 14.5893, 120.975, 3),
    R("r7", "u_andrea", "Baluarte walls at dusk", "spot", 5, "Walk the walls around 5:30pm, golden light and almost no one around.", 14.5903, 120.9738, 6),
    R("r8", "u_tess", "Carinderia by the gate", "food", 4, "Home-style adobo and sinigang, cheap and filling.", 14.5888, 120.9756, 9),
    // Binondo cluster
    R("r9", "u_tess", "Dumpling alley", "food", 5, "Pan-fried dumplings, crispy bottoms. Cash only, line moves fast.", 14.6004, 120.9744, 1),
    R("r10", "u_jules", "Hidden tea house", "food", 4, "Second floor, no sign. Ask for the oolong and the egg tart.", 14.5997, 120.9733, 4),
    R("r11", "u_mika", "Estero food street", "food", 4, "Chaotic and loud in the best way. Try the fried siopao.", 14.6009, 120.9752, 15),
    // BGC cluster
    R("r12", "u_paolo", "Pocket park garden", "spot", 4, "Shady benches between the towers, nice for reading.", 14.5512, 121.0505, 7),
    R("r13", "u_nina", "Gallery cafe", "food", 4, "Rotating local art on the walls and good pour-over.", 14.5505, 121.0515, 10),
  ];

  const messages: Message[] = [
    { id: "m1", threadId: "u_mika", fromId: "u_mika", text: "Ramen tonight? I found a new place in Poblacion", createdAt: now - 2 * HOUR },
    { id: "m2", threadId: "u_mika", fromId: ME_ID, text: "Yes!! What time?", createdAt: now - 2 * HOUR + 5 * 60_000 },
    { id: "m3", threadId: "u_mika", fromId: "u_mika", text: "8pm, I'll drop the pin on Find", createdAt: now - 2 * HOUR + 8 * 60_000 },
    { id: "m4", threadId: "u_paolo", fromId: "u_paolo", text: "Elyu this weekend? Waves look good", createdAt: now - 1 * DAY },
    { id: "m5", threadId: "u_jules", fromId: ME_ID, text: "That halo-halo place was amazing, thanks", createdAt: now - 3 * DAY },
    { id: "m6", threadId: "u_jules", fromId: "u_jules", text: "Told you! Next stop Binondo", createdAt: now - 3 * DAY + HOUR },
  ];

  return { users, friends, posts, reviews, messages };
}

export type SeedState = ReturnType<typeof createSeed>;
