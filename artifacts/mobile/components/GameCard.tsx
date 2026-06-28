import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GameSummary, User } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { Avatar } from "./Avatar";

interface GameCardProps {
  game: GameSummary;
  currentUser: User | null;
}

export function GameCard({ game, currentUser }: GameCardProps) {
  const colors = useColors();
  const router = useRouter();
  
  const opponent = game.opponent;
  const isYourTurn = game.status === "active" && game.isMyTurn;

  const handlePress = () => {
    router.push({ pathname: "/game/[id]", params: { id: game.id } } as any);
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card }]}
      onPress={handlePress}
    >
      <Avatar uri={opponent.avatarUrl} username={opponent.username} size={50} />
      
      <View style={styles.info}>
        <Text style={[styles.username, { color: colors.text }]}>
          {opponent.username}
        </Text>
        <Text style={[styles.scores, { color: colors.mutedForeground }]}>
          {game.myScore} - {game.opponentScore}
        </Text>
      </View>

      <View style={styles.status}>
        {game.status === "active" ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: isYourTurn ? colors.primary : colors.muted },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: isYourTurn ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {isYourTurn ? "YOUR TURN" : "THEIR TURN"}
            </Text>
          </View>
        ) : (
          <Text style={[styles.finished, { color: colors.mutedForeground }]}>
            {game.status === "finished" ? "FINISHED" : "CANCELLED"}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 18,
    fontWeight: "bold",
  },
  scores: {
    fontSize: 14,
    marginTop: 4,
  },
  status: {
    alignItems: "flex-end",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  finished: {
    fontSize: 12,
    fontWeight: "600",
  },
});
