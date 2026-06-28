import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { logger } from "./logger";

const expo = new Expo();

export async function sendPushNotification(
  pushToken: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;

  const message: ExpoPushMessage = {
    to: pushToken,
    sound: "default",
    title,
    body,
    data,
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      for (const receipt of receipts) {
        if (receipt.status === "error") {
          logger.warn({ receipt }, "Push notification error");
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to send push notification");
  }
}

export async function notifyTurn(
  pushToken: string | null | undefined,
  opponentUsername: string
): Promise<void> {
  await sendPushNotification(
    pushToken,
    "Your Turn!",
    `${opponentUsername} played. It's your move!`,
    { type: "turn" }
  );
}

export async function notifyChat(
  pushToken: string | null | undefined,
  senderUsername: string,
  preview: string
): Promise<void> {
  await sendPushNotification(
    pushToken,
    `${senderUsername}`,
    preview,
    { type: "chat" }
  );
}
