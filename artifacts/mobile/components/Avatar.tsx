import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useColors } from "@/hooks/useColors";

interface AvatarProps {
  uri?: string | null;
  username?: string;
  size?: number;
  style?: any;
}

export function Avatar({ uri, username, size = 40, style }: AvatarProps) {
  const colors = useColors();
  const initials = username?.slice(0, 2).toUpperCase() || "?";

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.card,
        },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
        />
      ) : (
        <Text style={[styles.initials, { color: colors.primary, fontSize: size * 0.4 }]}>
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  initials: {
    fontWeight: "bold",
  },
});
