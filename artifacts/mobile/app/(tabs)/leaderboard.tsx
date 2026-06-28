import React from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Avatar } from "@/components/Avatar";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/contexts/AuthContext";

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: leaderboard, isLoading, refetch } = useGetLeaderboard();

  if (isLoading) return <LoadingScreen />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>LEADERBOARD</Text>
      </View>

      <FlatList
        data={leaderboard}
        keyExtractor={item => item.userId}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No games played yet. Complete a game to appear here!
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 120, paddingHorizontal: 16 }}
        renderItem={({ item }) => {
          const isMe = item.userId === user?.id;
          return (
            <View
              style={[
                styles.row,
                { backgroundColor: isMe ? colors.primary + "22" : colors.card },
                isMe && { borderColor: colors.primary, borderWidth: 1 },
              ]}
            >
              <View style={styles.rankContainer}>
                {item.rank <= 3 ? (
                  <Text style={styles.medal}>{MEDAL[item.rank - 1]}</Text>
                ) : (
                  <Text style={[styles.rankNum, { color: colors.mutedForeground }]}>
                    {item.rank}
                  </Text>
                )}
              </View>

              <Avatar uri={item.avatarUrl} username={item.username} size={40} />

              <View style={styles.info}>
                <Text style={[styles.username, { color: isMe ? colors.primary : colors.text }]}>
                  {item.username}{isMe ? " (you)" : ""}
                </Text>
                <Text style={[styles.stats, { color: colors.mutedForeground }]}>
                  {item.gamesPlayed} games · {Math.round(item.winRate * 100)}% win rate
                </Text>
              </View>

              <View style={styles.winsContainer}>
                <Text style={[styles.winsNum, { color: colors.primary }]}>{item.wins}</Text>
                <Text style={[styles.winsLabel, { color: colors.mutedForeground }]}>wins</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    paddingHorizontal: 16, height: 60,
  },
  headerTitle: { fontSize: 22, fontWeight: "900", letterSpacing: 2 },
  row: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 12, padding: 12, marginBottom: 8, gap: 12,
  },
  rankContainer: { width: 32, alignItems: "center" },
  medal: { fontSize: 22 },
  rankNum: { fontSize: 16, fontWeight: "bold" },
  info: { flex: 1 },
  username: { fontSize: 15, fontWeight: "700" },
  stats: { fontSize: 12, marginTop: 2 },
  winsContainer: { alignItems: "center" },
  winsNum: { fontSize: 22, fontWeight: "900" },
  winsLabel: { fontSize: 11 },
  empty: { alignItems: "center", marginTop: 80, paddingHorizontal: 24 },
  emptyText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
});
