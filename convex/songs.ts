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
      addedByName: args.addedByName ?? "Anonymous",
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

/** Host-only: reorder a song by setting its score relative to its neighbors. */
export const reorderSong = mutation({
  args: {
    songId: v.id("songs"),
    userId: v.string(),
    newIndex: v.number(), // 0-based target position in the sorted queue
  },
  handler: async (ctx, args) => {
    const song = await ctx.db.get(args.songId);
    if (!song) throw new Error("Song not found.");

    const room = await ctx.db.get(song.roomId);
    if (!room) throw new Error("Room not found.");
    if (args.userId !== room.hostUserId) {
      throw new Error("Only the room host can reorder songs.");
    }

    // Get current queue in display order
    const songs = await ctx.db
      .query("songs")
      .withIndex("by_room", (q) => q.eq("roomId", song.roomId))
      .collect();
    songs.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.lastScoreUpdatedAt - b.lastScoreUpdatedAt;
    });

    const idx = Math.max(0, Math.min(args.newIndex, songs.length - 1));

    // Calculate a score that places the song at the target index
    let newScore: number;
    const now = Date.now();
    if (songs.length <= 1) {
      newScore = 0;
    } else if (idx === 0) {
      newScore = songs[0]._id === args.songId ? songs[0].score : songs[0].score + 1;
    } else if (idx >= songs.length - 1) {
      const last = songs[songs.length - 1];
      newScore = last._id === args.songId ? last.score : last.score - 1;
    } else {
      // Place between neighbors
      const above = songs[idx - 1]._id === args.songId ? songs[idx] : songs[idx - 1];
      const below = songs[idx + 1]?._id === args.songId ? songs[idx] : songs[idx + 1] ?? songs[idx];
      newScore = Math.round((above.score + below.score) / 2);
      // If scores collide, bump above
      if (newScore === above.score) newScore = above.score;
    }

    await ctx.db.patch(args.songId, {
      score: newScore,
      lastScoreUpdatedAt: now,
    });
  },
});
