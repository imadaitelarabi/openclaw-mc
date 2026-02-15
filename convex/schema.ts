import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  activities: defineTable({
    type: v.string(), // 'system', 'agent', 'task', 'comms'
    message: v.string(),
    timestamp: v.number(),
    status: v.optional(v.string()), // 'success', 'error', 'pending'
  }),
  calendarEvents: defineTable({
    title: v.string(),
    start: v.number(),
    end: v.number(),
    type: v.string(), // 'task', 'meeting', 'reminder'
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  }),
  tasks: defineTable({
    title: v.string(),
    status: v.string(), // 'pending', 'active', 'completed', 'cancelled'
    priority: v.string(), // 'low', 'medium', 'high', 'critical'
    category: v.string(),
    reasoning: v.optional(v.string()),
    nextAction: v.optional(v.string()),
    effort: v.optional(v.string()),
    dueDate: v.optional(v.number()),
  }),
  contacts: defineTable({
    name: v.string(),
    status: v.string(), // 'prospect', 'contacted', 'meeting', 'proposal', 'active'
    lastInteraction: v.number(),
    nextAction: v.optional(v.string()),
    notes: v.optional(v.string()),
  }),
  contentDrafts: defineTable({
    title: v.string(),
    platform: v.string(),
    text: v.string(),
    status: v.string(), // 'draft', 'review', 'approved', 'published'
    createdAt: v.number(),
  }),
  ecosystemProducts: defineTable({
    name: v.string(),
    slug: v.string(),
    status: v.string(), // 'active', 'development', 'concept'
    metrics: v.optional(v.any()),
    description: v.optional(v.string()),
  }),
});
