/*
 * =========================================================
 * EMAIL AUTH — users store + password hashing + tokens
 *
 * Hashing : scryptSync(password, salt, 64)
 * Tokens  : base64url(payload).hmac-sha256 signature,
 *           secret auto-generated at data/bullionai-auth-secret.txt
 *
 * Storage : PostgreSQL when DATABASE_URL is set (see ./db),
 *           otherwise a JSON file data/bullionai-users.json.
 * =========================================================
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const db = require("./db");

const SECRET_FILE = path.resolve(
    process.cwd(),
    "data",
    "bullionai-auth-secret.txt"
);

const TRIAL_DAYS = 14;

const TOKEN_TTL_MS =
    7 * 24 * 60 * 60 * 1000; // 7 days


// ---------------------------------------------------------
// SECRET
// ---------------------------------------------------------

function getSecret() {

    try {
        return fs.readFileSync(
            SECRET_FILE,
            "utf8"
        ).trim();
    } catch {
        // generate once
    }

    const secret =
        crypto.randomBytes(48)
            .toString("hex");

    fs.mkdirSync(
        path.dirname(SECRET_FILE),
        { recursive: true }
    );

    fs.writeFileSync(
        SECRET_FILE,
        secret,
        "utf8"
    );

    return secret;

}


// ---------------------------------------------------------
// EMAIL VALIDATION
// ---------------------------------------------------------

function normalizeEmail(email) {

    return String(email || "")
        .trim()
        .toLowerCase();

}

function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);
}

function normalizeMobile(mobile) {

    return String(mobile || "")
        .replace(/\s+/g, "")
        .trim();

}

function isValidMobile(mobile) {

    const m = normalizeMobile(mobile);

    // allow +91XXXXXXXXXX, 0XXXXXXXXXX, or 10 digits (India) — 10-15 digits total
    return /^(\+?\d{1,3})?\d{10}$/.test(m) && m.replace(/\D/g, "").length >= 10;

}


const VALID_SEGMENTS = new Set([
    "MCX",
    "NSE",
    "BSE",
]);

// Admin bootstrap: emails listed in ADMIN_EMAILS env are always admins
function getAdminEmails() {
    const raw =
        process.env.ADMIN_EMAILS ||
        process.env.ADMIN_EMAIL ||
        "";
    return new Set(
        String(raw)
            .split(",")
            .map(s =>
                normalizeEmail(s.trim())
            )
            .filter(Boolean)
    );
}

function isAdminEmail(email) {
    const norm = normalizeEmail(email);
    if (getAdminEmails().has(norm)) return Promise.resolve(true);
    // also check DB flag
    return db.findUserByEmail(norm)
        .then(u => Boolean(u && u.isAdmin))
        .catch(() => false);
}


function normalizeSegments(input) {

    const raw =
        Array.isArray(input)
            ? input
            : input
              ? [input]
              : [];

    const out = [];

    for (const s of raw) {

        const up =
            String(s || "")
                .trim()
                .toUpperCase();

        if (
            VALID_SEGMENTS.has(up) &&
            !out.includes(up)
        ) {
            out.push(up);
        }

    }

    return out;

}


// ---------------------------------------------------------
// PASSWORDS
// ---------------------------------------------------------

function hashPassword(
    password,
    salt
) {

    return crypto.scryptSync(
        String(password),
        salt,
        64
    ).toString("hex");

}

function verifyPassword(
    password,
    salt,
    expectedHash
) {

    const actual =
        Buffer.from(
            hashPassword(
                password,
                salt
            ),
            "hex"
        );

    const expected =
        Buffer.from(
            expectedHash,
            "hex"
        );

    return actual.length ===
        expected.length &&
        crypto.timingSafeEqual(
            actual,
            expected
        );

}


// ---------------------------------------------------------
// REGISTER / LOGIN
// ---------------------------------------------------------

function registerUser({
    email,
    password,
    name,
    segments,
    mobile,
}) {

    const norm =
        normalizeEmail(email);

    if (!isValidEmail(norm)) {
        throw new Error(
            "Invalid email address."
        );
    }

    if (
        !password ||
        String(password).length < 6
    ) {
        throw new Error(
            "Password must be at least 6 characters."
        );
    }

    const segs =
        normalizeSegments(segments);

    if (
        segs.length === 0
    ) {
        throw new Error(
            "Select at least one segment (MCX, NSE, BSE)."
        );
    }

    const mob =
        normalizeMobile(mobile);

    if (!mob) {
        throw new Error(
            "Mobile number is required."
        );
    }

    if (!isValidMobile(mob)) {
        throw new Error(
            "Invalid mobile number. Use 10 digits."
        );
    }


    // Async-safe duplicate check via DB best-effort.
    return (async () => {
        const found = await db.findUserByEmail(norm);
        if (found) {
            throw new Error(
                "An account with this email already exists."
            );
        }

        const salt =
            crypto.randomBytes(16)
                .toString("hex");

        const seedEmails = getAdminEmails();

        const list = await db.listUsers();
        const isFirstUser = list.length === 0;
        const shouldBeAdmin =
            isFirstUser ||
            seedEmails.has(norm);

        const createdAt =
            new Date().toISOString();

        const user = {
            email: norm,
            name:
                String(name || "")
                    .trim() ||
                norm.split("@")[0],
            mobile: mob,
            segments: segs,
            isAdmin: shouldBeAdmin,
            salt,
            passwordHash:
                hashPassword(
                    password,
                    salt
                ),
            createdAt,
        };

        await db.createUser(user);

        return publicUser(user);
    })();
}


function loginUser({
    email,
    password,
}) {

    const norm =
        normalizeEmail(email);

    return (async () => {
        const user = await db.findUserByEmail(norm);

        if (!user) {
            throw new Error(
                "User does not exist. Please register."
            );
        }

        const ok = verifyPassword(
            password || "",
            user.salt,
            user.passwordHash
        );

        if (!ok) {
            throw new Error(
                "Invalid password."
            );
        }

        return publicUser(user);
    })();
}


function accessInfo(u) {

    const created =
        Date.parse(u.createdAt) ||
        Date.now();

    const trialEndsAt =
        u.trialEndsAt ??
        created + TRIAL_DAYS * 86400000;

    const accessUntil =
        u.accessUntil ?? null;

    const limit =
        accessUntil ?? trialEndsAt;

    return {
        plan:
            u.plan ??
            (u.accessUntil ? "full" : "trial"),

        trialEndsAt,

        accessUntil,

        hasAccess:
            Date.now() < limit,

        daysLeft:
            Math.max(
                0,
                Math.ceil(
                    (limit - Date.now()) /
                        86400000
                )
            ),
    };

}

function publicUser(u) {

    const segs =
        normalizeSegments(
            u.segments
        );

    // Legacy users without segments -> grant all
    const segments =
        segs.length > 0
            ? segs
            : ["MCX", "NSE", "BSE"];

    return {
        ...accessInfo(u),
        email: u.email,
        name: u.name,
        mobile: normalizeMobile(
            u.mobile || ""
        ),
        segments,
        isAdmin: Boolean(
            u.isAdmin ||
                getAdminEmails().has(
                    normalizeEmail(u.email)
                )
        ),
        createdAt: u.createdAt,
    };

}


// ---------------------------------------------------------
// ADMIN RENEWAL
// ---------------------------------------------------------

function getAdminKey() {

    const f = path.resolve(
        process.cwd(),
        "data",
        "bullionai-admin-key.txt"
    );

    try {
        return fs.readFileSync(f, "utf8").trim();
    } catch {
        // fall through
    }

    const key =
        crypto.randomBytes(24).toString("hex");

    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, key, "utf8");

    return key;

}

function renewUser(email, days) {

    const norm = normalizeEmail(email);

    return (async () => {
        const user = await db.findUserByEmail(norm);
        if (!user) throw new Error("User not found.");

        const base =
            Math.max(
                Date.now(),
                Number(user.accessUntil) || 0
            );

        user.accessUntil =
            base +
            Number(days || 30) * 86400000;

        user.plan = "full";

        await db.updateUser(norm, {
            accessUntil: user.accessUntil,
            plan: "full",
        });

        await db.recordSubscription(norm, {
            plan: "full",
            period: `${days || 30}d`,
            endsAt: user.accessUntil,
        });

        return publicUser(
            await db.findUserByEmail(norm)
        );
    })();
}

function resetUserPassword(email, newPassword) {

    if (
        !newPassword ||
        String(newPassword).length < 6
    ) {
        throw new Error(
            "Password must be at least 6 characters."
        );
    }

    const norm = normalizeEmail(email);

    return (async () => {
        const user = await db.findUserByEmail(norm);
        if (!user) throw new Error("User not found.");

        const salt = crypto
            .randomBytes(16)
            .toString("hex");

        user.salt = salt;

        user.passwordHash = hashPassword(
            newPassword,
            salt
        );

        await db.updateUser(norm, {
            salt,
            passwordHash: user.passwordHash,
        });

        return publicUser(
            await db.findUserByEmail(norm)
        );
    })();
}


// ---------------------------------------------------------
// TOKENS
// ---------------------------------------------------------

function signToken(email) {

    const payload =
        Buffer.from(JSON.stringify({
            email:
                normalizeEmail(email),

            exp:
                Date.now() +
                TOKEN_TTL_MS,
        })).toString("base64url");

    const sig =
        crypto.createHmac("sha256", getSecret())
            .update(payload)
            .digest("base64url");

    return `${payload}.${sig}`;

}


function verifyToken(token) {

    if (
        !token ||
        typeof token !== "string" ||
        !token.includes(".")
    ) {
        return null;
    }


    const [payload, sig] =
        token.split(".");

    const expected =
        crypto.createHmac("sha256", getSecret())
            .update(payload)
            .digest("base64url");


    const a =
        Buffer.from(sig || "");

    const b =
        Buffer.from(expected);

    if (
        a.length !== b.length ||
        !crypto.timingSafeEqual(a, b)
    ) {
        return null;
    }


    try {

        const data =
            JSON.parse(
                Buffer.from(
                    payload,
                    "base64url"
                ).toString("utf8")
            );

        if (
            typeof data.exp !==
                "number" ||
            Date.now() > data.exp
        ) {
            return null;
        }

        return data;

    } catch {
        return null;
    }

}


function readBody(request) {

    return new Promise(
        (resolve, reject) => {

            let body = "";

            request.on("data", chunk => {

                body += chunk;

                if (body.length > 1e5) {
                    reject(
                        new Error("Payload too large")
                    );
                    request.destroy();
                }

            });

            request.on("end", () => {

                try {
                    resolve(
                        body
                            ? JSON.parse(body)
                            : {}
                    );
                } catch {
                    reject(
                        new Error("Invalid JSON body")
                    );
                }

            });

            request.on("error", reject);

        }
    );

}


function loadUsersPublic(email) {

    return (async () => {
        const user = await db.findUserByEmail(normalizeEmail(email));
        if (!user) throw new Error("User not found.");
        return publicUser(user);
    })();
}

function listUsersPublic() {

    return (async () => {
        const users = await db.listUsers();
        return users.map(u => publicUser(u));
    })();
}

function deleteUser(email) {

    const norm =
        normalizeEmail(email);

    return (async () => {
        return db.deleteUser(norm);
    })();
}

function updateUser(
    email,
    updates = {}
) {

    const norm =
        normalizeEmail(email);

    return (async () => {
        const user = await db.findUserByEmail(norm);
        if (!user) throw new Error("User not found.");

        const patch = {};

        if (
            updates.name !== undefined
        ) {
            const n =
                String(updates.name || "").trim();
            if (n) patch.name = n;
        }

        if (
            updates.mobile !== undefined
        ) {
            const m =
                normalizeMobile(
                    updates.mobile
                );
            if (!m) {
                throw new Error(
                    "Mobile number is required."
                );
            }
            if (!isValidMobile(m)) {
                throw new Error(
                    "Invalid mobile number. Use 10 digits."
                );
            }
            patch.mobile = m;
        }

        if (
            updates.segments !== undefined
        ) {
            const segs =
                normalizeSegments(
                    updates.segments
                );
            if (
                segs.length === 0
            ) {
                throw new Error(
                    "Select at least one segment (MCX, NSE, BSE)."
                );
            }
            patch.segments = segs;
        }

        if (
            updates.plan !== undefined
        ) {
            const p =
                String(
                    updates.plan || ""
                )
                    .trim()
                    .toLowerCase();
            if (
                ["trial", "full"].includes(p)
            ) {
                patch.plan = p;
            }
        }

        if (
            updates.trialEndsAt !== undefined
        ) {
            const v =
                updates.trialEndsAt === null
                    ? null
                    : Number(
                          updates.trialEndsAt
                      );
            if (
                v !== null &&
                Number.isFinite(v)
            ) {
                patch.trialEndsAt = v;
            } else if (v === null) {
                patch.trialEndsAt = null;
            }
        }

        if (
            updates.accessUntil !== undefined
        ) {
            const v =
                updates.accessUntil === null
                    ? null
                    : Number(
                          updates.accessUntil
                      );
            if (
                v !== null &&
                Number.isFinite(v)
            ) {
                patch.accessUntil = v;
            } else if (v === null) {
                patch.accessUntil = null;
                if (
                    user.plan === "full"
                ) {
                    patch.plan = "trial";
                }
            }
        }

        if (
            updates.isAdmin !== undefined
        ) {
            patch.isAdmin = Boolean(
                updates.isAdmin
            );
        }

        await db.updateUser(norm, patch);

        return publicUser(
            await db.findUserByEmail(norm)
        );
    })();
}


module.exports = {
    registerUser,
    loginUser,
    renewUser,
    resetUserPassword,
    getAdminKey,
    loadUsersPublic,
    listUsersPublic,
    deleteUser,
    updateUser,
    signToken,
    verifyToken,
    readBody,
    isValidEmail,
    normalizeSegments,
    VALID_SEGMENTS,
    isAdminEmail,
    getAdminEmails,
};

