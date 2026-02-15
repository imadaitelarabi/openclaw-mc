import { mutation } from "./_generated/server";

export const seed = mutation({
  handler: async (ctx) => {
    // Activities
    await ctx.db.insert("activities", {
      type: "system",
      message: "OpenClaw Gateway started",
      timestamp: Date.now() - 3600000,
      status: "success",
    });
    await ctx.db.insert("activities", {
      type: "agent",
      message: "Atlas spawned sub-agent for research",
      timestamp: Date.now() - 1800000,
    });

    // Tasks
    await ctx.db.insert("tasks", {
      title: "Migrate Organization logic to DB-first",
      status: "active",
      priority: "high",
      category: "Product",
      reasoning: "Keycloak token dependency is causing latency.",
      nextAction: "Review middleware/jit_access.go",
      effort: "Medium",
    });

    // Calendar
    await ctx.db.insert("calendarEvents", {
      title: "Weekly Sync",
      start: Date.now() + 86400000,
      end: Date.now() + 86400000 + 3600000,
      type: "meeting",
      color: "#3b82f6",
    });

    // Content
    await ctx.db.insert("contentDrafts", {
      title: "The Future of Autonomous Agents",
      platform: "X/Twitter",
      text: "Agents are not just tools, they are team members...",
      status: "draft",
      createdAt: Date.now(),
    });

    // Ecosystem
    await ctx.db.insert("ecosystemProducts", {
      name: "Xenith AI",
      slug: "xenith-ai",
      status: "active",
      description: "Enterprise agent coordination platform.",
    });
  },
});
