/**
 * Configuration Manager
 * Manages Gateway configurations and persistence
 */

import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import type { ServerConfig, GatewayConfig } from "../types/internal";

const CONFIG_DIR = path.join(process.env.HOME || "/root", ".oc-mission-control");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export class ConfigManager {
  private config: ServerConfig;

  constructor() {
    this.config = { gateways: [], activeGatewayId: null };
    this.ensureConfigDir();
    this.load();
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
  }

  load(): void {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const data = fs.readFileSync(CONFIG_PATH, "utf8");
        this.config = JSON.parse(data);
      } else {
        // Migration/Initial setup from ENV
        const envUrl = process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";
        const envToken = process.env.OPENCLAW_GATEWAY_TOKEN;
        if (envToken) {
          const id = uuidv4();
          this.config.gateways.push({
            id,
            name: "Local Gateway",
            url: envUrl.replace(/^http/, "ws"),
            token: envToken,
            isLocal: true,
          });
          this.config.activeGatewayId = id;
          this.save();
        }
      }
    } catch (err) {
      console.error("[Config] Failed to load config:", err);
    }
  }

  save(): void {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
    } catch (err) {
      console.error("[Config] Failed to save config:", err);
    }
  }

  getGateways(): GatewayConfig[] {
    return this.config.gateways.map((g) => ({ ...g, token: "********" }));
  }

  getActiveGateway(): GatewayConfig | undefined {
    return this.config.gateways.find((g) => g.id === this.config.activeGatewayId);
  }

  getActiveGatewayId(): string | null {
    return this.config.activeGatewayId;
  }

  addGateway(name: string, url: string, token: string): GatewayConfig {
    const id = uuidv4();
    const newGateway: GatewayConfig = {
      id,
      name,
      url: url.replace(/^http/, "ws"),
      token,
      isLocal: false,
    };
    this.config.gateways.push(newGateway);
    this.config.activeGatewayId = id;
    this.save();
    return newGateway;
  }

  switchGateway(id: string): boolean {
    if (this.config.gateways.find((g) => g.id === id)) {
      this.config.activeGatewayId = id;
      this.save();
      return true;
    }
    return false;
  }

  removeGateway(id: string): void {
    this.config.gateways = this.config.gateways.filter((g) => g.id !== id);
    if (this.config.activeGatewayId === id) {
      this.config.activeGatewayId = this.config.gateways[0]?.id || null;
    }
    this.save();
  }
}
