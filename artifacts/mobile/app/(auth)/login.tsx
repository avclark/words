import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useLogin } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login: authLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: async (data) => {
        await authLogin(data.token, data.user);
      },
      onError: (err: any) => {
        setError(err.message || "Failed to login");
      },
    },
  });

  const handleLogin = () => {
    setError(null);
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={[styles.logoText, { color: colors.primary }]}>
            SCRABBLE
          </Text>
          <View style={styles.tileGraphic}>
            <View style={[styles.tile, { backgroundColor: colors.tileBackground }]}>
              <Text style={[styles.tileLetter, { color: colors.tileForeground }]}>G</Text>
              <Text style={[styles.tilePoints, { color: colors.tileForeground }]}>2</Text>
            </View>
            <View style={[styles.tile, { backgroundColor: colors.tileBackground }]}>
              <Text style={[styles.tileLetter, { color: colors.tileForeground }]}>O</Text>
              <Text style={[styles.tilePoints, { color: colors.tileForeground }]}>1</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            placeholder="Email"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            placeholder="Password"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleLogin}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                Sign In
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
              Don't have an account? <Text style={{ color: colors.primary }}>Register</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoText: {
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: 8,
  },
  tileGraphic: {
    flexDirection: "row",
    marginTop: 12,
  },
  tile: {
    width: 50,
    height: 50,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    position: "relative",
  },
  tileLetter: {
    fontSize: 28,
    fontWeight: "bold",
  },
  tilePoints: {
    fontSize: 10,
    position: "absolute",
    bottom: 4,
    right: 6,
  },
  card: {
    padding: 24,
    borderRadius: 12,
    gap: 16,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  errorText: {
    textAlign: "center",
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  link: {
    marginTop: 24,
    alignItems: "center",
  },
  linkText: {
    fontSize: 16,
  },
});
