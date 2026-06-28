import React, { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useListGames } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { GameCard } from "@/components/GameCard";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function GamesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { data: games, isLoading, refetch } = useListGames();

  // Register push notifications when the user is logged in
  usePushNotifications();

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) return <LoadingScreen />;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>
          SCRABBLE
        </Text>
        <TouchableOpacity style={styles.iconButton}>
          <Feather name="bell" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={games}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <GameCard game={item} currentUser={user} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="grid" size={48} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No active games</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Challenge a friend to get started!
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 100 }]}
        onPress={() => router.push("/(tabs)/friends")}
      >
        <Feather name="plus" size={32} color={colors.primaryForeground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 60,
    position: "relative",
  },
  headerTitle: { fontSize: 24, fontWeight: "900", letterSpacing: 2 },
  iconButton: { position: "absolute", right: 16 },
  listContent: { padding: 16 },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 80,
  },
  emptyTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  emptyText: { fontSize: 16, textAlign: "center" },
  fab: {
    position: "absolute",
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
