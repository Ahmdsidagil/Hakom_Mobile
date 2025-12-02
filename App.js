import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";

// Import semua screen
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


// Import context provider
import { NotificationProvider } from "./src/context/NotificationContext";

const Stack = createStackNavigator();

export default function App() {
  const [currentScreen, setCurrentScreen] = useState("Splash");

  useEffect(() => {
    const timer1 = setTimeout(() => setCurrentScreen("Welcome"), 1000);
    return () => clearTimeout(timer1);
  }, []);

  return (
    <NotificationProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animationEnabled: false, // 🔥 ini menonaktifkan animasi transisi antar screen
          }}
        >
          {currentScreen === "Splash" && (
            <Stack.Screen name="Splash" component={SplashScreen} />
          )}
          {currentScreen === "Welcome" && (
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
          )}

          {/* Screen utama */}
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
