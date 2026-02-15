import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Activities
export const getActivities = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("activities")
      .order("desc")
      .take(args.limit);
  },
});

// Tasks
export const getTasks = query({
  handler: async (ctx) => {
    return await ctx.db.query("tasks").order("desc").collect();
  },
});

export const addTask = mutation({
  args: {
    title: v.string(),
    status: v.string(),
    priority: v.string(),
    category: v.string(),
    reasoning: v.optional(v.string()),
    nextAction: v.optional(v.string()),
    effort: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", args);
  },
});

// Calendar
export const getCalendarEvents = query({
  handler: async (ctx) => {
    return await ctx.db.query("calendarEvents").collect();
  },
});

// Content
export const getContentDrafts = query({
  handler: async (ctx) => {
    return await ctx.db.query("contentDrafts").order("desc").collect();
  },
});
