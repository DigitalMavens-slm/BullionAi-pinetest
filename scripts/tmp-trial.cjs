const fs = require("fs");

/* ================= users.js — trial/renewal model ================= */
{
  let s = fs.readFileSync("src/auth/users.js", "utf8");
  const NL = /\r?\n/;
  const NLc = "\r\n";

  // publicUser -> include access fields
  if (!s.includes("hasAccess")) {
    s = s.replace(
      /function publicUser\(u\) \{[\s\S]*?\n\}/,
      `function accessInfo(u) {\r\n\r\n    const created =\r\n        Date.parse(u.createdAt) ||\r\n        Date.now();\r\n\r\n    const trialEndsAt =\r\n        u.trialEndsAt ??\r\n        created + TRIAL_DAYS * 86400000;\r\n\r\n    const accessUntil =\r\n        u.accessUntil ?? null;\r\n\r\n    const limit =\r\n        accessUntil ?? trialEndsAt;\r\n\r\n    return {\r\n        plan:\r\n            u.plan ??\r\n            (u.accessUntil ? \"full\" : \"trial\"),\r\n\r\n        trialEndsAt,\r\n\r\n        accessUntil,\r\n\r\n        hasAccess:\r\n            Date.now() < limit,\r\n\r\n        daysLeft:\r\n            Math.max(\r\n                0,\r\n                Math.ceil(\r\n                    (limit - Date.now()) /\r\n                        86400000\r\n                )\r\n            ),\r\n    };\r\n\r\n}\r\n\r\n\r\nfunction publicUser(u) {\r\n\r    return {\r\n        ...accessInfo(u),\r\n        email: u.email,\r\n        name: u.name,\r\n        createdAt: u.createdAt,\r\n    };\r\n\r\n}`
    );
  }

  // register -> stamp trial
  if (!s.includes("TRIAL_DAYS")) {
    s = s.replace(
      "const TOKEN_TTL_MS =",
      "const TRIAL_DAYS =\r\n    14;\r\n\r\nconst TOKEN_TTL_MS ="
    );
    s = s.replace(
      /(const user = \{\r?\n\s+email: norm,)/,
      `$1${NLc}\r\n        plan: \"trial\",${NLc}\r\n        trialEndsAt:\r\n            Date.now() +\r\n            TRIAL_DAYS *\r\n                86400000,`
    );
  }

  // renew helper
  if (!s.includes("function renewUser")) {
    s = s.replace(
      /\/\/ ---------------------------------------------------------\r?\n\/\/ TOKENS/,
      `// ---------------------------------------------------------
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

    const db = loadUsers();

    const user = db.users.find(
        u => u.email === norm
    );

    if (!user) {
        throw new Error("User not found.");
    }

    const base =
        Math.max(
            Date.now(),
            Number(user.accessUntil) || 0
        );

    user.accessUntil =
        base +
        Number(days || 30) * 86400000;

    user.plan = "full";

    saveUsers(db);

    return publicUser(user);

}


// ---------------------------------------------------------
// TOKENS`
    );
  }

  // exports
  if (!s.includes("module.exports")) {
    // nothing
  }
  s = s.replace(
    /module\.exports = \{\r?\n\s+registerUser,/,
    `module.exports = {\r\n    registerUser,\r\n    renewUser,\r\n    getAdminKey,`
  );
  fs.writeFileSync("src/auth/users.js", s);
  console.log("users.js patched");
}

/* ================= server routes ================= */
{
  let s = fs.readFileSync("src/server/bullionai-api.js", "utf8");
  const NL = "\r\n";

  if (!s.includes("getAdminKey")) {
    const anchor = '} = require("../auth/users");';
    const inject =
      NL + "const {" + NL +
      "    renewUser," + NL +
      "    getAdminKey," + NL +
      "} = require(\"../auth/users\");";
    const i = s.indexOf(anchor);
    s = s.slice(0, i + anchor.length) + inject + s.slice(i + anchor.length);
  }

  // enrich me route response
  if (!s.includes('"hasAccess"') && !s.includes("hasAccess:")) {
    s = s.replace(
      /if \(url\.pathname === "\/api\/auth\/me"\)[\s\S]*?this\.sendJson\(response, 200, \{\r?\n\s+ok: true,\r?\n\s+email: data\.email,\r?\n\s+\}\);/,
      m => m.replace(
        /this\.sendJson\(response, 200, \{[\s\S]*?\}\);/,
        `const db2 = require("../auth/users");
                     this.sendJson(response, 200, {
                         ok: true,
                         ...(db2.publicInfo ? db2.publicInfo(data.email) : { email: data.email }),
                     });`
      )
    );
  }

  // simpler: add /api/auth/status using loginUser-free lookup via verifyToken + renewUser-style db read
  if (!s.includes("/api/admin/renew")) {
    const marker = 'url.pathname === "/api/auth/me"';
    const i = s.indexOf(marker);
    // find end of the me-route block: locate the following "return;" then closing "}\n"
    const endI = s.indexOf("return;", i);
    const blockClose = s.indexOf("}", endI) + 1;
    const adminRoute = NL + NL +
      `        if (\r\n            url.pathname === "/api/admin/renew" &&\r\n            request.method === "POST"\r\n        ) {\r\n            const key =\r\n                request.headers["x-admin-key"] || "";\r\n            if (key !== getAdminKey()) {\r\n                this.sendJson(response, 403, {\r\n                    ok: false,\r\n                    error: "Invalid admin key.",\r\n                });\r\n                return;\r\n            }\r\n            try {\r\n                const body = await readBody(request);\r\n                const user = renewUser(body.email, body.days);\r\n                this.sendJson(response, 200, {\r\n                    ok: true,\r\n                    user,\r\n                });\r\n            } catch (error) {\r\n                this.sendJson(response, 400, {\r\n                    ok: false,\r\n                    error: error?.message || String(error),\r\n                });\r\n            }\r\n            return;\r\n        }`;
    s = s.slice(0, blockClose) + adminRoute + s.slice(blockClose);
  }

  // make /api/auth/me return full access payload
  if (!s.includes("publicUserFromToken")) {
    // replace the me success payload with access-aware lookup
    s = s.replace(
      /this\.sendJson\(response, 200, \{\r?\n\s+ok: true,\r?\n\s+email: data\.email,\r?\n\s+\}\);/,
      `/* Full profile incl. trial/access status */\r\n            const { loadUsersPublic } = require("../auth/users");\r\n            const profile =\r\n                loadUsersPublic(data.email);\r\n            this.sendJson(response, 200, {\r\n                ok: true,\r\n                user: profile,\r\n            });`
    );
  }

  // add loadUsersPublic to users.js
  {
    let u = fs.readFileSync("src/auth/users.js", "utf8");
    if (!u.includes("loadUsersPublic")) {
      u = u.replace(
        /module\.exports = \{/,
        `function loadUsersPublic(email) {

    const db = loadUsers();

    const user = db.users.find(
        u => u.email === normalizeEmail(email)
    );

    if (!user) {
        throw new Error("User not found.");
    }

    return publicUser(user);

}


module.exports = {`
      );
      u = u.replace(
        /module\.exports = \{\s*\r?\n\s+registerUser,/,
        `module.exports = {\r\n    registerUser,\r\n    loadUsersPublic,`
      );
      fs.writeFileSync("src/auth/users.js", u);
    }
  }

  fs.writeFileSync(p, s);
  console.log("server routes patched");
}
