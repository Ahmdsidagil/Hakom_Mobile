import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Bottom navigation untuk Dashboard, Data Lokal, dan Profil
 * @param {object} navigation - prop dari React Navigation
 * @param {string} active - screen yang aktif saat ini
 */
export default function BottomNav({ navigation, active }) {
  return (
    <View style={styles.bottomNav}>
      {/* Dashboard */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => {
          if (active !== "Dashboard") {
            navigation.replace("Dashboard"); // 🚀 langsung ganti tanpa animasi
          }
        }}
      >
        <Ionicons
          name="home-outline"
          size={24}
          color={active === "Dashboard" ? "#174A6A" : "#6B7280"}
        />
        <Text
          style={[
            styles.navText,
            active === "Dashboard" && styles.navTextActive,
          ]}
        >
          Beranda
        </Text>
      </TouchableOpacity>

      {/* Data Lokal */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => {
          if (active !== "DataLocal") {
            navigation.replace("DataLocal");
          }
        }}
      >
        <Ionicons
          name="folder-outline"
          size={24}
          color={active === "DataLocal" ? "#174A6A" : "#6B7280"}
        />
        <Text
          style={[
            styles.navText,
            active === "DataLocal" && styles.navTextActive,
          ]}
        >
          Data
        </Text>
      </TouchableOpacity>

      {/* Profil */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => {
          if (active !== "Profile") {
            navigation.replace("Profile"); // 🚀 tanpa animasi
          }
        }}
      >
        <Ionicons
          name="person-outline"
          size={24}
          color={active === "Profile" ? "#174A6A" : "#6B7280"}
        />
        <Text
          style={[
            styles.navText,
            active === "Profile" && styles.navTextActive,
          ]}
        >
          Profil
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderTopColor: "#E5E7EB",
    borderTopWidth: 1,
  },
  navItem: { alignItems: "center" },
  navText: { fontSize: 12, color: "#6B7280", marginTop: 3 },
  navTextActive: { color: "#174A6A", fontWeight: "bold" },
});
