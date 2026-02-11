import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addSong = mutation({
  args: {
    roomId: v.id("rooms"),
    provider: v.union(v.literal("youtube"), v.literal("custom")),
    providerId: v.string(),
    title: v.string(),
    artist: v.optional(v.string()),
    albumArtUrl: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    addedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const room = await ctx.db.get(args.roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (!room.settings.allowGuestAdd && args.addedBy !== room.hostUserId) {
      throw new Error("Guests cannot add songs in this room.");
    }

    const existing = await ctx.db
      .query("songs")
      .withIndex("by_room_provider", (q) =>
        q
          .eq("roomId", args.roomId)
          .eq("provider", args.provider)
          .eq("providerId", args.providerId),
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    const songId = await ctx.db.insert("songs", {
      roomId: args.roomId,
      provider: args.provider,
      providerId: args.providerId,
      title: args.title,
      artist: args.artist,
      albumArtUrl: args.albumArtUrl,
      durationMs: args.durationMs,
      addedBy: args.addedBy,
      addedAt: now,
      score: 0,
      lastScoreUpdatedAt: now,
    });
    // If this is the first song in the queue, set it as currentSongId in the room
    const queue = await ctx.db
      .query("songs")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    if (queue.length === 1) {
      await ctx.db.patch(args.roomId, { currentSongId: songId });
    }
    return songId;
  },
});

export const listQueue = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const songs = await ctx.db
      .query("songs")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    songs.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      // Same score: the song that reached this score first comes first
      return a.lastScoreUpdatedAt - b.lastScoreUpdatedAt;
    });

    return songs;
  },
});

export const removeSong = mutation({
  args: {
    songId: v.id("songs"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.songId);
  },
});
