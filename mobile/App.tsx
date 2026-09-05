import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { WatchlistScreen } from './src/screens/Watchlist';
import { light, dark } from './src/theme/tv';

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const theme = isDark ? dark : light;
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', padding: 16, paddingTop: 48, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>BULLIONAI</Text>
        <Pressable onPress={() => setIsDark(!isDark)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: theme.border }}>
          <Text style={{ color: theme.text, fontSize: 12 }}>{isDark ? '☀ Light' : '🌙 Dark'}</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1, width: '100%' }}>
        <WatchlistScreen theme={theme} />
      </View>
      <Text style={{ color: theme.muted, fontSize: 11, padding: 12 }}>TradingView premium • 44px rows • JetBrains Mono • MCX live via backend.bullionai.in</Text>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
