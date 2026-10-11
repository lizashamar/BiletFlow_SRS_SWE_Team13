import { useState } from "react";

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await signIn(email, password);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View style={styles.card}>
          <Text style={styles.labelTop}>
            EVENT STAFF
          </Text>

          <Text style={styles.title}>
            Sign in to scan tickets
          </Text>

          <Text style={styles.subtitle}>
            Use your Event Admin account.
          </Text>

          <Text style={styles.label}>
            Email
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="scanner1@biletflow.kz"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
            editable={!isSubmitting}
          />

          <Text style={styles.label}>
            Password
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#6b7280"
            secureTextEntry
            style={styles.input}
            editable={!isSubmitting}
            onSubmitEditing={handleLogin}
          />

          {error ? (
            <Text style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={handleLogin}
            disabled={isSubmitting}
            style={styles.button}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>
                Sign in
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#030712",
  },

  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },

  card: {
    backgroundColor: "#111827",
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  labelTop: {
    color: "#60a5fa",
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 10,
  },

  title: {
    color: "#f9fafb",
    fontSize: 28,
    fontWeight: "800",
  },

  subtitle: {
    color: "#9ca3af",
    marginTop: 8,
    marginBottom: 24,
  },

  label: {
    color: "#d1d5db",
    fontWeight: "600",
    marginBottom: 8,
  },

  input: {
    backgroundColor: "#0b1220",
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 52,
    marginBottom: 16,
    fontSize: 16,
  },

  error: {
    color: "#fca5a5",
    backgroundColor: "#450a0a",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },

  button: {
    backgroundColor: "#2563eb",
    minHeight: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});
