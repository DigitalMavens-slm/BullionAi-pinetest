/*
 * seed-admin.js
 *
 * Creates (or updates) a single admin user in the users store
 * (PostgreSQL when DATABASE_URL is set, JSON otherwise).
 *
 * Usage: node scripts/seed-admin.js <email> <password> [name] [segments]
 *        node scripts/seed-admin.js admin@bullionai.in Secret123 "BullionAI Admin" MCX,NSE,BSE
 */

require("dotenv").config();
const crypto = require("crypto");
const db = require("../src/auth/db");

async function main() {
    const [emailArg, passwordArg, nameArg, segArg] = process.argv.slice(2);
    const email = String(emailArg || "").trim().toLowerCase();
    const password = String(passwordArg || "");
    const name = String(nameArg || "").trim() || email.split("@")[0];
    const segments = String(segArg || "MCX,NSE,BSE").split(",").map(s => s.trim().toUpperCase()).filter(Boolean);

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        console.error("Usage: node scripts/seed-admin.js <email> <password> [name] [segments]");
        process.exit(1);
    }
    if (password.length < 6) {
        console.error("Password must be at least 6 characters.");
        process.exit(1);
    }

    const engine = (await db.init()).engine;
    const existing = await db.findUserByEmail(email);

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
    const createdAt = existing?.createdAt || new Date().toISOString();

    await db.createUser({
        email,
        name,
        mobile: existing?.mobile || "",
        segments,
        isAdmin: true,
        plan: "full",
        salt,
        passwordHash,
        createdAt,
    });

    const u = await db.findUserByEmail(email);
    console.log(`[seed-admin] engine=${engine}`);
    console.log(`  admin ready: ${u.email} (isAdmin=${u.isAdmin}, plan=${u.plan})`);
    console.log("  Log in at /login with this email + password.");
    process.exit(0);
}

main().catch(err => {
    console.error("[seed-admin] failed:", err?.message || err);
    process.exit(1);
});
