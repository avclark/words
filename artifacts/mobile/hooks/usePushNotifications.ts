import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useAuth } from "@/contexts/AuthContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    // Non-critical — Expo Go requires a projectId in bare workflow.
    // App works fine without push notifications.
    return null;
  }
}

export function usePushNotifications() {
  const { token: authToken, user } = useAuth();

  useEffect(() => {
    if (!authToken || !user) return;

    registerForPushNotificationsAsync().then(async (pushToken) => {
      if (!pushToken) return;
      try {
        await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/users/me/push-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ token: pushToken }),
        });
      } catch {
        // Non-critical
      }
    });
  }, [authToken, user?.id]);
}
