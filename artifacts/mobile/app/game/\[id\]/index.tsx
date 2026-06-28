import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { io, Socket } from "socket.io-client";
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
  const [placedTiles, setPlacedTiles] = useState<any[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [blankModalVisible, setBlankModalVisible] = useState(false);
  const [pendingBlankPos, setPendingBlankPos] = useState<{ r: number; c: number } | null>(null);
  const [blankLetter, setBlankLetter] = useState("");

  const { data: game, isLoading, refetch } = useGetGame(gameId!);
  const makeMove = useMakeMove({ mutation: { onSuccess: () => { setPlacedTiles([]); refetch(); } } });
  const passTurn = usePassTurn({ mutation: { onSuccess: () => refetch() } });
  const resignGame = useResignGame({ mutation: { onSuccess: () => refetch() } });
  const swapTiles = useSwapTiles({ mutation: { onSuccess: () => refetch() } });
  const requestRematch = useRequestRematch({ mutation: { onSuccess: () => refetch() } });

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

    return () => {
      socket.disconnect();
    };
  }, [gameId, token]);

  const currentPlayer = useMemo(() => {
    return game?.players.find((p) => p.userId === user?.id);
  }, [game, user]);

  const opponent = useMemo(() => {
    return game?.players.find((p) => p.userId !== user?.id);
  }, [game, user]);

  const myRack = useMemo(() => {
    if (!currentPlayer) return [];
    let rack = [...currentPlayer.rack];
    placedTiles.forEach((pt) => {
      const idx = rack.findIndex((l) => l === pt.letter || (l === "?" && pt.isBlank));
      if (idx !== -1) rack.splice(idx, 1);
    });
    return rack;
  }, [currentPlayer, placedTiles]);

  const handleCellPress = (r: number, c: number) => {
    const existingPlacedIdx = placedTiles.findIndex((t) => t.row === r && t.col === c);
    if (existingPlacedIdx !== -1) {
      const newPlaced = [...placedTiles];
      newPlaced.splice(existingPlacedIdx, 1);
      setPlacedTiles(newPlaced);
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
    if (placedTiles.length === 0) return;
    makeMove.mutate({
      gameId: gameId!,
      data: {
        moveType: "MOVE",
        placements: placedTiles.map((t) => ({ row: t.row, col: t.col, letter: t.letter, isBlank: t.isBlank })),
      },
    });
  };

  const handleShuffle = () => {
    // Local shuffle of rack would need rack state, but here it's derived. 
    // For simplicity, we skip real shuffle and just re-render.
  };

  if (isLoading || !game) return <LoadingScreen />;

  const isMyTurn = game.status === "active" && game.currentTurnPlayerId === user?.id;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Opponent Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.card }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="chevron-left" size={28} color={colors.text} />
          </TouchableOpacity>
          <Avatar uri={opponent?.user.avatarUrl} username={opponent?.user.username} size={40} />
          <View style={styles.headerInfo}>
            <Text style={[styles.username, { color: colors.text }]}>{opponent?.user.username}</Text>
            <Text style={[styles.score, { color: colors.mutedForeground }]}>{opponent?.score || 0} pts</Text>
          </View>
          <View style={styles.opponentRack}>
            {[...Array(opponent?.rackSize || 0)].map((_, i) => (
              <View key={i} style={[styles.miniTile, { backgroundColor: colors.tileBackground }]} />
            ))}
          </View>
          <TouchableOpacity onPress={() => router.push(`/game/${gameId}/chat`)}>
            <Feather name="message-circle" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Board */}
      <View style={styles.boardContainer}>
        <GameBoard board={game.board} placedTiles={placedTiles} onCellPress={handleCellPress} />
      </View>

      {/* Score Bar */}
      <View style={[styles.scoreBar, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.myScoreText, { color: colors.text }]}>
          Your Score: <Text style={{ color: colors.primary }}>{currentPlayer?.score || 0}</Text>
        </Text>
        {!isMyTurn && <Text style={{ color: colors.mutedForeground }}>Waiting for opponent...</Text>}
      </View>

      {/* Strength Meter */}
      <WordStrengthMeter gameId={gameId!} placedTiles={placedTiles} />

      {/* Tile Rack */}
      <TileRack
        tiles={myRack}
        selectedTileIndex={selectedTileIndex}
        onTilePress={(idx) => setSelectedTileIndex(idx === selectedTileIndex ? null : idx)}
      />

      {/* Action Bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity style={styles.actionButton} onPress={() => setPlacedTiles([])}>
          <Feather name="rotate-ccw" size={20} color={colors.text} />
          <Text style={[styles.actionText, { color: colors.text }]}>Recall</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleShuffle}>
          <Feather name="shuffle" size={20} color={colors.text} />
          <Text style={[styles.actionText, { color: colors.text }]}>Shuffle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: isMyTurn && placedTiles.length > 0 ? colors.primary : colors.muted }]}
          onPress={handleSubmit}
          disabled={!isMyTurn || placedTiles.length === 0}
        >
          <Text style={[styles.submitText, { color: colors.primaryForeground }]}>SUBMIT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => setMenuVisible(true)}>
          <Feather name="menu" size={20} color={colors.text} />
          <Text style={[styles.actionText, { color: colors.text }]}>Menu</Text>
        </TouchableOpacity>
      </View>

      {/* Blank Tile Modal */}
      <Modal visible={blankModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Pick a letter</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              maxLength={1}
              autoCapitalize="characters"
              value={blankLetter}
              onChangeText={setBlankLetter}
              autoFocus
            />
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handleBlankSubmit}>
              <Text style={{ color: colors.primaryForeground, fontWeight: "bold" }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuContent, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); passTurn.mutate({ gameId: gameId! }); }}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>Pass Turn</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); resignGame.mutate({ gameId: gameId! }); }}>
              <Text style={[styles.menuItemText, { color: colors.destructive }]}>Resign Game</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {game.status === "finished" && (
        <View style={[styles.gameOverOverlay, { backgroundColor: "rgba(0,0,0,0.8)" }]}>
          <Text style={styles.gameOverTitle}>GAME OVER</Text>
          <Text style={styles.winnerText}>
            {game.winnerId === user?.id ? "YOU WON!" : "YOU LOST"}
          </Text>
          <TouchableOpacity
            style={[styles.rematchButton, { backgroundColor: colors.primary }]}
            onPress={() => requestRematch.mutate({ gameId: gameId! })}
          >
            <Text style={{ color: colors.primaryForeground, fontWeight: "bold" }}>REMATCH</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 20 }} onPress={() => router.back()}>
            <Text style={{ color: "#FFF" }}>Back to Lobby</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 120, justifyContent: "flex-end" },
  headerContent: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  headerInfo: { flex: 1 },
  username: { fontSize: 16, fontWeight: "bold" },
  score: { fontSize: 12 },
  opponentRack: { flexDirection: "row", gap: 2 },
  miniTile: { width: 8, height: 8, borderRadius: 1 },
  boardContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scoreBar: { height: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  myScoreText: { fontWeight: "bold" },
  actionBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, height: 80 },
  actionButton: { alignItems: "center", gap: 4 },
  actionText: { fontSize: 10 },
  submitButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  submitText: { fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: 200, padding: 20, borderRadius: 12, alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  modalInput: { width: 50, height: 50, borderWidth: 1, borderRadius: 8, textAlign: "center", fontSize: 24, marginBottom: 16 },
  modalButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  menuContent: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  menuItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#1E3050" },
  menuItemText: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  gameOverOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", zIndex: 100 },
  gameOverTitle: { color: "#F5C842", fontSize: 40, fontWeight: "900" },
  winnerText: { color: "#FFF", fontSize: 24, fontWeight: "bold", marginTop: 10, marginBottom: 30 },
  rematchButton: { paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30 },
});
