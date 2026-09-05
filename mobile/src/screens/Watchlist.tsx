import { View, Text, FlatList } from "react-native";

// TradingView premium Watchlist — 44px rows, Mono 11px, Sparkline placeholder
export function WatchlistScreen({ theme }: { theme: any }) {
  const data = [
    { sym: "GOLD", price: "1,51,086", chg: "-0.40%", up: false },
    { sym: "SILVER", price: "2,34,823", chg: "+0.12%", up: true },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 12 }}>
      <Text style={{ color: theme.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 }}>WATCHLIST • MCX</Text>
      <FlatList
        data={data}
        keyExtractor={(i) => i.sym}
        renderItem={({ item }) => (
          <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: theme.border, paddingHorizontal: 8 }}>
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>{item.sym}</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Text style={{ color: theme.text, fontFamily: "JetBrainsMono", fontSize: 11 }}>{item.price}</Text>
              <Text style={{ color: item.up ? theme.up : theme.down, fontSize: 11, fontWeight: "700" }}>{item.chg}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}
