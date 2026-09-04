// Backend API base URL.
//
// Built-time override: set VITE_BULLIONAI_API_URL (e.g.
//   https://bullionai-api.onrender.com
// ) when building on the static host.
//
// If not set, defaults to SAME-ORIGIN relative "/api" so a single
// host (reverse-proxying /api to the backend) "just works".
const envUrl = import.meta.env.VITE_BULLIONAI_API_URL as string | undefined;

// If it's an explicit full URL, use it as-is. Otherwise Hostinger production default.
export const API_BASE =
  envUrl && /^https?:\/\//i.test(envUrl)
    ? envUrl.replace(/\/+$/, "")
    : "https://backend.bullionai.in";
