const fs = require("fs");
const p = "src/auth/users.js";
let s = fs.readFileSync(p, "utf8");
if (!/const TRIAL_DAYS/.test(s)) {
  const anchor = /const SECRET_FILE = [^;]+;/;
  if (!anchor.test(s)) { console.log("secret anchor miss"); process.exit(1); }
  s = s.replace(anchor, m => m + "\r\n\r\nconst TRIAL_DAYS = 14;");
  fs.writeFileSync(p, s);
  console.log("TRIAL_DAYS added");
} else {
  console.log("already present");
}
delete require.cache[require.resolve(p)];
console.log(Object.keys(require(p)).join(","));
