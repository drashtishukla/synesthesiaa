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
    addedByName: v.optional(v.string()),
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

    // Per-user song limit (0 = unlimited, admin bypasses)
    const isAdmin = args.addedBy === room.hostUserId;
    const limit = room.settings.maxSongsPerUser ?? 0;
    if (!isAdmin && limit > 0) {
      const userSongs = await ctx.db
        .query("songs")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .collect();
      const count = userSongs.filter((s) => s.addedBy === args.addedBy).length;
      if (count >= limit) {
        throw new Error(
          `You have reached the limit of ${limit} songs per user.`
        );
      }
    }

    const existing = await ctx.db
      .query("songs")
      .withIndex("by_room_provider", (q) =>
        q
          .eq("roomId", args.roomId)
          .eq("provider", args.provider)
          .eq("providerId", args.providerId)
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    return ctx.db.insert("songs", {
      roomId: args.roomId,
      provider: args.provider,
      providerId: args.providerId,
      title: args.title,
      artist: args.artist,
      albumArtUrl: args.albumArtUrl,
      durationMs: args.durationMs,
      addedBy: args.addedBy,
      addedByName: args.addedByName ?? "Anonymous",
      addedAt: now,
      score: 0,
      lastScoreUpdatedAt: now,
    });
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
      return a.addedAt - b.addedAt;
    });

    return songs;
  },
});

export const removeSong = mutation({
  args: {
    songId: v.id("songs"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const song = await ctx.db.get(args.songId);
    if (!song) {
      throw new Error("Song not found.");
    }

    const room = await ctx.db.get(song.roomId);
    if (!room) {
      throw new Error("Room not found.");
    }

    const isAdmin = args.userId === room.hostUserId;
    const isOwner = args.userId === song.addedBy;
    if (!isAdmin && !isOwner) {
      throw new Error("Only the host or the person who added this song can remove it.");
    }

    // Cascade-delete all votes for this song
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_song_user", (q) => q.eq("songId", args.songId))
      .collect();
    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    await ctx.db.delete(args.songId);
  },
});

export const adminSetScore = mutation({
  args: {
    songId: v.id("songs"),
    userId: v.string(),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    const song = await ctx.db.get(args.songId);
    if (!song) {
      throw new Error("Song not found.");
    }

    const room = await ctx.db.get(song.roomId);
    if (!room) {
      throw new Error("Room not found.");
    }

    if (args.userId !== room.hostUserId) {
      throw new Error("Only the room host can set scores.");
    }

    await ctx.db.patch(args.songId, {
      score: args.score,
      lastScoreUpdatedAt: Date.now(),
    });

    return args.score;
  },
});
