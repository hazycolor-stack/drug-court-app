// Sends Web Push messages using only Node's built-in crypto.
// Implements RFC 8291 (message encryption, aes128gcm) and RFC 8292 (VAPID).
// Files starting with "_" in /api are helpers, not public endpoints.
import crypto from "node:crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (s) => Buffer.from(s, "base64url");

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

// ---------- VAPID (proves the alert comes from our server) ----------
function vapidPrivateKey(publicKeyB64u, privateKeyB64u) {
  const pub = fromB64u(publicKeyB64u); // 65 bytes: 0x04 || X || Y
  return crypto.createPrivateKey({
    key: {
      kty: "EC", crv: "P-256",
      x: b64u(pub.subarray(1, 33)),
      y: b64u(pub.subarray(33, 65)),
      d: privateKeyB64u,
    },
    format: "jwk",
  });
}

function vapidHeader(endpoint, { publicKey, privateKey, subject }) {
  const aud = new URL(endpoint).origin;
  const header = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const unsigned = `${header}.${claims}`;
  const sig = crypto.sign("sha256", Buffer.from(unsigned), {
    key: vapidPrivateKey(publicKey, privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `vapid t=${unsigned}.${b64u(sig)}, k=${publicKey}`;
}

// ---------- Encryption (only the person's phone can read the alert) ----------
export function encryptPayload(plaintext, p256dhB64u, authB64u, { salt, ephemeral } = {}) {
  const uaPublic = fromB64u(p256dhB64u);
  const authSecret = fromB64u(authB64u);

  const as = ephemeral || crypto.createECDH("prime256v1");
  if (!ephemeral) as.generateKeys();
  const asPublic = as.getPublicKey();
  const ecdhSecret = as.computeSecret(uaPublic);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hmac(hmac(authSecret, ecdhSecret), Buffer.concat([keyInfo, Buffer.from([1])]));

  salt = salt || crypto.randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);

  const padded = Buffer.concat([Buffer.from(plaintext), Buffer.from([2])]); // 0x02 = last record
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, encrypted]);
}

// Returns the HTTP status from the push service (Apple / Google / Mozilla).
// 201 = delivered. 404 / 410 = that phone turned alerts off; delete it.
export async function sendPush(subscription, payload, vapid, { ttl = 24 * 3600, urgency = "high" } = {}) {
  const body = encryptPayload(JSON.stringify(payload), subscription.p256dh, subscription.auth);
  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidHeader(subscription.endpoint, vapid),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttl),
      Urgency: urgency,
    },
    body,
  });
  return res.status;
}
