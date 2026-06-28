import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { io } from "socket.io-client";
import {
  useGetGame,
  useMakeMove,
  usePassTurn,
  useResignGame,
  useSwapTiles,
  useRequestRematch,
  useGetBestWordHint,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { GameBoard } from "@/components/GameBoard";
import { TileRack } from "@/components/TileRack";
import { TileComponent } from "@/components/TileComponent";
import { WordStrengthMeter } from "@/components/WordStrengthMeter";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Avatar } from "@/components/Avatar";
import { useQueryClient } from "@tanstack/react-query";

export default function GameScreen() {
  const { id: gameId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token, user } = useAuth();

  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);
  const [placedTiles, setPlacedTiles] = useState<
    { row: number; col: number; letter: string; isBlank: boolean }[]
  >([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [blankModalVisible, setBlankModalVisible] = useState(false);
  const [pendingBlankPos, setPendingBlankPos] = useState<{ r: number; c: number } | null>(null);
  const [blankLetter, setBlankLetter] = useState("");

  // Swap tiles state
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [swapSelected, setSwapSelected] = useState<number[]>([]);

  // Hint state
  const [hintVisible, setHintVisible] = useState(false);
  const [hintTiles, setHintTiles] = useState<{ row: number; col: number; letter: string; isBlank: boolean }[]>([]);

  const { data: game, isLoading, refetch } = useGetGame(gameId!);
  const makeMove = useMakeMove({
    mutation: {
      onSuccess: () => {
        setPlacedTiles([]);
        setHintTiles([]);
        setHintVisible(false);
        refetch();
      },
    },
  });
  const passTurn = usePassTurn({ mutation: { onSuccess: () => refetch() } });
  const resignGame = useResignGame({
    mutation: { onSuccess: () => { refetch(); router.back(); } },
  });
  const swapTilesMutation = useSwapTiles({ mutation: { onSuccess: () => { setSwapSelected([]); setSwapModalVisible(false); refetch(); } } });
  const requestRematch = useRequestRematch({ mutation: { onSuccess: () => refetch() } });
  const { data: hint, refetch: fetchHint, isFetching: hintLoading } = useGetBestWordHint(gameId!, {
    query: { enabled: false, queryKey: [`/api/games/${gameId}/hint`] as const },
  });

  useEffect(() => {
    if (!token || !gameId) return;
    const socket = io(`https://${process.env.EXPO_PUBLIC_DOMAIN}`, {
      auth: { token },
      transports: ["websocket"],
    });
    socket.emit("join_game", gameId);
    socket.on("game_updated", () => {
      queryClient.invalidateQueries({ queryKey: [`/api/games/${gameId}`] });
    });
    return () => { socket.disconnect(); };
  }, [gameId, token]);

  // Apply hint tiles when hint data arrives
  useEffect(() => {
    if (hint && hint.tiles.length > 0) {
      setHintTiles(
        hint.tiles.map((t) => ({ row: t.row, col: t.col, letter: t.letter, isBlank: t.isBlank }))
      );
      setHintVisible(true);
    }
  }, [hint]);

  const opponent = useMemo(
    () => game?.players.find((p) => p.userId !== user?.id),
    [game, user]
  );
  const me = useMemo(
    () => game?.players.find((p) => p.userId === user?.id),
    [game, user]
  );

  const myRack = useMemo(() => {
    if (!game) return [];
    let rack = [...game.myRack];
    placedTiles.forEach((pt) => {
      const idx = rack.findIndex((l) => l === pt.letter || (l === "?" && pt.isBlank));
      if (idx !== -1) rack.splice(idx, 1);
    });
    return rack;
  }, [game, placedTiles]);

  const handleCellPress = (r: number, c: number) => {
    if (hintVisible) {
      setHintVisible(false);
      setHintTiles([]);
      return;
    }
    const existingIdx = placedTiles.findIndex((t) => t.row === r && t.col === c);
    if (existingIdx !== -1) {
      const updated = [...placedTiles];
      updated.splice(existingIdx, 1);
      setPlacedTiles(updated);
      return;
    }
    if (selectedTileIndex === null || game?.board[r][c].letter) return;
    const letter = myRack[selectedTileIndex];
    if (letter === "?") {
      setPendingBlankPos({ r, c });
      setBlankModalVisible(true);
    } else {
      setPlacedTiles([...placedTiles, { row: r, col: c, letter, isBlank: false }]);
      setSelectedTileIndex(null);
    }
  };

  const handleBlankSubmit = () => {
    if (blankLetter.length !== 1 || !pendingBlankPos) return;
    setPlacedTiles([
      ...placedTiles,
      { row: pendingBlankPos.r, col: pendingBlankPos.c, letter: blankLetter.toUpperCase(), isBlank: true },
    ]);
    setBlankModalVisible(false);
    setPendingBlankPos(null);
    setBlankLetter("");
    setSelectedTileIndex(null);
  };

  const handleSubmit = () => {
    const tilesToSubmit = hintVisible ? hintTiles : placedTiles;
    if (tilesToSubmit.length === 0) return;
    makeMove.mutate({
      gameId: gameId!,
      data: { tiles: tilesToSubmit.map((t) => ({ row: t.row, col: t.col, letter: t.letter, isBlank: t.isBlank })) },
    });
  };

  const handleHint = () => {
    setMenuVisible(false);
    fetchHint();
  };

  const handleResign = () => {
    Alert.alert("Resign", "Are you sure you want to resign this game?", [
      { text: "Cancel", style: "cancel" },
      { text: "Resign", style: "destructive", onPress: () => { setMenuVisible(false); resignGame.mutate({ gameId: gameId! }); } },
    ]);
  };

  const handleSwapConfirm = () => {
    if (swapSelected.length === 0) return;
    const letters = swapSelected.map((i) => myRack[i]);
    swapTilesMutation.mutate({ gameId: gameId!, data: { letters } });
  };

  if (isLoading || !game) return <LoadingScreen />;

  const isMyTurn = me?.isCurrentTurn ?? false;
  const displayedPlacedTiles = hintVisible ? hintTiles : placedTiles;
  const canSubmit = isMyTurn && displayedPlacedTiles.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Opponent Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.card }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="chevron-left" size={28} color={colors.text} />
          </TouchableOpacity>
          <Avatar uri={opponent?.avatarUrl} username={opponent?.username} size={40} />
          <View style={styles.headerInfo}>
            <Text style={[styles.username, { color: colors.text }]}>{opponent?.username ?? "Opponent"}</Text>
            <Text style={[styles.scoreText, { color: colors.mutedForeground }]}>{opponent?.score ?? 0} pts</Text>
          </View>
          <View style={styles.opponentRack}>
            {Array.from({ length: opponent?.rackSize ?? 0 }).map((_, i) => (
              <View key={i} style={[styles.miniTile, { backgroundColor: colors.tileBackground }]} />
            ))}
          </View>
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/game/[id]/chat", params: { id: gameId } } as any)}
          >
            <Feather name="message-circle" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Board */}
      <View style={styles.boardContainer}>
        <GameBoard board={game.board} placedTiles={displayedPlacedTiles} onCellPress={handleCellPress} />
      </View>

      {/* Hint Banner */}
      {hintVisible && hint && (
        <TouchableOpacity
          style={[styles.hintBanner, { backgroundColor: colors.accent }]}
          onPress={() => { setHintVisible(false); setHintTiles([]); }}
        >
          <Feather name="zap" size={16} color="#FFF" />
          <Text style={styles.hintText}>
            Best word: <Text style={{ fontWeight: "bold" }}>{hint.word}</Text> (+{hint.score} pts) — tap to dismiss
          </Text>
        </TouchableOpacity>
      )}

      {/* Score Bar */}
      <View style={[styles.scoreBar, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.myScoreText, { color: colors.text }]}>
          You: <Text style={{ color: colors.primary, fontWeight: "bold" }}>{me?.score ?? 0}</Text>
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
          Bag: {game.bagSize} tiles
        </Text>
        {isMyTurn ? (
          <Text style={{ color: colors.primary, fontWeight: "bold" }}>YOUR TURN</Text>
        ) : (
          <Text style={{ color: colors.mutedForeground }}>Waiting...</Text>
        )}
      </View>

      {/* Strength Meter */}
      {!hintVisible && (
        <WordStrengthMeter gameId={gameId!} placedTiles={placedTiles} />
      )}

      {/* Tile Rack */}
      <TileRack
        tiles={myRack}
        selectedTileIndex={selectedTileIndex}
        onTilePress={(idx) => {
          if (hintVisible) { setHintVisible(false); setHintTiles([]); }
          setSelectedTileIndex(idx === selectedTileIndex ? null : idx);
        }}
      />

      {/* Action Bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 8, backgroundColor: colors.rackBackground }]}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => { setPlacedTiles([]); setHintVisible(false); setHintTiles([]); }}
        >
          <Feather name="rotate-ccw" size={20} color={colors.tileBackground} />
          <Text style={[styles.actionText, { color: colors.tileBackground }]}>Recall</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: canSubmit ? colors.primary : colors.muted },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || makeMove.isPending}
        >
          <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
            {makeMove.isPending ? "..." : hintVisible ? "PLAY HINT" : "SUBMIT"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => setMenuVisible(true)}>
          <Feather name="more-horizontal" size={20} color={colors.tileBackground} />
          <Text style={[styles.actionText, { color: colors.tileBackground }]}>More</Text>
        </TouchableOpacity>
      </View>

      {/* Blank Tile Modal */}
      <Modal visible={blankModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choose a letter for blank tile</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]}
              maxLength={1}
              autoCapitalize="characters"
              value={blankLetter}
              onChangeText={setBlankLetter}
              autoFocus
            />
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={handleBlankSubmit}>
              <Text style={{ color: colors.primaryForeground, fontWeight: "bold", fontSize: 16 }}>Place Tile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Swap Tiles Modal */}
      <Modal visible={swapModalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.swapBox, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select tiles to swap</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              Tap tiles to select, then confirm
            </Text>
            <View style={styles.swapTiles}>
              {myRack.map((letter, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() =>
                    setSwapSelected((prev) =>
                      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
                    )
                  }
                >
                  <TileComponent
                    letter={letter}
                    isBlank={letter === "?"}
                    size={52}
                    isSelected={swapSelected.includes(i)}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.swapActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.muted, flex: 1 }]}
                onPress={() => { setSwapModalVisible(false); setSwapSelected([]); }}
              >
                <Text style={{ color: colors.mutedForeground, fontWeight: "bold" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { backgroundColor: swapSelected.length > 0 ? colors.primary : colors.muted, flex: 1 },
                ]}
                onPress={handleSwapConfirm}
                disabled={swapSelected.length === 0 || swapTilesMutation.isPending}
              >
                <Text style={{ color: colors.primaryForeground, fontWeight: "bold" }}>
                  Swap {swapSelected.length > 0 ? `(${swapSelected.length})` : ""}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* More Menu */}
      <Modal visible={menuVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View
            style={[styles.menuSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}
          >
            <View style={[styles.menuHandle, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setMenuVisible(false); passTurn.mutate({ gameId: gameId! }); }}
            >
              <Feather name="skip-forward" size={22} color={colors.text} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Pass Turn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                if (game.bagSize < myRack.length) {
                  Alert.alert("Cannot Swap", "Not enough tiles in the bag to swap.");
                  return;
                }
                setMenuVisible(false);
                setSwapModalVisible(true);
              }}
            >
              <Feather name="refresh-cw" size={22} color={colors.text} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Swap Tiles</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleHint}>
              <Feather name="zap" size={22} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.primary }]}>
                {hintLoading ? "Finding best word..." : "Show Best Word Hint"}
              </Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={styles.menuItem} onPress={handleResign}>
              <Feather name="flag" size={22} color={colors.destructive} />
              <Text style={[styles.menuItemText, { color: colors.destructive }]}>Resign Game</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Game Over Overlay */}
      {game.status === "finished" && (
        <View style={[styles.gameOverOverlay, { backgroundColor: "rgba(0,0,0,0.88)" }]}>
          <Text style={[styles.gameOverTitle, { color: colors.primary }]}>GAME OVER</Text>
          <Text style={styles.winnerText}>
            {game.winnerId === user?.id ? "🏆  YOU WON!" : "You lost"}
          </Text>
          <Text style={[styles.finalScoreText, { color: colors.mutedForeground }]}>
            {me?.score ?? 0} – {opponent?.score ?? 0}
          </Text>
          <TouchableOpacity
            style={[styles.rematchBtn, { backgroundColor: colors.primary }]}
            onPress={() => requestRematch.mutate({ gameId: gameId! })}
          >
            <Text style={{ color: colors.primaryForeground, fontWeight: "bold", fontSize: 16 }}>REMATCH</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 20 }} onPress={() => router.back()}>
            <Text style={{ color: "#FFFFFF", fontSize: 16 }}>Back to Lobby</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { justifyContent: "flex-end" },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  headerInfo: { flex: 1 },
  username: { fontSize: 16, fontWeight: "bold" },
  scoreText: { fontSize: 12 },
  opponentRack: { flexDirection: "row", gap: 2 },
  miniTile: { width: 8, height: 8, borderRadius: 1 },
  boardContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  hintBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  hintText: { color: "#FFF", fontSize: 13, flex: 1 },
  scoreBar: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  myScoreText: { fontSize: 15 },
  actionBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    height: 80,
  },
  actionBtn: { alignItems: "center", gap: 4, minWidth: 56 },
  actionText: { fontSize: 11 },
  submitButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
    minWidth: 130,
    alignItems: "center",
  },
  submitText: { fontWeight: "bold", fontSize: 15 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: { width: 280, padding: 24, borderRadius: 16, alignItems: "center", gap: 16 },
  swapBox: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", textAlign: "center" },
  modalSub: { fontSize: 14, textAlign: "center" },
  modalInput: {
    width: 60, height: 60,
    borderWidth: 2, borderRadius: 8,
    textAlign: "center", fontSize: 28,
  },
  modalBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    minWidth: 100,
  },
  swapTiles: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  swapActions: { flexDirection: "row", gap: 12 },
  menuSheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 4,
  },
  menuHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 16,
  },
  menuItemText: { fontSize: 17, fontWeight: "600" },
  menuDivider: { height: 1, marginVertical: 4 },
  gameOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    gap: 8,
  },
  gameOverTitle: { fontSize: 42, fontWeight: "900" },
  winnerText: { color: "#FFF", fontSize: 26, fontWeight: "bold" },
  finalScoreText: { fontSize: 20, marginBottom: 16 },
  rematchBtn: { paddingHorizontal: 48, paddingVertical: 16, borderRadius: 32 },
});
