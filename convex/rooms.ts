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

export const createRoom = mutation({
  args: {
    name: v.string(),
    hostUserId: v.string(),
    code: v.optional(v.string()),
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
