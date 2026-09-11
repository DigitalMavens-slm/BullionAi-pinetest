// @ts-nocheck
import { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Modal, Animated, KeyboardAvoidingView, Platform, ScrollView, Keyboard } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import { searchSymbols, subscribeSymbol } from "@/api/bullionai";
import { useLiveStore } from "@/store/live";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Sym = { exch: string; token: string; tsym: string; label: string; lotSize?: number | null; expiryText?: string | null };
const STORAGE_KEY = "bullionai_watchlist";
const FAVS_KEY = "bullionai_watchlist_favs";

const NAVY = "#0A2540";
const GOLD = "#B8860B";
const GOLD_BRIGHT = "#E8A93D";

export default function Watchlist() {
  const { livePrices, start } = useLiveStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<Sym[]>([
    { exch: "MCX", token: "483079", tsym: "GOLD05DEC25", label: "GOLD", lotSize: 100, expiryText: "05 DEC 2025" },
    { exch: "MCX", token: "495214", tsym: "SILVER05DEC25", label: "SILVER", lotSize: 30, expiryText: "05 DEC 2025" },
    { exch: "MCX", token: "571298", tsym: "COPPER30NOV25", label: "COPPER", lotSize: 250, expiryText: "30 NOV 2025" },
    { exch: "MCX", token: "565899", tsym: "CRUDEOIL19NOV25", label: "CRUDEOIL", lotSize: 100, expiryText: "19 NOV 2025" },
    { exch: "MCX", token: "568245", tsym: "NATURALGAS26NOV25", label: "NATURALGAS", lotSize: 1250, expiryText: "26 NOV 2025" },
  ]);
  const [filter, setFilter] = useState<"MCX" | "NSE" | "BSE">("MCX");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"Watchlist" | "Favorites">("Watchlist");
  const [favs, setFavs] = useState<Record<string, boolean>>({});

  // Live clock + market session (IST)
  const pulse = useRef(new Animated.Value(0)).current;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short", hour12: false })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const istHour = parseInt(parts.hour ?? "0", 10) % 24;
  const istMin = parseInt(parts.minute ?? "0", 10);
  const istSec = parseInt(parts.second ?? "0", 10);
  const dayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday ?? "Mon");
  const istMins = istHour * 60 + istMin;
  const isWeekday = dayIdx >= 1 && dayIdx <= 5;
  const marketOpen = isWeekday && istMins >= 540 && istMins < 1410; // 09:00 - 23:30 IST
  const hh12 = istHour % 12 || 12;
  const ampm = istHour < 12 ? "AM" : "PM";
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(hh12)}:${pad(istMin)}:${pad(istSec)} ${ampm}`;

  const skey = (s: Sym) => `${s.exch}-${s.token}`;

  useEffect(() => { start(); }, [start]);
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) { try { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) setWatchlist(p); } catch {} }
    });
    AsyncStorage.getItem(FAVS_KEY).then((raw) => {
      if (raw) { try { const p = JSON.parse(raw); if (p && typeof p === "object") setFavs(p); } catch {} }
    });
  }, []);
  useEffect(() => {
    if (watchlist.length) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    watchlist.forEach((s) => subscribeSymbol(s as any));
  }, [watchlist]);
  useEffect(() => {
    AsyncStorage.setItem(FAVS_KEY, JSON.stringify(favs));
  }, [favs]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try { const rows = await searchSymbols(query.trim(), filter, 10); setResults(rows); } catch { setResults([]); }
    }, 260);
    return () => clearTimeout(t);
  }, [query, filter]);

  const add = (r: any) => {
    const sym: Sym = { exch: r.exch || r.exchange || "MCX", token: r.token, tsym: r.tsym || r.symbol || r.tradingSymbol, label: r.symbol || r.tsym || r.tradingSymbol, lotSize: r.lotSize, expiryText: (r as any).expiryText };
    if (!watchlist.some((w) => w.token === sym.token && w.exch === sym.exch)) setWatchlist((p) => [...p, sym]);
    setPickerOpen(false); setQuery(""); setResults([]);
  };

  const toggleFav = (key: string) => setFavs((p) => ({ ...p, [key]: !p[key] }));

  const remove = (key: string) => {
    setWatchlist((p) => p.filter((s) => skey(s) !== key));
    setFavs((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
  };

  const visible =
    activeTab === "Watchlist" ? watchlist
    : watchlist.filter((s) => favs[skey(s)]);

  // Reorder visible subset; keeps non-visible items in place (Favorites tab)
  const handleDragEnd = ({ data }: { data: Sym[] }) => {
    if (activeTab === "Watchlist") {
      setWatchlist(data);
      return;
    }
    const visibleKeys = new Set(visible.map(skey));
    let i = 0;
    setWatchlist((master) => master.map((item) => (visibleKeys.has(skey(item)) ? data[i++] : item)));
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F1F5F9" }}>
      {/* ===== SEGMENTED PILL TABS ===== */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", gap: 10 }}>
        <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#EEF2F7", borderRadius: 22, padding: 3 }}>
          {(["Watchlist", "Favorites"] as const).map((tab) => {
            const active = activeTab === tab;
            return (
              <Pressable key={tab} onPress={() => setActiveTab(tab)} style={{ flex: 1, paddingVertical: 7, borderRadius: 19, backgroundColor: active ? "#fff" : "transparent", shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: active ? 0.12 : 0, shadowRadius: 4, elevation: active ? 2 : 0, alignItems: "center" }}>
                <Text style={{ fontSize: 12.5, fontWeight: active ? "800" : "600", color: active ? NAVY : "#64748B", letterSpacing: 0.2 }}>{tab}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: GOLD, alignItems: "center", justifyContent: "center", shadowColor: GOLD, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 3 }}
          hitSlop={6}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* ===== MARKET STATUS STRIP ===== */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: marketOpen ? "#ECFDF5" : "#F1F5F9", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: marketOpen ? "#A7F3D0" : "#E2E8F0" }}>
            <View style={{ width: 16, height: 16, alignItems: "center", justifyContent: "center" }}>
              <Animated.View style={{ position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: marketOpen ? "#10B981" : "#94A3B8", opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }] }} />
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: marketOpen ? "#10B981" : "#94A3B8" }} />
            </View>
            <Text style={{ fontSize: 10.5, fontWeight: "900", letterSpacing: 1, color: marketOpen ? "#059669" : "#64748B" }}>{marketOpen ? "LIVE" : "CLOSED"}</Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: "600", color: "#64748B" }}>{marketOpen ? "Closes 11:30 PM" : "Opens 09:00 AM"}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text style={{ fontSize: 11.5, fontWeight: "700", color: NAVY, fontFamily: "monospace", fontVariant: ["tabular-nums"] }}>{clock}</Text>
          <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 1, color: "#94A3B8" }}>IST</Text>
        </View>
      </View>

      {/* ===== TABLE HEADER ===== */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" }}>
        <Text style={{ flex: 1.4, fontSize: 11, fontWeight: "800", color: "#94A3B8", letterSpacing: 0.5 }}>SYMBOL</Text>
        <Text style={{ flex: 1, fontSize: 11, fontWeight: "800", color: "#94A3B8", letterSpacing: 0.5, textAlign: "center" }}>BID</Text>
        <Text style={{ flex: 1, fontSize: 11, fontWeight: "800", color: "#94A3B8", letterSpacing: 0.5, textAlign: "center" }}>ASK</Text>
      </View>

      <DraggableFlatList
        data={visible}
        keyExtractor={(i) => `${i.exch}-${i.token}`}
        onDragEnd={handleDragEnd}
        activationDistance={12}
        contentContainerStyle={{ paddingBottom: 90, backgroundColor: "#fff" }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 48, gap: 8 }}>
            <Ionicons name={activeTab === "Favorites" ? "star-outline" : "grid-outline"} size={34} color="#CBD5E1" />
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#94A3B8" }}>
              {activeTab === "Favorites" ? "No favorites yet — tap the star on a script" : "No scripts yet"}
            </Text>
          </View>
        }
        renderItem={({ item, isActive, drag }) => {
          const key = skey(item);
          const lp: any = livePrices[item.token];
          const bid = lp?.bestBid ?? lp?.bid;
          const ask = lp?.bestAsk ?? lp?.ask;
          const chg = lp?.change;
          const pct = lp?.changePercent;
          const up = (chg ?? 0) >= 0;
          const low = lp?.low;
          const high = lp?.high;
          const hasDec = [bid, ask, low, high, chg].some((v) => v != null && !Number.isInteger(Number(v)));
          const fmt = (v: any) =>
            v == null ? "—"
            : hasDec ? Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : Number(v).toLocaleString("en-IN");
          const Row = (
            <Pressable onLongPress={drag} delayLongPress={250} style={{ backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1.4, paddingRight: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontWeight: "900", color: NAVY, fontSize: 14.5, letterSpacing: -0.2 }}>{item.label}</Text>
                  <View style={{ backgroundColor: "#EEF2F7", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1.5 }}>
                    <Text style={{ fontSize: 8.5, fontWeight: "800", color: "#64748B", letterSpacing: 0.5 }}>{item.exch}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, fontWeight: "800", color: up ? "#059669" : "#DC2626", marginTop: 3 }}>
                  {chg != null ? `${up ? "+" : ""}${fmt(chg)}  ${up ? "+" : ""}${Number(pct).toFixed(2)}%` : `+0${hasDec ? ".00" : ""}  +0.00%`}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontWeight: "800", color: "#2563EB", fontSize: 14, fontFamily: "monospace" }}>{fmt(bid)}</Text>
                <Text style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 3 }}>L: {fmt(low)}</Text>
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontWeight: "800", color: "#DC2626", fontSize: 14, fontFamily: "monospace" }}>{fmt(ask)}</Text>
                <Text style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 3 }}>H: {fmt(high)}</Text>
              </View>
              <Pressable onPress={() => toggleFav(key)} hitSlop={8} style={{ paddingLeft: 8 }}>
                <Ionicons name={favs[key] ? "star" : "star-outline"} size={20} color={favs[key] ? GOLD_BRIGHT : "#CBD5E1"} />
              </Pressable>
            </Pressable>
          );
          return (
            <ScaleDecorator>
              <ReanimatedSwipeable
                renderRightActions={() => (
                  <Pressable onPress={() => remove(key)} style={{ backgroundColor: "#DC2626", justifyContent: "center", alignItems: "center", width: 84 }}>
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginTop: 2 }}>DELETE</Text>
                  </Pressable>
                )}
                overshootRight={false}
              >
                {Row}
              </ReanimatedSwipeable>
            </ScaleDecorator>
          );
        }}
      />

      {/* ===== ADD INSTRUMENT SHEET ===== */}
      <Modal visible={pickerOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => { Keyboard.dismiss(); setPickerOpen(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "rgba(10,37,64,0.5)", justifyContent: "flex-end" }}>
          <Pressable onPress={() => { Keyboard.dismiss(); setPickerOpen(false); }} style={{ flex: 1 }} />
          <Pressable onPress={() => {}} keyboardShouldPersistTaps="handled" style={{ backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "85%", paddingBottom: 24 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginTop: 10, marginBottom: 12 }} />
            <View style={{ paddingHorizontal: 18 }}>
              <Text style={{ fontWeight: "900", fontSize: 16, color: NAVY, letterSpacing: -0.2 }}>Add Instrument</Text>
              {/* search input FIRST — always high on screen, never hidden by the keyboard */}
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 14, paddingHorizontal: 12, marginTop: 14 }}>
                <Ionicons name="search" size={17} color="#64748B" />
                <TextInput value={query} onChangeText={setQuery} placeholder={`Search ${filter}...`} placeholderTextColor="#94A3B8" style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, color: NAVY, fontSize: 15 }} autoFocus />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery("")} hitSlop={6}>
                    <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                  </Pressable>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                {(["MCX", "NSE", "BSE"] as const).map((opt) => (
                  <Pressable key={opt} onPress={() => setFilter(opt)} style={{ flex: 1, paddingVertical: 9, borderRadius: 20, backgroundColor: filter === opt ? NAVY : "#F1F5F9", alignItems: "center" }}>
                    <Text style={{ fontWeight: "800", fontSize: 12, letterSpacing: 0.5, color: filter === opt ? "#fff" : "#64748B" }}>{opt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 340 }}>
              {results.map((item) => (
                <Pressable key={`${item.exch}-${item.token}`} onPress={() => add(item)} style={{ paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ fontWeight: "800", color: NAVY, fontSize: 14 }}>{item.symbol || item.tsym}</Text>
                    <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{item.exch} · {item.token}</Text>
                  </View>
                  <View style={{ backgroundColor: GOLD, borderRadius: 16, width: 30, height: 30, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </View>
                </Pressable>
              ))}
              {query.trim().length >= 2 && results.length === 0 && (
                <View style={{ padding: 18, alignItems: "center" }}>
                  <Text style={{ fontSize: 12, color: "#94A3B8", fontWeight: "600" }}>No matches in {filter}</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}