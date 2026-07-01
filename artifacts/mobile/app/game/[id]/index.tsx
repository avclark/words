import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
  useSendChatMessage,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { GameBoard, CELL_SIZE, CELL_MARGIN, BOARD_PADDING } from "@/components/GameBoard";
import { TileComponent } from "@/components/TileComponent";
import { WordStrengthMeter } from "@/components/WordStrengthMeter";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Avatar } from "@/components/Avatar";
import { useQueryClient } from "@tanstack/react-query";

const CELL_TOTAL = CELL_SIZE + CELL_MARGIN * 2;
const BOARD_SIZE = 15 * CELL_TOTAL + 2 * BOARD_PADDING;

const QUICK_EMOJIS = ["👍", "🤩", "😱", "😈", "🤔", "😅", "🎉", "💀"];

type PlacedTile = { row: number; col: number; letter: string; isBlank: boolean };

export default function GameScreen() {
  const { id: gameId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token, user } = useAuth();

  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);
  const [placedTiles, setPlacedTiles] = useState<PlacedTile[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [blankModalVisible, setBlankModalVisible] = useState(false);
  const [pendingBlankPos, setPendingBlankPos] = useState<{ r: number; c: number } | null>(null);
  const [blankLetter, setBlankLetter] = useState("");
  const [pendingDragTileIndex, setPendingDragTileIndex] = useState<number | null>(null);
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [swapSelected, setSwapSelected] = useState<number[]>([]);
  const [hintVisible, setHintVisible] = useState(false);
  const [hintTiles, setHintTiles] = useState<PlacedTile[]>([]);
  const [emojiPanelVisible, setEmojiPanelVisible] = useState(false);
  const [floatingEmoji, setFloatingEmoji] = useState<string | null>(null);
  const [resignConfirmVisible, setResignConfirmVisible] = useState(false);

  // Drag-and-drop state
  const boardRef = useRef<View>(null);
  const boardLayout = useRef({ x: 0, y: 0 });
  const dragAnim = useRef(new Animated.ValueXY()).current;
  const [isDragging, setIsDragging] = useState(false);
  const [dragLetter, setDragLetter] = useState("");
  const [dropHighlight, setDropHighlight] = useState<{ row: number; col: number } | null>(null);

  // Refs for stale-closure-safe access in PanResponders
  const placedTilesRef = useRef(placedTiles);
  const gameRef = useRef<any>(null);
  const myRackRef = useRef<string[]>([]);
  const hintVisibleRef = useRef(hintVisible);
  const isDraggingRef = useRef(false); // tracks live drag state (setState is async, ref is sync)
  useEffect(() => { placedTilesRef.current = placedTiles; }, [placedTiles]);
  useEffect(() => { hintVisibleRef.current = hintVisible; }, [hintVisible]);

  const { data: game, isLoading, refetch } = useGetGame(gameId!);
  useEffect(() => { gameRef.current = game; }, [game]);

  const makeMove = useMakeMove({
    mutation: { onSuccess: () => { setPlacedTiles([]); setHintTiles([]); setHintVisible(false); refetch(); } },
  });
  const passTurn = usePassTurn({ mutation: { onSuccess: () => refetch() } });
  const resignGame = useResignGame({
    mutation: { onSuccess: () => router.replace("/(tabs)" as any) },
  });
  const swapTilesMutation = useSwapTiles({
    mutation: { onSuccess: () => { setSwapSelected([]); setSwapModalVisible(false); refetch(); } },
  });
  const requestRematch = useRequestRematch({
    mutation: {
      onSuccess: (newGame) => {
        router.replace({ pathname: "/game/[id]", params: { id: newGame.id } } as any);
      },
    },
  });
  const sendEmoji = useSendChatMessage();
  const { data: hint, refetch: fetchHint, isFetching: hintLoading } = useGetBestWordHint(gameId!, {
    query: { enabled: false, queryKey: [`/api/games/${gameId}/hint`] as const },
  });

  // WebSocket for live updates + emoji display
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
    socket.on("chat_message", (msg: any) => {
      const text: string = msg?.message ?? "";
      if (/^\p{Emoji}/u.test(text) && text.trim().length <= 4) {
        showFloatingEmoji(text.trim());
      }
      queryClient.invalidateQueries({ queryKey: [`/api/chat/${gameId}`] });
    });
    return () => { socket.disconnect(); };
  }, [gameId, token]);

  const showFloatingEmoji = (emoji: string) => {
    setFloatingEmoji(emoji);
    setTimeout(() => setFloatingEmoji(null), 2000);
  };

  // No hint useEffect — handleHint uses the fetchHint() return value directly so
  // re-tapping after recall always triggers a fresh visual update.

  const opponent = useMemo(() => game?.players.find(p => p.userId !== user?.id), [game, user]);
  const me = useMemo(() => game?.players.find(p => p.userId === user?.id), [game, user]);

  const myRack = useMemo(() => {
    if (!game) return [];
    let rack = [...game.myRack];
    placedTiles.forEach(pt => {
      const idx = rack.findIndex(l => l === pt.letter || (l === "?" && pt.isBlank));
      if (idx !== -1) rack.splice(idx, 1);
    });
    return rack;
  }, [game, placedTiles]);

  useEffect(() => { myRackRef.current = myRack; }, [myRack]);

  // Board layout measurement — account for centering offset.
  // boardContainer is flex:1; the GameBoard is a fixed-size child centered inside it.
  // measure() gives the container's screen-absolute top-left, so we shift by the centering gap.
  const onBoardLayout = useCallback(() => {
    boardRef.current?.measure((_, __, containerW, containerH, pageX, pageY) => {
      boardLayout.current = {
        x: pageX + Math.max(0, (containerW - BOARD_SIZE) / 2),
        y: pageY + Math.max(0, (containerH - BOARD_SIZE) / 2),
      };
    });
  }, []);

  const calcDropCell = useCallback((pageX: number, pageY: number) => {
    const col = Math.floor((pageX - boardLayout.current.x - BOARD_PADDING) / CELL_TOTAL);
    const row = Math.floor((pageY - boardLayout.current.y - BOARD_PADDING) / CELL_TOTAL);
    if (row >= 0 && row < 15 && col >= 0 && col < 15) return { row, col };
    return null;
  }, []);

  // PanResponder for rack tiles — handles both tap and drag from a plain View.
  //
  // Why not TouchableOpacity + PanResponder?
  //   On native iOS, TouchableOpacity owns the touch after onStartShouldSetResponder.
  //   The PanResponder's onMoveShouldSetPanResponderCapture cannot steal it reliably.
  //
  // Strategy:
  //   • onStartShouldSetPanResponder: always true — PanResponder claims every touch.
  //   • onPanResponderGrant: init position, but DON'T set isDragging yet (no floating tile).
  //   • onPanResponderMove: once gestureState.dx/dy > 8, start the drag via isDraggingRef.
  //   • onPanResponderRelease: if isDraggingRef → drop tile; otherwise → tap-select.
  //   • isDraggingRef is a plain ref so PanResponder handlers always see the live value
  //     (useState is async and would be stale inside a memoised closure).
  const panResponders = useMemo(() => {
    return myRackRef.current.map((letter, tileIndex) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          isDraggingRef.current = false;
          const { pageX, pageY } = evt.nativeEvent;
          // Pre-position the animated tile so it's ready the moment dragging begins
          dragAnim.setValue({ x: pageX - 22, y: pageY - 44 });
        },
        onPanResponderMove: (evt, gestureState) => {
          const { pageX, pageY } = evt.nativeEvent;
          // Activate drag once movement crosses the threshold
          if (!isDraggingRef.current && (Math.abs(gestureState.dx) > 8 || Math.abs(gestureState.dy) > 8)) {
            isDraggingRef.current = true;
            setIsDragging(true);
            setDragLetter(myRackRef.current[tileIndex] ?? letter);
            if (hintVisibleRef.current) { setHintVisible(false); setHintTiles([]); }
          }
          if (isDraggingRef.current) {
            dragAnim.setValue({ x: pageX - 22, y: pageY - 44 });
            const cell = calcDropCell(pageX, pageY);
            const g = gameRef.current;
            if (cell && g && !g.board[cell.row][cell.col].letter &&
              !placedTilesRef.current.find(t => t.row === cell.row && t.col === cell.col)) {
              setDropHighlight(cell);
            } else {
              setDropHighlight(null);
            }
          }
        },
        onPanResponderRelease: (evt) => {
          if (isDraggingRef.current) {
            // Drop: place tile on board
            const { pageX, pageY } = evt.nativeEvent;
            const cell = calcDropCell(pageX, pageY);
            const g = gameRef.current;
            const ltr = myRackRef.current[tileIndex] ?? letter;
            if (cell && g && !g.board[cell.row][cell.col].letter &&
              !placedTilesRef.current.find(t => t.row === cell.row && t.col === cell.col)) {
              if (ltr === "?") {
                setPendingBlankPos({ r: cell.row, c: cell.col });
                setPendingDragTileIndex(tileIndex);
                setBlankModalVisible(true);
              } else {
                setPlacedTiles(prev => [...prev, { row: cell.row, col: cell.col, letter: ltr, isBlank: false }]);
              }
            }
          } else {
            // Tap: toggle tile selection
            if (hintVisibleRef.current) { setHintVisible(false); setHintTiles([]); }
            setSelectedTileIndex(prev => prev === tileIndex ? null : tileIndex);
          }
          isDraggingRef.current = false;
          setIsDragging(false);
          setDropHighlight(null);
        },
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
          setIsDragging(false);
          setDropHighlight(null);
        },
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRack.join(","), calcDropCell]);

  const handleCellPress = (r: number, c: number) => {
    if (hintVisible) { setHintVisible(false); setHintTiles([]); return; }
    const existingIdx = placedTiles.findIndex(t => t.row === r && t.col === c);
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
      setPendingDragTileIndex(null);
      setBlankModalVisible(true);
    } else {
      setPlacedTiles([...placedTiles, { row: r, col: c, letter, isBlank: false }]);
      setSelectedTileIndex(null);
    }
  };

  const handleBlankSubmit = () => {
    if (blankLetter.length !== 1 || !pendingBlankPos) return;
    setPlacedTiles([...placedTiles, {
      row: pendingBlankPos.r, col: pendingBlankPos.c,
      letter: blankLetter.toUpperCase(), isBlank: true,
    }]);
    setBlankModalVisible(false);
    setPendingBlankPos(null);
    setPendingDragTileIndex(null);
    setBlankLetter("");
    setSelectedTileIndex(null);
  };

  const handleSubmit = () => {
    const tilesToSubmit = hintVisible ? hintTiles : placedTiles;
    if (tilesToSubmit.length === 0) return;
    makeMove.mutate({
      gameId: gameId!,
      data: { tiles: tilesToSubmit.map(t => ({ row: t.row, col: t.col, letter: t.letter, isBlank: t.isBlank })) },
    });
  };

  const handleHint = async () => {
    setMenuVisible(false);
    setHintVisible(false);
    setHintTiles([]);
    // Force a fresh server request each time by removing the cached result first
    queryClient.removeQueries({ queryKey: [`/api/games/${gameId}/hint`] });
    const result = await fetchHint();
    if (result.data && result.data.tiles.length > 0) {
      setHintTiles(result.data.tiles.map(t => ({ row: t.row, col: t.col, letter: t.letter, isBlank: t.isBlank })));
      setHintVisible(true);
    }
  };

  const handleResign = () => {
    setMenuVisible(false);
    setResignConfirmVisible(true);
  };

  const handleSwapConfirm = () => {
    if (swapSelected.length === 0) return;
    const letters = swapSelected.map(i => myRack[i]);
    swapTilesMutation.mutate({ gameId: gameId!, data: { letters } });
  };

  const handleSendEmoji = (emoji: string) => {
    setEmojiPanelVisible(false);
    sendEmoji.mutate({ gameId: gameId!, data: { message: emoji } });
    showFloatingEmoji(emoji);
  };

  const handleRematch = () => {
    if (game?.rematchGameId) {
      router.replace({ pathname: "/game/[id]", params: { id: game.rematchGameId } } as any);
    } else {
      requestRematch.mutate({ gameId: gameId! });
    }
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
          <TouchableOpacity onPress={() => router.replace("/(tabs)" as any)}>
            <Feather name="chevron-left" size={28} color={colors.text} />
          </TouchableOpacity>
          <Avatar uri={opponent?.avatarUrl} username={opponent?.username} size={36} />
          <View style={styles.headerInfo}>
            <Text style={[styles.username, { color: colors.text }]}>{opponent?.username ?? "Opponent"}</Text>
            <Text style={[styles.scoreText, { color: colors.mutedForeground }]}>{opponent?.score ?? 0} pts</Text>
          </View>
          <View style={styles.opponentRack}>
            {Array.from({ length: opponent?.rackSize ?? 0 }).map((_, i) => (
              <View key={i} style={[styles.miniTile, { backgroundColor: colors.tileBackground }]} />
            ))}
          </View>
          <TouchableOpacity onPress={() => setEmojiPanelVisible(v => !v)} style={styles.iconBtn}>
            <Text style={styles.emojiIcon}>😊</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/game/[id]/chat", params: { id: gameId } } as any)}
            style={styles.iconBtn}
          >
            <Feather name="message-circle" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Emoji Quick Panel */}
      {emojiPanelVisible && (
        <View style={[styles.emojiPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {QUICK_EMOJIS.map(e => (
            <TouchableOpacity key={e} onPress={() => handleSendEmoji(e)} style={styles.emojiBtn}>
              <Text style={styles.emojiText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Floating emoji animation */}
      {floatingEmoji && (
        <View style={styles.floatingEmojiContainer} pointerEvents="none">
          <Text style={styles.floatingEmojiText}>{floatingEmoji}</Text>
        </View>
      )}

      {/* Board */}
      <View
        ref={boardRef}
        style={styles.boardContainer}
        onLayout={onBoardLayout}
      >
        <GameBoard
          board={game.board}
          placedTiles={displayedPlacedTiles}
          onCellPress={handleCellPress}
          dropHighlight={dropHighlight}
        />
      </View>

      {/* Hint Banner */}
      {hintVisible && hint && (
        <TouchableOpacity
          style={[styles.hintBanner, { backgroundColor: colors.accent }]}
          onPress={() => { setHintVisible(false); setHintTiles([]); }}
        >
          <Feather name="zap" size={14} color="#FFF" />
          <Text style={styles.hintText}>
            Best: <Text style={{ fontWeight: "bold" }}>{hint.word}</Text> (+{hint.score} pts) · tap to dismiss
          </Text>
        </TouchableOpacity>
      )}

      {/* Score Bar */}
      <View style={[styles.scoreBar, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.myScoreText, { color: colors.text }]}>
          You: <Text style={{ color: colors.primary, fontWeight: "bold" }}>{me?.score ?? 0}</Text>
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Bag: {game.bagSize}</Text>
        {isMyTurn
          ? <Text style={{ color: colors.primary, fontWeight: "bold", fontSize: 12 }}>YOUR TURN</Text>
          : <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Waiting...</Text>
        }
      </View>

      {/* Word Strength Meter */}
      {!hintVisible && <WordStrengthMeter gameId={gameId!} placedTiles={placedTiles} />}

      {/* Tile Rack — PanResponder handles both tap (short press) and drag (move > 8px) */}
      <View style={[styles.rack, { backgroundColor: colors.rackBackground }]}>
        {myRack.map((letter, index) => (
          <View
            key={`${index}-${letter}`}
            {...(panResponders[index]?.panHandlers ?? {})}
          >
            <View style={[styles.tileWrapper, selectedTileIndex === index && styles.tileSelected]}>
              <TileComponent
                letter={letter === "?" ? "?" : letter}
                isBlank={letter === "?"}
                isSelected={selectedTileIndex === index}
                size={44}
              />
            </View>
          </View>
        ))}
      </View>

      {/* Action Bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 8, backgroundColor: colors.rackBackground }]}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => { setPlacedTiles([]); setHintVisible(false); setHintTiles([]); setSelectedTileIndex(null); }}
        >
          <Feather name="rotate-ccw" size={18} color={colors.tileBackground} />
          <Text style={[styles.actionText, { color: colors.tileBackground }]}>Recall</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: canSubmit ? colors.primary : colors.muted }]}
          onPress={handleSubmit}
          disabled={!canSubmit || makeMove.isPending}
        >
          <Text style={[styles.submitText, { color: canSubmit ? colors.primaryForeground : colors.mutedForeground }]}>
            {makeMove.isPending ? "..." : hintVisible ? "PLAY HINT" : "SUBMIT"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => setMenuVisible(true)}>
          <Feather name="more-horizontal" size={18} color={colors.tileBackground} />
          <Text style={[styles.actionText, { color: colors.tileBackground }]}>More</Text>
        </TouchableOpacity>
      </View>

      {/* Floating dragged tile */}
      {isDragging && (
        <Animated.View
          style={[styles.floatingTile, { transform: dragAnim.getTranslateTransform() }]}
          pointerEvents="none"
        >
          <TileComponent letter={dragLetter} isBlank={dragLetter === "?"} size={44} isSelected />
        </Animated.View>
      )}

      {/* Blank Tile Modal */}
      <Modal visible={blankModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choose letter for blank</Text>
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
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Tap tiles to select, then confirm</Text>
            <View style={styles.swapTiles}>
              {myRack.map((letter, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSwapSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                >
                  <TileComponent letter={letter} isBlank={letter === "?"} size={50} isSelected={swapSelected.includes(i)} />
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
                style={[styles.modalBtn, { backgroundColor: swapSelected.length > 0 ? colors.primary : colors.muted, flex: 1 }]}
                onPress={handleSwapConfirm}
                disabled={swapSelected.length === 0 || swapTilesMutation.isPending}
              >
                <Text style={{ color: colors.primaryForeground, fontWeight: "bold" }}>
                  Swap{swapSelected.length > 0 ? ` (${swapSelected.length})` : ""}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Resign Confirmation Modal */}
      <Modal visible={resignConfirmVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Resign Game?</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground, textAlign: "center", marginBottom: 20 }]}>
              Your opponent will be declared the winner.
            </Text>
            <View style={styles.swapActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.muted, flex: 1 }]}
                onPress={() => setResignConfirmVisible(false)}
              >
                <Text style={{ color: colors.mutedForeground, fontWeight: "bold" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.destructive, flex: 1 }]}
                onPress={() => { setResignConfirmVisible(false); resignGame.mutate({ gameId: gameId! }); }}
                disabled={resignGame.isPending}
              >
                <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                  {resignGame.isPending ? "Resigning..." : "Resign"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* More Menu */}
      <Modal visible={menuVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
            <View style={[styles.menuHandle, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); passTurn.mutate({ gameId: gameId! }); }}>
              <Feather name="skip-forward" size={22} color={colors.text} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Pass Turn</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, game.bagSize < myRack.length && { opacity: 0.4 }]}
              onPress={() => {
                if (game.bagSize < myRack.length) return;
                setMenuVisible(false); setSwapModalVisible(true);
              }}
              disabled={game.bagSize < myRack.length}
            >
              <Feather name="refresh-cw" size={22} color={colors.text} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Swap Tiles{game.bagSize < myRack.length ? " (bag empty)" : ""}
              </Text>
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
        <View style={[styles.gameOverOverlay, { backgroundColor: "rgba(0,0,0,0.92)" }]}>
          <Text style={[styles.gameOverTitle, { color: colors.primary }]}>GAME OVER</Text>
          <Text style={styles.winnerText}>
            {game.winnerId === user?.id ? "🏆  YOU WON!" : game.winnerId ? "You lost" : "Draw!"}
          </Text>
          <Text style={[styles.finalScoreText, { color: colors.mutedForeground }]}>
            {me?.score ?? 0} – {opponent?.score ?? 0}
          </Text>

          {game.rematchGameId ? (
            <TouchableOpacity
              style={[styles.rematchBtn, { backgroundColor: colors.primary }]}
              onPress={handleRematch}
            >
              <Text style={{ color: colors.primaryForeground, fontWeight: "bold", fontSize: 16 }}>PLAY REMATCH</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.rematchBtn, { backgroundColor: colors.primary }]}
              onPress={handleRematch}
              disabled={requestRematch.isPending}
            >
              <Text style={{ color: colors.primaryForeground, fontWeight: "bold", fontSize: 16 }}>
                {requestRematch.isPending ? "Starting..." : "REMATCH"}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.replace("/(tabs)" as any)}>
            <Text style={{ color: "#AAA", fontSize: 15 }}>Back to Lobby</Text>
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
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10, gap: 10,
  },
  headerInfo: { flex: 1 },
  username: { fontSize: 15, fontWeight: "bold" },
  scoreText: { fontSize: 11 },
  opponentRack: { flexDirection: "row", gap: 2 },
  miniTile: { width: 7, height: 7, borderRadius: 1 },
  iconBtn: { padding: 4 },
  emojiIcon: { fontSize: 20 },
  emojiPanel: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 16, paddingVertical: 10,
    gap: 10, borderBottomWidth: 1,
  },
  emojiBtn: { padding: 6 },
  emojiText: { fontSize: 26 },
  floatingEmojiContainer: {
    position: "absolute",
    top: "30%", alignSelf: "center",
    zIndex: 200,
  },
  floatingEmojiText: { fontSize: 72 },
  boardContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  hintBanner: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 6, gap: 8,
  },
  hintText: { color: "#FFF", fontSize: 12, flex: 1 },
  scoreBar: {
    height: 36, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 16,
  },
  myScoreText: { fontSize: 14 },
  rack: {
    height: 68, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6, paddingHorizontal: 10,
  },
  tileWrapper: { borderRadius: 6 },
  tileSelected: { opacity: 0.6 },
  actionBar: {
    flexDirection: "row", justifyContent: "space-around", alignItems: "center",
    paddingHorizontal: 12, paddingTop: 12,
  },
  actionBtn: { alignItems: "center", gap: 3, minWidth: 52 },
  actionText: { fontSize: 10 },
  submitButton: {
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 24, minWidth: 130, alignItems: "center",
  },
  submitText: { fontWeight: "bold", fontSize: 15 },
  floatingTile: { position: "absolute", zIndex: 999 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: 280, padding: 24, borderRadius: 16, alignItems: "center", gap: 16 },
  swapBox: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: "bold", textAlign: "center" },
  modalSub: { fontSize: 13, textAlign: "center" },
  modalInput: {
    width: 58, height: 58, borderWidth: 2, borderRadius: 8,
    textAlign: "center", fontSize: 26,
  },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, alignItems: "center", minWidth: 96 },
  swapTiles: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  swapActions: { flexDirection: "row", gap: 12 },
  menuSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, gap: 4,
  },
  menuHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 15, gap: 14 },
  menuItemText: { fontSize: 16, fontWeight: "600" },
  menuDivider: { height: 1, marginVertical: 4 },
  gameOverOverlay: {
    ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", zIndex: 100, gap: 8,
  },
  gameOverTitle: { fontSize: 40, fontWeight: "900" },
  winnerText: { color: "#FFF", fontSize: 24, fontWeight: "bold" },
  finalScoreText: { fontSize: 18, marginBottom: 12 },
  rematchBtn: { paddingHorizontal: 44, paddingVertical: 14, borderRadius: 30 },
});
