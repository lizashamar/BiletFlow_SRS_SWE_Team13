import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";

import {
  createNativeStackNavigator,
} from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import ScannerScreen from "../screens/ScannerScreen";

import type { RootStackParamList } from "./types";

const Stack =
  createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { session, isRestoring } = useAuth();

  if (isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: "#111827",
        },
        headerTintColor: "#ffffff",
        contentStyle: {
          backgroundColor: "#030712",
        },
      }}
    >
      {session ? (
        <Stack.Screen
          name="Scanner"
          component={ScannerScreen}
          options={{
            title: "Ticket Scanner",
            headerBackVisible: false,
          }}
        />
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            title: "BiletFlow Staff",
            headerBackVisible: false,
          }}
        />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#030712",
  },
});
