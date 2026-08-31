import { useEffect, useMemo, useState } from "react";
import {
  Users,
  ShieldCheck,
  Clock,
  Search,
  Trash2,
  Edit3,
  RefreshCw,
  X,
  Crown,
  Activity,
  LogOut,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Plus,
  Calendar,
  Download,
  Ban,
  KeyRound,
  LayoutDashboard,
  BarChart3,
  Settings,
  TrendingUp,
} from "lucide-react";
import {
  verifyAdmin,
  listAdminUsers,
  getAdminStats,
  deleteAdminUser,
  updateAdminUser,
  renewAdminUser,
  createAdminUser,
  resetAdminPassword,
} from "../lib/admin";
import {
  loginEmail,
  getAuthSession,
  type AuthUser,
} from "../lib/auth";

type UserRow = {
  email: string;
  name: string;
  segments: string[];
  isAdmin?: boolean;
  plan: string;
  hasAccess: boolean;
  daysLeft: number;
  trialEndsAt: number;
  accessUntil: number | null;
  createdAt: string;
};

export function AdminDashboard({ onExit }: { onExit: () => void }) {
  const [authed, setAuthed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");

  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [renewUser, setRenewUser] = useState<UserRow | null>(null);
  const [renewDays, setRenewDays] = useState(30);
  const [renewDate, setRenewDate] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<any>({
    name: "",
    email: "",
    password: "",
    mobile: "",
    segments: [] as string[],
    plan: "trial",
    validTill: "",
    isAdmin: false,
  });
  const [viewUser, setViewUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<
    "overview" | "users" | "analytics" | "settings"
  >("overview");
  const pageSize = 10;

  // Shoonya re‑auth: opens the login page in a new tab.

  async function doLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter email and password");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user: AuthUser = await loginEmail(email.trim(), password);
      if (!(user as any).isAdmin) {
        setError("This account is not an admin.");
        return;
      }
      await verifyAdmin();
      setAuthed(true);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    if (!authed) return;
    try {
      const [u, s] = await Promise.all([
        listAdminUsers(),
        getAdminStats(),
      ]);
      setUsers(u);
      setStats(s);
    } catch (e: any) {
      if (e.message?.includes("401")) {
        setAuthed(false);
        setError("Admin session expired — login again");
      } else {
        setError(e.message);
      }
    }
  }

  useEffect(() => {
    if (authed) load();
  }, [authed]);

  useEffect(() => {
    const sess = getAuthSession();
    if ((sess as any)?.isAdmin) {
      verifyAdmin()
        .then(() => setAuthed(true))
        .catch(() => {});
    }
  }, []);

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (q) {
        const s = q.toLowerCase();
        if (
          !u.email.toLowerCase().includes(s) &&
          !u.name.toLowerCase().includes(s)
        )
          return false;
      }
      if (planFilter !== "all" && u.plan !== planFilter) return false;
      if (accessFilter === "active" && !u.hasAccess) return false;
      if (accessFilter === "expired" && u.hasAccess) return false;
      if (
        segmentFilter !== "all" &&
        !(u.segments || []).includes(segmentFilter)
      )
        return false;
      return true;
    });
  }, [users, q, planFilter, accessFilter, segmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [q, planFilter, accessFilter, segmentFilter]);

  function toDateInputValue(ts?: number | null) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toISOString().slice(0, 10);
  }

  function exportCSV() {
    const header = [
      "email",
      "name",
      "mobile",
      "segments",
      "plan",
      "hasAccess",
      "daysLeft",
      "createdAt",
      "accessUntil",
    ];
    const rows = filtered.map(u =>
      [
        u.email,
        u.name,
        (u as any).mobile || "",
        (u.segments || []).join("|"),
        u.plan,
        u.hasAccess,
        u.daysLeft,
        new Date(u.createdAt).toISOString(),
        u.accessUntil ? new Date(u.accessUntil).toISOString() : "",
      ]
        .map(v => `"${String(v || "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bullionai-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const header = [
      "Email",
      "Name",
      "Mobile",
      "Segments",
      "Plan",
      "Access",
      "Days Left",
      "Created At",
      "Valid Till",
      "Role",
    ];
    const rows = filtered
      .map(
        u => `
      <tr>
        <td>${u.email}</td>
        <td>${u.name}</td>
        <td>${(u as any).mobile || ""}</td>
        <td>${(u.segments || []).join(", ")}</td>
        <td>${u.plan}</td>
        <td>${u.hasAccess ? "Active" : "Expired"}</td>
        <td>${u.daysLeft}</td>
        <td>${new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
        <td>${
          u.accessUntil
            ? new Date(u.accessUntil).toLocaleDateString("en-IN")
            : u.trialEndsAt
              ? new Date(u.trialEndsAt).toLocaleDateString("en-IN")
              : "-"
        }</td>
        <td>${(u as any).isAdmin ? "Admin" : "User"}</td>
      </tr>`
      )
      .join("");
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8"></head>
      <body>
        <table border="1">
          <thead><tr>${header.map(h => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>`;
    const blob = new Blob([html], {
      type: "application/vnd.ms-excel",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bullionai-users-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
            <Crown className="h-6 w-6 text-amber-400" />
          </div>
          <h1 className="mt-4 text-center text-xl font-black tracking-tight text-slate-900">
            Admin Login
          </h1>
          <p className="mt-1 text-center text-xs font-medium text-slate-400">
            Sign in with your admin account to manage users & subscriptions
          </p>
          <form onSubmit={doLogin} className="mt-6 space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Email
              </span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@bullionai.in"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 pl-10 text-sm outline-none focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Password
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 pl-10 pr-10 text-sm outline-none focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            {error && (
              <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-black disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in as Admin"}
            </button>
            <button
              type="button"
              onClick={onExit}
              className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Back to App
            </button>
          </form>
          <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-400">
            First registered user is automatically admin. Set <code className="rounded bg-slate-100 px-1">ADMIN_EMAILS</code> in <code className="rounded bg-slate-100 px-1">.env</code> to grant admin to specific emails.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-900 text-white lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <span className="font-black tracking-tight">Admin</span>
          <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold">PRO</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {[
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "users", label: "Users", icon: Users },
            { id: "analytics", label: "Analytics", icon: BarChart3 },
            { id: "settings", label: "Settings", icon: Settings },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={[
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition font-display",
                activeTab === item.id ? "admin-sidebar-active" : "text-white/70 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.id === "users" && (
                <span className="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold font-mono">{users.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 p-3">
            <div className="text-xs font-bold text-white">Need help?</div>
            <div className="text-[11px] text-white/60">Docs & support v2.1</div>
          </div>
          <button
            onClick={onExit}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" /> Exit to App
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-3 lg:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 lg:hidden">
                <Crown className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <div className="text-sm font-black tracking-tight text-slate-900 capitalize">{activeTab}</div>
                <div className="hidden text-[11px] font-medium text-slate-400 lg:block">Premium Control Center</div>
              </div>
              <div className="hidden items-center gap-1 lg:hidden">
                {[
                  { id: "overview", icon: LayoutDashboard },
                  { id: "users", icon: Users },
                  { id: "analytics", icon: BarChart3 },
                  { id: "settings", icon: Settings },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={["rounded-lg p-2", activeTab === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"].join(" ")}
                  >
                    <item.icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open("https://bullionai-pinetest.onrender.com/api/shoonya/login", "_blank")}
                className="rounded-xl bg-purple-600 py-2 text-white text-sm hover:bg-purple-700"
              >
                Shoonya Login
              </button>
              <button onClick={onExit} className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-black lg:hidden">
                <LogOut className="h-3.5 w-3.5" /> Exit
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1600px] p-4 lg:p-6">
          {activeTab === "overview" && (
            <div className="space-y-4">
              {stats && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Users</span>
                      <Users className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-slate-900">{stats.total}</div>
                    <div className="mt-1 text-xs text-slate-400">{stats.active} active · {stats.expired} expired</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Plans</span>
                      <Crown className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-slate-900">{stats.full} Full</div>
                    <div className="text-xs text-slate-400">{stats.trial} trial</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Segments</span>
                      <Activity className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="mt-2 flex gap-2 text-xs font-bold">
                      <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-700">MCX {stats.segments.MCX}</span>
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">NSE {stats.segments.NSE}</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">BSE {stats.segments.BSE}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">Health</div>
                    <div className="mt-2 flex items-center gap-2 text-sm font-bold">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" /> System Operational
                    </div>
                    <div className="text-xs text-white/60">{new Date().toLocaleString("en-IN")}</div>
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-black flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Recent Users
                </h3>
                <div className="mt-3 space-y-2">
                  {users.slice(0, 5).map(u => (
                    <div key={u.email} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                      <span className="text-xs font-semibold truncate">
                        {u.name} <span className="font-normal text-slate-500">({u.email})</span>
                      </span>
                      <span className="text-[10px] text-slate-400">{new Date(u.createdAt).toLocaleDateString("en-IN")}</span>
                    </div>
                  ))}
                  {users.length === 0 && <div className="text-xs text-slate-400 py-2">No users yet</div>}
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative flex-1 lg:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search email or name…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-300 focus:bg-white" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">
                    <option value="all">All Plans</option>
                    <option value="trial">Trial</option>
                    <option value="full">Full</option>
                  </select>
                  <select value={accessFilter} onChange={e => setAccessFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">
                    <option value="all">All Access</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                  </select>
                  <select value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">
                    <option value="all">All Segments</option>
                    <option value="MCX">MCX</option>
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                  </select>
                  <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-black">
                    <Plus className="h-3.5 w-3.5" /> Create User
                  </button>
                  <button onClick={exportCSV} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </button>
                  <button onClick={exportExcel} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">
                    <Download className="h-3.5 w-3.5" /> Excel
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Mobile</th>
                        <th className="px-4 py-3">Segments</th>
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3">Access</th>
                        <th className="px-4 py-3">Valid Till</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginated.length === 0 ? (
                        <tr>
                          <td                             colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                            No users found.
                          </td>
                        </tr>
                      ) : (
                        paginated.map(u => (
                          <tr key={u.email} className="hover:bg-slate-50/60">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">{u.name}</span>
                                {u.isAdmin && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">ADMIN</span>}
                              </div>
                              <div className="text-xs text-slate-500">{u.email}</div>
                            </td>
                            <td className="px-4 py-3 text-xs font-mono text-slate-700">{(u as any).mobile || "-"}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {(u.segments || []).map((s: string) => (
                                  <span key={s} className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={["rounded-full px-2 py-1 text-xs font-bold", u.plan === "full" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"].join(" ")}>
                                {u.plan}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={["inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold", u.hasAccess ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"].join(" ")}>
                                <Clock className="h-3 w-3" />
                                {u.hasAccess ? "Active" : "Expired"}
                              </span>
                            </td>
                      <td className="px-4 py-3 text-xs font-medium">
                        {u.accessUntil
                          ? new Date(u.accessUntil).toLocaleDateString("en-IN")
                          : u.trialEndsAt
                            ? new Date(u.trialEndsAt).toLocaleDateString("en-IN")
                            : "-"}
                        <span className="ml-1 text-[10px] text-slate-400">({u.daysLeft}d)</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                <button onClick={() => setViewUser(u)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-white" title="View">
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditUser(u);
                                    setEditForm({
                                      name: u.name,
                                      segments: [...(u.segments || [])],
                                      plan: u.plan,
                                      isAdmin: !!u.isAdmin,
                                      validTill: toDateInputValue(u.accessUntil || u.trialEndsAt),
                                    });
                                  }}
                                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-white"
                                  title="Edit"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setRenewUser(u)} className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-700 hover:bg-amber-100" title="Renew">
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={async () => {
                                    const action = u.hasAccess ? "Block" : "Unblock";
                                    if (!confirm(`${action} ${u.email}?`)) return;
                                    await updateAdminUser(u.email, u.hasAccess ? { accessUntil: Date.now() - 1000 } : { accessUntil: Date.now() + 30 * 86400000, plan: "full" });
                                    load();
                                  }}
                                  className={["rounded-lg border p-1.5", u.hasAccess ? "border-slate-200 bg-white hover:bg-slate-50" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"].join(" ")}
                                  title={u.hasAccess ? "Block" : "Unblock"}
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setResetUser(u);
                                    setResetPassword("");
                                    setShowResetPassword(false);
                                  }}
                                  className="rounded-lg border border-blue-200 bg-blue-50 p-1.5 text-blue-700 hover:bg-blue-100"
                                  title="Reset Password"
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Delete ${u.email}?`)) return;
                                    await deleteAdminUser(u.email);
                                    load();
                                  }}
                                  className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-xs">
                  <span className="text-slate-500">
                    Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-40">
                      Prev
                    </button>
                    <span className="px-2 text-xs font-medium">
                      {currentPage} / {totalPages}
                    </span>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-40">
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-4">
              <div className="admin-glass admin-card-hover rounded-2xl p-6">
                <h3 className="font-display text-sm font-black flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Segment Distribution
                </h3>
                <div className="mt-4 space-y-3">
                  {stats &&
                    (["MCX", "NSE", "BSE", "COMEX"] as const).map(seg => {
                      const count = (stats.segments as any)[seg] || 0;
                      const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
                      return (
                        <div key={seg} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="font-display">{seg}</span>
                            <span className="font-mono">
                              {count} users ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="admin-glass admin-card-hover rounded-2xl p-6">
                  <h3 className="font-display text-sm font-black flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Plan Mix
                  </h3>
                  <div className="mt-4 flex items-center justify-center gap-6">
                    <div className="text-center">
                      <div className="font-display text-2xl font-black text-amber-600">{stats?.full || 0}</div>
                      <div className="text-xs font-medium text-slate-500">Full</div>
                    </div>
                    <div className="h-12 w-px bg-slate-200" />
                    <div className="text-center">
                      <div className="font-display text-2xl font-black text-slate-600">{stats?.trial || 0}</div>
                      <div className="text-xs font-medium text-slate-500">Trial</div>
                    </div>
                  </div>
                  <div className="mt-4 h-2 flex overflow-hidden rounded-full bg-slate-100">
                    <div className="bg-amber-500" style={{ width: `${stats ? Math.round((stats.full / Math.max(1, stats.total)) * 100) : 0}%` }} />
                    <div className="bg-slate-300" style={{ width: `${stats ? Math.round((stats.trial / Math.max(1, stats.total)) * 100) : 0}%` }} />
                  </div>
                </div>
                <div className="admin-glass admin-card-hover rounded-2xl p-6">
                  <h3 className="font-display text-sm font-black">Access Health</h3>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Active</span>
                      <span className="font-mono font-bold text-emerald-600">{stats?.active || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Expired</span>
                      <span className="font-mono font-bold text-rose-600">{stats?.expired || 0}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-2 font-display font-bold">
                      <span>Total</span>
                      <span>{stats?.total || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="admin-glass admin-card-hover rounded-2xl p-6">
                  <h3 className="font-display text-sm font-black flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Expiring Soon
                  </h3>
                  <div className="mt-3 space-y-2">
                    {users
                      .filter(u => u.hasAccess && u.daysLeft <= 3)
                      .slice(0, 3)
                      .map(u => (
                        <div key={u.email} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2">
                          <span className="truncate text-xs font-semibold">{u.email}</span>
                          <span className="text-xs font-bold text-amber-700">{u.daysLeft}d</span>
                        </div>
                      ))}
                    {users.filter(u => u.hasAccess && u.daysLeft <= 3).length === 0 && (
                      <div className="py-4 text-center text-xs text-slate-400">No expiring users</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="admin-glass rounded-2xl p-6">
                <h3 className="font-display text-sm font-black">User Growth (Last 7 Days)</h3>
                <div className="mt-4 flex h-24 items-end gap-1">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (6 - i));
                    const dayStr = d.toISOString().slice(0, 10);
                    const count = users.filter(u => u.createdAt.slice(0, 10) === dayStr).length;
                    const max = Math.max(1, ...Array.from({ length: 7 }).map((__, j) => {
                      const dd = new Date();
                      dd.setDate(dd.getDate() - (6 - j));
                      return users.filter(u => u.createdAt.slice(0, 10) === dd.toISOString().slice(0, 10)).length;
                    }));
                    const h = count ? Math.max(12, (count / max) * 80) : 4;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t-lg bg-slate-900 transition-all" style={{ height: `${h}px` }} />
                        <span className="text-[9px] font-medium text-slate-400">{d.toLocaleDateString("en-IN", { day: "2-digit" })}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Settings className="h-4 w-4" /> Settings
              </h3>
              <p className="mt-2 text-xs text-slate-500">System settings and configuration. More options coming soon.</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="font-medium">Version</span>
                  <span className="text-slate-500">v2.1 Pro</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="font-medium">Environment</span>
                  <span className="text-slate-500">Production</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-medium">Support</span>
                  <span className="text-slate-500">support@bullionai.in</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">Edit User</h2>
              <button onClick={() => setEditUser(null)} className="rounded-full p-1 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Name</span>
                <input
                  value={editForm.name || ""}
                  onChange={e => setEditForm((p: any) => ({ ...p, name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <div>
                <span className="text-xs font-semibold text-slate-500">Segments *</span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {["MCX", "NSE", "BSE", "COMEX"].map(seg => {
                    const on = editForm.segments?.includes(seg);
                    return (
                      <button
                        key={seg}
                        onClick={() =>
                          setEditForm((p: any) => ({
                            ...p,
                            segments: on ? p.segments.filter((s: string) => s !== seg) : [...(p.segments || []), seg],
                          }))
                        }
                        className={["rounded-xl border py-2 text-xs font-bold", on ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-white"].join(" ")}
                      >
                        {seg}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Plan</span>
                <select
                  value={editForm.plan}
                  onChange={e => setEditForm((p: any) => ({ ...p, plan: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="trial">Trial</option>
                  <option value="full">Full</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Valid Till (calendar)</span>
                <div className="relative mt-1">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={editForm.validTill ?? toDateInputValue(editForm.accessUntil ?? editUser?.accessUntil)}
                    onChange={e => setEditForm((p: any) => ({ ...p, validTill: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-amber-300"
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-400">Pick a date — subscription valid till end of that day</p>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!editForm.isAdmin} onChange={e => setEditForm((p: any) => ({ ...p, isAdmin: e.target.checked }))} />
                <span className="text-xs font-semibold text-slate-600">Admin privileges</span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const payload: any = { ...editForm };
                    if (payload.validTill) {
                      const d = new Date(payload.validTill);
                      if (!isNaN(d.getTime())) {
                        payload.accessUntil = d.getTime() + 24 * 60 * 60 * 1000 - 1000;
                      }
                      delete payload.validTill;
                    }
                    await updateAdminUser(editUser.email, payload);
                    setEditUser(null);
                    load();
                  }}
                  className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-black"
                >
                  Save Changes
                </button>
                <button onClick={() => setEditUser(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {renewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-sm font-black">Renew Subscription</h2>
            <p className="mt-1 text-xs text-slate-500">{renewUser.email}</p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Valid Till (calendar)
                </span>
                <input
                  type="date"
                  value={renewDate}
                  onChange={e => {
                    const v = e.target.value;
                    setRenewDate(v);
                    if (v) {
                      const diff = Math.ceil((new Date(v).getTime() - Date.now()) / 86400000);
                      if (diff > 0) setRenewDays(diff);
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[10px] text-slate-400">Pick a date — calendar takes priority over days</p>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Or extend by (days)</span>
                <input
                  type="number"
                  value={renewDays}
                  onChange={e => setRenewDays(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={async () => {
                  if (renewDate) {
                    const ts = new Date(renewDate).getTime() + 24 * 60 * 60 * 1000 - 1000;
                    await updateAdminUser(renewUser.email, { accessUntil: ts, plan: "full" });
                  } else {
                    await renewAdminUser(renewUser.email, renewDays);
                  }
                  setRenewUser(null);
                  setRenewDate("");
                  load();
                }}
                className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600"
              >
                {renewDate ? `Set till ${renewDate}` : `Renew +${renewDays}d`}
              </button>
              <button
                onClick={() => {
                  setRenewUser(null);
                  setRenewDate("");
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">Create User</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-full p-1 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Name</span>
                <input
                  value={createForm.name}
                  onChange={e => setCreateForm((p: any) => ({ ...p, name: e.target.value }))}
                  placeholder="Full name"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Email *</span>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm((p: any) => ({ ...p, email: e.target.value }))}
                  placeholder="user@example.com"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Password *</span>
                <div className="relative mt-1">
                  <input
                    type={showResetPassword ? "text" : "password"}
                    value={createForm.password}
                    onChange={e => setCreateForm((p: any) => ({ ...p, password: e.target.value }))}
                    placeholder="Min 6 characters"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10 text-sm"
                  />
                  <button type="button" onClick={() => setShowResetPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Mobile *</span>
                <input
                  type="tel"
                  value={createForm.mobile || ""}
                  onChange={e =>
                    setCreateForm((p: any) => ({
                      ...p,
                      mobile: e.target.value,
                    }))
                  }
                  placeholder="9876543210"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <div>
                <span className="text-xs font-semibold text-slate-500">Segments *</span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {["MCX", "NSE", "BSE", "COMEX"].map(seg => {
                    const on = createForm.segments?.includes(seg);
                    return (
                      <button
                        key={seg}
                        type="button"
                        onClick={() =>
                          setCreateForm((p: any) => ({
                            ...p,
                            segments: on ? p.segments.filter((s: string) => s !== seg) : [...p.segments, seg],
                          }))
                        }
                        className={["rounded-xl border py-2 text-xs font-bold", on ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-white"].join(" ")}
                      >
                        {seg}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Plan</span>
                  <select
                    value={createForm.plan}
                    onChange={e => setCreateForm((p: any) => ({ ...p, plan: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="trial">Trial</option>
                    <option value="full">Full</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Valid Till
                  </span>
                  <input
                    type="date"
                    value={createForm.validTill}
                    onChange={e => setCreateForm((p: any) => ({ ...p, validTill: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!createForm.isAdmin} onChange={e => setCreateForm((p: any) => ({ ...p, isAdmin: e.target.checked }))} />
                <span className="text-xs font-semibold text-slate-600">Make admin</span>
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={async () => {
                    try {
                      await createAdminUser(createForm);
                      setShowCreate(false);
                      setCreateForm({ name: "", email: "", password: "", segments: [], plan: "trial", validTill: "", isAdmin: false });
                      load();
                    } catch (e: any) {
                      alert(e.message || "Create failed");
                    }
                  }}
                  className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-black"
                >
                  Create User
                </button>
                <button onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View User Modal */}
      {viewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">User Details</h2>
              <button onClick={() => setViewUser(null)} className="rounded-full p-1 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-100 py-2">
                <span className="font-semibold text-slate-500">Name</span>
                <span className="font-medium">{viewUser.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-2">
                <span className="font-semibold text-slate-500">Email</span>
                <span className="font-medium">{viewUser.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-2">
                <span className="font-semibold text-slate-500">Segments</span>
                <span className="flex gap-1">
                  {(viewUser.segments || []).map((s: string) => (
                    <span key={s} className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
                      {s}
                    </span>
                  ))}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-2">
                <span className="font-semibold text-slate-500">Plan</span>
                <span className={["rounded-full px-2 py-0.5 text-xs font-bold", viewUser.plan === "full" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"].join(" ")}>
                  {viewUser.plan}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-2">
                <span className="font-semibold text-slate-500">Access</span>
                <span className={viewUser.hasAccess ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                  {viewUser.hasAccess ? "Active" : "Expired"} ({viewUser.daysLeft}d left)
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-2">
                <span className="font-semibold text-slate-500">Created</span>
                <span>{new Date(viewUser.createdAt).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-2">
                <span className="font-semibold text-slate-500">Valid Till</span>
                <span>{viewUser.accessUntil ? new Date(viewUser.accessUntil).toLocaleDateString("en-IN") : viewUser.trialEndsAt ? new Date(viewUser.trialEndsAt).toLocaleDateString("en-IN") : "-"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-semibold text-slate-500">Role</span>
                <span className={viewUser.isAdmin ? "font-bold text-amber-600" : ""}>{viewUser.isAdmin ? "Admin" : "User"}</span>
              </div>
            </div>
            <button onClick={() => setViewUser(null)} className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-sm font-black">Reset Password</h2>
            <p className="mt-1 text-xs text-slate-500">{resetUser.email}</p>
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-500">New Password</label>
              <div className="relative mt-1">
                <input
                  type={showResetPassword ? "text" : "password"}
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10 text-sm"
                />
                <button type="button" onClick={() => setShowResetPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await resetAdminPassword(resetUser.email, resetPassword);
                    setResetUser(null);
                    setResetPassword("");
                    alert("Password reset successfully");
                  } catch (e: any) {
                    alert(e.message || "Reset failed");
                  }
                }}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
              >
                Reset
              </button>
              <button
                onClick={() => {
                  setResetUser(null);
                  setResetPassword("");
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
