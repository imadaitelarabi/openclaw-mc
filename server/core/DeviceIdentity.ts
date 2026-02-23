import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const CONFIG_DIR = path.join(process.env.HOME || "/root", ".oc-mission-control");
const IDENTITY_PATH = path.join(CONFIG_DIR, "device-identity.json");
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

type StoredIdentity = {
  version: 1;
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
  createdAtMs: number;
};

export type DeviceIdentity = {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
};

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const key = crypto.createPublicKey(publicKeyPem);
  const der = key.export({ type: "spki", format: "der" }) as Buffer;
  if (!der.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
    throw new Error("Unsupported public key format");
  }
  return der.subarray(ED25519_SPKI_PREFIX.length);
}

function fingerprintPublicKey(publicKeyPem: string): string {
  const raw = derivePublicKeyRaw(publicKeyPem);
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateIdentity(): DeviceIdentity {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const deviceId = fingerprintPublicKey(publicKeyPem);
  return { deviceId, publicKeyPem, privateKeyPem };
}

function normalizeIdentity(stored: StoredIdentity): DeviceIdentity {
  const expectedDeviceId = fingerprintPublicKey(stored.publicKeyPem);
  if (stored.deviceId === expectedDeviceId) {
    return stored;
  }
  return {
    deviceId: expectedDeviceId,
    publicKeyPem: stored.publicKeyPem,
    privateKeyPem: stored.privateKeyPem,
  };
}

export function loadOrCreateDeviceIdentity(filePath: string = IDENTITY_PATH): DeviceIdentity {
  ensureConfigDir();
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as StoredIdentity;
      if (parsed?.publicKeyPem && parsed?.privateKeyPem && parsed?.deviceId) {
        const identity = normalizeIdentity(parsed);
        if (identity.deviceId !== parsed.deviceId) {
          const updated: StoredIdentity = {
            version: 1,
            ...identity,
            createdAtMs: Date.now(),
          };
          fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
        }
        return identity;
      }
    }
  } catch {
  }

  const identity = generateIdentity();
  const stored: StoredIdentity = {
    version: 1,
    ...identity,
    createdAtMs: Date.now(),
  };
  fs.writeFileSync(filePath, JSON.stringify(stored, null, 2));
  return identity;
}

export function publicKeyRawBase64UrlFromPem(publicKeyPem: string): string {
  return base64UrlEncode(derivePublicKeyRaw(publicKeyPem));
}

export function signDevicePayload(privateKeyPem: string, payload: string): string {
  const key = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(payload, "utf8"), key);
  return base64UrlEncode(signature);
}

export function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
}): string {
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  return [
    "v2",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
  ].join("|");
}