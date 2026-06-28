import React, { useState, useEffect } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { io } from "socket.io-client";
import {
  useGetChatMessages,
  useSendChatMessage,
  useGetGame,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useQueryClient } from "@tanstack/react-query";

export default function ChatScreen() {
  const { id: gameId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  const { data: messages, isLoading } = useGetChatMessages(gameId!);
  const { data: game } = useGetGame(gameId!);
  const sendMessage = useSendChatMessage();

  useEffect(() => {
    if (!token || !gameId) return;
    const socket = io(`https://${process.env.EXPO_PUBLIC_DOMAIN}`, {
      auth: { token },
      transports: ["websocket"],
    });
    socket.emit("join_game", gameId);
    socket.on("chat_message", () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/${gameId}`] });
    });
    return () => {
      socket.disconnect();
    };
  }, [gameId, token]);

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage.mutate({ gameId: gameId!, data: { message: text.trim() } });
    setText("");
  };

  if (isLoading) return <LoadingScreen />;

  const opponent = game?.players.find((p) => p.userId !== user?.id);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.card }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="chevron-left" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {opponent?.username ?? "Chat"}
          </Text>
          <View style={{ width: 28 }} />
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        inverted
        renderItem={({ item }) => {
          const isMine = item.userId === user?.id;
          return (
            <View style={[styles.messageRow, isMine ? styles.myRow : styles.theirRow]}>
              <View
                style={[
                  styles.bubble,
                  {
                    backgroundColor: isMine ? colors.primary : colors.card,
                    borderBottomRightRadius: isMine ? 0 : 12,
                    borderBottomLeftRadius: isMine ? 12 : 0,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    { color: isMine ? colors.primaryForeground : colors.text },
                  ]}
                >
                  {item.message}
                </Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No messages yet. Say hello!
          </Text>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.inputBar,
            { paddingBottom: insets.bottom + 8, backgroundColor: colors.card },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.background },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.primary }]}
            onPress={handleSend}
          >
            <Feather name="send" size={20} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { justifyContent: "flex-end" },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold" },
  listContent: { padding: 16, flexGrow: 1 },
  messageRow: { marginBottom: 12, maxWidth: "80%" },
  myRow: { alignSelf: "flex-end" },
  theirRow: { alignSelf: "flex-start" },
  bubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  messageText: { fontSize: 16 },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { textAlign: "center", marginTop: 40, fontSize: 16 },
});
