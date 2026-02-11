import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function isCodeAvailable(ctx: MutationCtx, code: string) {
  const existing = await ctx.db
    .query("rooms")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();

  return !existing;
}

/** Throws if the calling user is not the room host. */
async function requireAdmin(ctx: MutationCtx, roomId: string, userId: string) {
  const room = await ctx.db.get(roomId as any);
  if (!room) {
    throw new Error("Room not found.");
  }
  if (room.hostUserId !== userId) {
    throw new Error("Only the room host can perform this action.");
  }
  return room;
}

export const createRoom = mutation({
  args: {
    name: v.string(),
    hostUserId: v.string(),
    code: v.optional(v.string()),
    maxSongsPerUser: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let code = (args.code ?? generateRoomCode()).toUpperCase();

    if (args.code) {
      const available = await isCodeAvailable(ctx, code);
      if (!available) {
        throw new Error("Room code already in use.");
      }
    } else {
      let attempts = 0;
      while (!(await isCodeAvailable(ctx, code))) {
        attempts += 1;
        if (attempts > 5) {
          throw new Error("Unable to generate a unique room code.");
        }
        code = generateRoomCode();
      }
    }

    const roomId = await ctx.db.insert("rooms", {
      code,
      name: args.name,
      hostUserId: args.hostUserId,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      settings: {
        allowGuestAdd: true,
        allowDownvotes: true,
        maxQueueLength: 100,
        maxSongsPerUser: args.maxSongsPerUser ?? 5,
      },
    });

    return { roomId, code };
  },
});

export const getRoomByCode = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();
  },
});

// ── Admin-only mutations ────────────────────────────────────────────────

export const updateSettings = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    settings: v.object({
      allowGuestAdd: v.optional(v.boolean()),
      allowDownvotes: v.optional(v.boolean()),
      maxQueueLength: v.optional(v.number()),
      maxSongsPerUser: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const room = await requireAdmin(ctx, args.roomId, args.userId);

    const merged = { ...room.settings, ...args.settings };
    await ctx.db.patch(args.roomId, {
      settings: merged,
      updatedAt: Date.now(),
    });
  },
});

export const transferHost = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    newHostUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.roomId, args.userId);

    if (args.userId === args.newHostUserId) {
      throw new Error("You are already the host.");
    }

    await ctx.db.patch(args.roomId, {
      hostUserId: args.newHostUserId,
      updatedAt: Date.now(),
    });
  },
});

export const destroyRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.roomId, args.userId);

    // Delete all votes in the room
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    // Delete all songs in the room
    const songs = await ctx.db
      .query("songs")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const song of songs) {
      await ctx.db.delete(song._id);
    }

    // Delete the room itself
    await ctx.db.delete(args.roomId);
  },
});

// ── Admin-only mutations ────────────────────────────────────────────────

export const updateSettings = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    settings: v.object({
      allowGuestAdd: v.optional(v.boolean()),
      allowDownvotes: v.optional(v.boolean()),
      maxQueueLength: v.optional(v.number()),
      maxSongsPerUser: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const room = await requireAdmin(ctx, args.roomId, args.userId);

    const merged = { ...room.settings, ...args.settings };
    await ctx.db.patch(args.roomId, {
      settings: merged,
      updatedAt: Date.now(),
    });
  },
});

export const transferHost = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    newHostUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.roomId, args.userId);

    if (args.userId === args.newHostUserId) {
      throw new Error("You are already the host.");
    }

    await ctx.db.patch(args.roomId, {
      hostUserId: args.newHostUserId,
      updatedAt: Date.now(),
    });
  },
});

export const destroyRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.roomId, args.userId);

    // Delete all votes in the room
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_room_user", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    // Delete all songs in the room
    const songs = await ctx.db
      .query("songs")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const song of songs) {
      await ctx.db.delete(song._id);
    }

    // Delete the room itself
    await ctx.db.delete(args.roomId);
  },
});


export const advanceSong = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    // Get all songs in the queue, sorted
    const songs = await ctx.db
      .query("songs")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    songs.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.addedAt - b.addedAt;
    });

    if (songs.length === 0) {
      await ctx.db.patch(args.roomId, { currentSongId: undefined });
      return;
    }

    // Find the current song
    const room = await ctx.db.get(args.roomId);
    let nextSong;
    if (!room?.currentSongId) {
      nextSong = songs[0];
    } else {
      const idx = songs.findIndex((s) => s._id === room.currentSongId);
      nextSong = songs[idx + 1] || undefined;
    }

    await ctx.db.patch(args.roomId, {
      currentSongId: nextSong ? nextSong._id : undefined,
    });
  },
});