import React, { useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import type { FriendEntry } from "@workspace/api-client-react";
import {
  useListFriends,
  useSearchUsers,
  useSendFriendRequest,
  useRespondFriendRequest,
  useCreateGame,
  useCreateInviteLink,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Avatar } from "@/components/Avatar";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useRouter } from "expo-router";

export default function FriendsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"friends" | "pending">("friends");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: friendsList, isLoading, refetch } = useListFriends();
  const searchUsersQueryKey = [`/api/users/search`, { q: searchQuery }] as const;
  const { data: searchResults } = useSearchUsers(
    { q: searchQuery },
    { query: { enabled: searchQuery.length > 2, queryKey: searchUsersQueryKey } }
  );

  const sendRequest = useSendFriendRequest({ mutation: { onSuccess: () => refetch() } });
  const respondRequest = useRespondFriendRequest({ mutation: { onSuccess: () => refetch() } });
  const createGame = useCreateGame({
    mutation: {
      onSuccess: (game) => {
        router.push({ pathname: "/game/[id]", params: { id: game.id } } as any);
      },
    },
  });
  const createInvite = useCreateInviteLink();

  const handleShareInvite = async () => {
    try {
      const invite = await createInvite.mutateAsync();
      await Share.share({
        message: `Join me on Scrabble! Invite code: ${invite.token}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  if (isLoading) return <LoadingScreen />;

  const friends = friendsList?.friends ?? [];
  const pendingIncoming = friendsList?.pendingReceived ?? [];
  const pendingOutgoing = friendsList?.pendingSent ?? [];

  const renderFriendItem = ({ item }: { item: FriendEntry }) => (
    <TouchableOpacity
      style={[styles.listItem, { backgroundColor: colors.card }]}
      onPress={() =>
        createGame.mutate({ data: { opponentId: item.user.id } })
      }
    >
      <Avatar uri={item.user.avatarUrl} username={item.user.username} size={40} />
      <Text style={[styles.username, { color: colors.text }]}>{item.user.username}</Text>
      <Feather name="play" size={20} color={colors.primary} />
    </TouchableOpacity>
  );

  const renderPendingItem = ({ item, isIncoming }: { item: FriendEntry; isIncoming: boolean }) => (
    <View style={[styles.listItem, { backgroundColor: colors.card }]}>
      <Avatar uri={item.user.avatarUrl} username={item.user.username} size={40} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.username, { color: colors.text }]}>{item.user.username}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
          {isIncoming ? "Wants to be friends" : "Request sent"}
        </Text>
      </View>
      {isIncoming && (
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.accent }]}
            onPress={() =>
              respondRequest.mutate({
                friendshipId: item.friendshipId,
                data: { action: "accept" },
              })
            }
          >
            <Feather name="check" size={18} color={colors.accentForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.destructive }]}
            onPress={() =>
              respondRequest.mutate({
                friendshipId: item.friendshipId,
                data: { action: "decline" },
              })
            }
          >
            <Feather name="x" size={18} color={colors.destructiveForeground} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const pendingAll: Array<{ item: FriendEntry; isIncoming: boolean }> = [
    ...pendingIncoming.map((e) => ({ item: e, isIncoming: true })),
    ...pendingOutgoing.map((e) => ({ item: e, isIncoming: false })),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>FRIENDS</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
          <Feather name="search" size={20} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search users..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {searchQuery.length > 2 && searchResults ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.listItem, { backgroundColor: colors.card }]}>
              <Avatar uri={item.avatarUrl} username={item.username} size={40} />
              <Text style={[styles.username, { color: colors.text }]}>{item.username}</Text>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={() => sendRequest.mutate({ data: { addresseeId: item.id } })}
              >
                <Text style={[styles.actionButtonText, { color: colors.primaryForeground }]}>
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "friends" && {
                  borderBottomColor: colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => setActiveTab("friends")}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === "friends" ? colors.primary : colors.mutedForeground },
                ]}
              >
                Friends ({friends.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "pending" && {
                  borderBottomColor: colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => setActiveTab("pending")}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === "pending" ? colors.primary : colors.mutedForeground },
                ]}
              >
                Pending ({pendingIncoming.length + pendingOutgoing.length})
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === "friends" ? (
            <FlatList
              data={friends}
              keyExtractor={(item) => item.friendshipId}
              renderItem={renderFriendItem}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
              }
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No friends yet. Search for users to add them!
                </Text>
              }
            />
          ) : (
            <FlatList
              data={pendingAll}
              keyExtractor={(item) => item.item.friendshipId}
              renderItem={({ item }) => renderPendingItem(item)}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
              }
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No pending requests
                </Text>
              }
            />
          )}

          <TouchableOpacity
            style={[
              styles.inviteButton,
              { backgroundColor: colors.secondary, marginBottom: insets.bottom + 100 },
            ]}
            onPress={handleShareInvite}
          >
            <Feather name="share-2" size={20} color={colors.secondaryForeground} />
            <Text style={[styles.inviteButtonText, { color: colors.secondaryForeground }]}>
              Share Invite Link
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 60, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  searchContainer: { padding: 16 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 8,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16 },
  tabs: {
    flexDirection: "row",
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#1E3050",
  },
  tab: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabText: { fontSize: 14, fontWeight: "bold" },
  listContent: { padding: 16 },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  username: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: "600" },
  actionButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  actionButtonText: { fontWeight: "bold" },
  requestActions: { flexDirection: "row", gap: 8 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    margin: 16,
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  inviteButtonText: { fontWeight: "bold", fontSize: 16 },
  emptyText: { textAlign: "center", marginTop: 40, fontSize: 16 },
});
