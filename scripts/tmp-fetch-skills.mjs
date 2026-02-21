#!/usr/bin/env node
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const gatewayUrl = process.env.GATEWAY_URL;
const token = process.env.GATEWAY_TOKEN;
const agentId = process.env.SKILLS_AGENT_ID;

if (!gatewayUrl || !token) {
  console.error(
    "Usage: GATEWAY_URL=ws://host:port GATEWAY_TOKEN=token node scripts/tmp-fetch-skills.mjs"
  );
  process.exit(1);
}

const pending = new Map();
let connectRequestId = null;
let remaining = 0;

function sendRequest(ws, method, params = {}) {
  const id = uuidv4();
  pending.set(id, method);
  ws.send(JSON.stringify({ type: "req", id, method, params }));
  return id;
}

function scheduleClose(ws) {
  if (remaining <= 0) {
    setTimeout(() => ws.close(), 200);
  }
}

const ws = new WebSocket(gatewayUrl);

ws.on("open", () => {
  console.log(`[skills-test] connected to ${gatewayUrl}`);
});

ws.on("message", (data) => {
  let msg;
  try {
    msg = JSON.parse(data.toString());
  } catch (err) {
    console.error("[skills-test] invalid JSON", err);
    return;
  }

  if (msg.type === "event" && msg.event === "connect.challenge") {
    connectRequestId = uuidv4();
    ws.send(
      JSON.stringify({
        type: "req",
        id: connectRequestId,
        method: "connect",
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: "skills-test",
            version: "0.0.1",
            platform: process.platform,
            mode: "script",
            instanceId: uuidv4(),
          },
          role: "operator",
          scopes: ["operator.read"],
          auth: { token },
          caps: [],
          userAgent: "skills-test/0.0.1",
          locale: "en-US",
        },
      })
    );
    return;
  }

  if (msg.type === "res" && msg.id === connectRequestId) {
    if (!msg.ok) {
      console.error("[skills-test] connect failed", msg.error);
      process.exit(1);
    }
    console.log("[skills-test] gateway connect ok");

    const statusParams = agentId ? { agentId } : {};
    remaining = 2;
    sendRequest(ws, "skills.status", statusParams);
    sendRequest(ws, "skills.bins", {});
    return;
  }

  if (msg.type === "res" && msg.id) {
    const method = pending.get(msg.id) || "unknown";
    pending.delete(msg.id);
    remaining -= 1;

    if (msg.ok) {
      console.log(`\n[${method}] response:`);
      console.log(JSON.stringify(msg.payload, null, 2));
    } else {
      console.error(`\n[${method}] error:`, msg.error);
    }

    scheduleClose(ws);
  }
});

ws.on("close", () => {
  console.log("[skills-test] closed");
});

ws.on("error", (err) => {
  console.error("[skills-test] error", err);
});
