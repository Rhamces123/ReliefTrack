import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as sgMail from "@sendgrid/mail";

admin.initializeApp();

// Initialize SendGrid - key from functions config or env
const sendgridKey = (functions.config() as any)?.sendgrid?.key || process.env.SENDGRID_API_KEY;
if (sendgridKey) {
  sgMail.setApiKey(sendgridKey);
}

function parseUserAgent(ua: string): string {
  if (!ua) return "Unknown device";
  // simple parse
  let browser = "Unknown Browser";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";
  let os = "Unknown OS";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  return `${browser} on ${os}`;
}

async function geolocate(ip: string): Promise<{ city: string; country: string }> {
  if (!ip || ip === "unknown" || ip.startsWith("127.") || ip.startsWith("::1")) {
    return { city: "Unknown", country: "Philippines" };
  }
  // Strip IPv6 prefix ::ffff:
  const cleanIp = ip.replace(/^::ffff:/, "");
  try {
    const res = await fetch(`https://ipinfo.io/${cleanIp}/json`);
    if (!res.ok) throw new Error("geo failed");
    const data: any = await res.json();
    return { city: data.city || "Unknown", country: data.country || "PH" };
  } catch {
    return { city: "Unknown", country: "Philippines" };
  }
}

async function sendAlertEmail(
  to: string,
  data: { name: string; device: string; city: string; country: string; time: string; ip: string }
): Promise<void> {
  if (!sendgridKey) {
    console.warn("SendGrid key not configured, skipping email");
    return;
  }
  const from = "relieftrack@gmail.com";
  const subject = `🔐 New Device Login - ReliefTrack - ${data.time} (PHT)`;
  const text = `Hello ${data.name},

A new device just signed into your ReliefTrack account:

Device: ${data.device}
Location: ${data.city}, ${data.country}
Time: ${data.time} (Philippines Time - Asia/Manila)
IP: ${data.ip}

If this wasn't you, please secure your account immediately:
- Change your password in the app Settings
- Review your login history

If this was you, you can ignore this email. This device will be remembered as trusted.

— ReliefTrack Security`;

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px">
    <h2 style="color:#1e293b">🔐 New Device Login</h2>
    <p>Hello <strong>${data.name}</strong>,</p>
    <p>A new device just signed into your <strong>ReliefTrack</strong> account:</p>
    <table style="width:100%;background:white;border-radius:8px;padding:16px;border:1px solid #e2e8f0">
      <tr><td style="padding:8px;color:#64748b">📱 Device</td><td style="padding:8px;font-weight:600">${data.device}</td></tr>
      <tr><td style="padding:8px;color:#64748b">📍 Location</td><td style="padding:8px;font-weight:600">${data.city}, ${data.country}</td></tr>
      <tr><td style="padding:8px;color:#64748b">🕐 Time</td><td style="padding:8px;font-weight:600">${data.time} (PHT)</td></tr>
      <tr><td style="padding:8px;color:#64748b">🌐 IP</td><td style="padding:8px;font-family:monospace">${data.ip}</td></tr>
    </table>
    <div style="margin-top:20px;padding:16px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca">
      <strong style="color:#dc2626">If this wasn't you:</strong>
      <p style="margin:8px 0 0">Change your password immediately in the app Settings and review your login history.</p>
    </div>
    <p style="color:#64748b;font-size:12px;margin-top:20px">If this was you, you can ignore this email. This device will be remembered.</p>
    <p style="color:#94a3b8;font-size:12px">— ReliefTrack Security</p>
  </div>`;

  await sgMail.send({ to, from, subject, text, html });
}

export const registerDevice = functions
  .region("asia-southeast1")
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = context.auth.uid;
    const ipRaw = (context.rawRequest as any)?.ip || (context.rawRequest.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "unknown";
    const { fingerprintHash, userAgent } = data || {};
    if (!fingerprintHash || typeof fingerprintHash !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "fingerprintHash required");
    }

    const userDoc = await admin.firestore().doc(`users/${uid}`).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User profile not found");
    }
    const userEmail: string = userDoc.get("email");
    const displayName: string = userDoc.get("displayName") || userEmail?.split("@")[0] || "User";
    if (!userEmail) throw new functions.https.HttpsError("failed-precondition", "User has no email");

    // Check known devices
    const devicesRef = admin.firestore().collection(`users/${uid}/knownDevices`);
    const snap = await devicesRef.where("fingerprintHash", "==", fingerprintHash).limit(1).get();

    const now = admin.firestore.Timestamp.now();
    let isNewDevice = false;
    let deviceId = "";

    if (snap.empty) {
      isNewDevice = true;
      const geo = await geolocate(ipRaw);
      // Only Philippines-focused, but keep country for display
      const deviceRef = devicesRef.doc();
      deviceId = deviceRef.id;
      await deviceRef.set({
        fingerprintHash,
        userAgent: userAgent || "",
        ip: ipRaw,
        city: geo.city,
        country: geo.country,
        firstSeen: now,
        lastSeen: now,
        isTrusted: false,
      });

      const phTime = now.toDate().toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Try send email, but don't fail the whole call if email fails (log only)
      try {
        await sendAlertEmail(userEmail, {
          name: displayName,
          device: parseUserAgent(userAgent || ""),
          city: geo.city,
          country: geo.country,
          time: phTime,
          ip: ipRaw,
        });
      } catch (e) {
        console.error("SendGrid email failed:", e);
      }
    } else {
      const doc = snap.docs[0];
      deviceId = doc.id;
      await doc.ref.update({ lastSeen: now, userAgent: userAgent || doc.get("userAgent") });
    }

    await admin.firestore().collection(`users/${uid}/loginHistory`).add({
      timestamp: now,
      deviceId,
      isNewDevice,
      emailSent: isNewDevice,
      ip: ipRaw,
    });

    return { isNewDevice, deviceId };
  });
