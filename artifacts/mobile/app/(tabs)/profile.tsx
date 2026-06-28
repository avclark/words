import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Switch,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  useGetMe,
  useGetMyStats,
  useUpdateProfile,
  useGetNotificationSettings,
  useUpdateNotificationSettings,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/Avatar";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logout, token } = useAuth();
  
  const { data: user, isLoading: userLoading } = useGetMe();
  const { data: stats, isLoading: statsLoading } = useGetMyStats();
  const { data: notifSettings, isLoading: notifLoading } = useGetNotificationSettings();
  
  const updateProfile = useUpdateProfile();
  const updateNotifs = useUpdateNotificationSettings();

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const formData = new FormData();
      // @ts-ignore
      formData.append("avatar", {
        uri,
        name: "avatar.jpg",
        type: "image/jpeg",
      });

      try {
        const response = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/users/me/avatar`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
        if (response.ok) {
          // Success
        }
      } catch (error) {
        Alert.alert("Error", "Failed to upload avatar");
      }
    }
  };

  if (userLoading || statsLoading || notifLoading) return <LoadingScreen />;

  const statItems = [
    { label: "Played", value: stats?.gamesPlayed || 0 },
    { label: "Won", value: stats?.gamesWon || 0 },
    { label: "Lost", value: stats?.gamesLost || 0 },
    { label: "Win Rate", value: `${stats?.winRate || 0}%` },
    { label: "Avg Score", value: stats?.averageScore || 0 },
    { label: "Best Score", value: stats?.bestScore || 0 },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 100 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePickImage} style={styles.avatarContainer}>
          <Avatar uri={user?.avatarUrl} username={user?.username} size={100} />
          <View style={[styles.cameraIcon, { backgroundColor: colors.primary }]}>
            <Feather name="camera" size={16} color={colors.primaryForeground} />
          </View>
        </TouchableOpacity>
        <Text style={[styles.username, { color: colors.text }]}>{user?.username}</Text>
        <Text style={[styles.email, { color: colors.mutedForeground }]}>{user?.email}</Text>
      </View>

      <View style={styles.statsGrid}>
        {statItems.map((item, index) => (
          <View key={index} style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{item.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>NOTIFICATIONS</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Turn Notifications</Text>
            <Switch
              value={notifSettings?.notificationTurn}
              onValueChange={(val) => updateNotifs.mutate({ data: { notificationTurn: val } })}
              trackColor={{ true: colors.primary }}
            />
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Chat Notifications</Text>
            <Switch
              value={notifSettings?.notificationChat}
              onValueChange={(val) => updateNotifs.mutate({ data: { notificationChat: val } })}
              trackColor={{ true: colors.primary }}
            />
          </View>
        </View>
      </View>

      <TouchableOpacity style={[styles.signOutButton, { backgroundColor: colors.card }]} onPress={logout}>
        <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: "center", padding: 24 },
  avatarContainer: { position: "relative", marginBottom: 16 },
  cameraIcon: { position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#0D1B2A" },
  username: { fontSize: 24, fontWeight: "bold" },
  email: { fontSize: 16, marginTop: 4 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", padding: 8, gap: 8 },
  statCard: { width: "31%", padding: 12, borderRadius: 8, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "bold" },
  statLabel: { fontSize: 12, marginTop: 4, textAlign: "center" },
  section: { padding: 16 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", marginBottom: 8, marginLeft: 4 },
  settingsCard: { borderRadius: 12, overflow: "hidden" },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  settingLabel: { fontSize: 16 },
  separator: { height: 1 },
  signOutButton: { margin: 16, padding: 16, borderRadius: 12, alignItems: "center" },
  signOutText: { fontSize: 16, fontWeight: "bold" },
});
