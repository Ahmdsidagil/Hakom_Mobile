// App.js (FINAL - dengan restore loading)
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";

import SplashScreen from "./src/screens/SplashScreen";
import WelcomeScreen from "./src/screens/WelcomeScreen";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import InputScreen from "./src/screens/InputScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import NotificationScreen from "./src/screens/NotificationScreen";
import DataLocalScreen from "./src/screens/DataLocalScreen";
import DetailHargaScreen from "./src/screens/DetailHargaScreen";
import RiwayatScreen from "./src/screens/RiwayatScreen";
import EditDataScreen from "./src/screens/EditDataScreen";
import UbahKataSandiScreen from "./src/screens/UbahKataSandi";

import { NotificationProvider } from "./src/context/NotificationContext";
import db from "./config/database";

const Stack = createStackNavigator();

function RestoreLoadingScreen({ progress, total }) {
  return (
    <View style={styles.restoreContainer}>
      <ActivityIndicator size="large" color="#174A6A" />
      <Text style={styles.restoreText}>Menyelaraskan data dari server...</Text>
      {typeof progress === "number" && typeof total === "number" && (
        <Text style={styles.restoreTextSmall}>{progress} / {total}</Text>
      )}
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState({ current: 0, total: 0 });
  const [currentScreen, setCurrentScreen] = useState("Splash");

  useEffect(() => {
    const prepare = async () => {
      try {
        await db.initDatabase();
        // If token exists, attempt restore of server prices into local DB but only if there are no synced rows
        const token = await (require("@react-native-async-storage/async-storage").default.getItem("token"));
        if (token) {
          // Check existing synced rows
          const counts = await db.getDatabase().then(d => d.getFirstAsync(`SELECT COUNT(*) AS syncedCount FROM local_prices WHERE synced = 1;`)).catch(() => null);
          const syncedCount = counts?.syncedCount ?? 0;
          if (syncedCount === 0) {
            // perform restore and show progress
            setShowRestore(true);
            await db.restoreAllPricesFromServer((done, total) => {
              setRestoreProgress({ current: done, total });
            });
            setShowRestore(false);
          } else {
            // still trigger a background syncFromServer to update master tables (commodities, categories)
            db.syncFromServer().catch(() => {});
          }
        } else {
          // no token: still init DB
        }
      } catch (e) {
        console.warn("App init warning:", e);
      } finally {
        // small delay to show splash
        setTimeout(() => {
          setReady(true);
          setCurrentScreen("Welcome");
        }, 600);
      }
    };
    prepare();
  }, []);

  if (!ready) {
    return <SplashScreen />;
  }

  if (showRestore) {
    return <RestoreLoadingScreen progress={restoreProgress.current} total={restoreProgress.total} />;
  }

  return (
    <NotificationProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: false }}>
          {currentScreen === "Splash" && <Stack.Screen name="Splash" component={SplashScreen} />}
          {currentScreen === "Welcome" && <Stack.Screen name="Welcome" component={WelcomeScreen} />}

          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Input" component={InputScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Notification" component={NotificationScreen} />
          <Stack.Screen name="DataLocal" component={DataLocalScreen} />
          <Stack.Screen name="DetailHarga" component={DetailHargaScreen} />
          <Stack.Screen name="Riwayat" component={RiwayatScreen} />
          <Stack.Screen name="EditData" component={EditDataScreen} />
          <Stack.Screen name="UbahKataSandi" component={UbahKataSandiScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </NotificationProvider>
  );
}

const styles = StyleSheet.create({
  restoreContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F9FAFB" },
  restoreText: { marginTop: 12, fontSize: 16, color: "#174A6A", fontWeight: "700" },
  restoreTextSmall: { marginTop: 6, fontSize: 13, color: "#64748B" },
});
