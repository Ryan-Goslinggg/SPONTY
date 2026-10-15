/** Events pushed to the browser over /api/events. Produced by database triggers. */
export type RealtimeEvent =
  | {
      type: "message";
      message: { id: string; senderId: string; recipientId: string; text: string; createdAt: number };
    }
  | { type: "friend"; friendId: string };
