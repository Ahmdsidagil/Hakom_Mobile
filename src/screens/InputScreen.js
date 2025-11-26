// src/screens/NotificationScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ======================
// Global real-time handler
// ======================
let notificationListeners = [];

/**
 * Push notifikasi baru
 * type: "success" | "error" | "info"
 * title: string
 * message: string
 */
export const pushNotification = async ({ type, title, message }) => {
  try {
    const stored = await AsyncStorage.getItem("notifications");
    const notifList = stored ? JSON.parse(stored) : [];

    const newNotif = {
      id: Date.now(),
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
    };

    const updatedList = [newNotif, ...notifList];
    await AsyncStorage.setItem("notifications", JSON.stringify(updatedList));

    // 🔹 Update semua listener global (realtime)
    notificationListeners.forEach((fn) => fn(updatedList));
  } catch (err) {
    console.error("❌ Gagal push notifikasi:", err);
  }
};

// ======================
// NotificationScreen
// ======================
export default function NotificationScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);

  // Load notifikasi awal dari AsyncStorage
  const loadNotifications = async () => {
    try {
      const stored = await AsyncStorage.getItem("notifications");
      if (stored) setNotifications(JSON.parse(stored));
    } catch (err) {
      console.error("❌ Gagal load notifications:", err);
    }
  };

  useEffect(() => {
    loadNotifications();

    // Daftarkan listener realtime
    const listener = (newList) => setNotifications(newList);
    notificationListeners.push(listener);

    return () => {
      // Hapus listener saat unmount
      notificationListeners = notificationListeners.filter((fn) => fn !== listener);
    };
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case "success":
        return <Ionicons name="checkmark-circle-outline" size={24} color="#22c55e" />;
      case "error":
        return <Ionicons name="close-circle-outline" size={24} color="#ef4444" />;
      case "info":
        return <Ionicons name="information-circle-outline" size={24} color="#3b82f6" />;
      default:
        return <Ionicons name="notifications-outline" size={24} color="#6b7280" />;
    }
  };

  // Hapus notifikasi
  const handleDelete = (id) => {
    Alert.alert(
      "Hapus Notifikasi",
      "Apakah Anda yakin ingin menghapus notifikasi ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              // Ambil data dari AsyncStorage agar konsisten
              const stored = await AsyncStorage.getItem("notifications");
              const notifList = stored ? JSON.parse(stored) : [];
              const updated = notifList.filter((n) => n.id !== id);

              await AsyncStorage.setItem("notifications", JSON.stringify(updated));

              // 🔹 Update state lokal
              setNotifications(updated);

              // 🔹 Update listener global agar sinkron di seluruh app
              notificationListeners.forEach((fn) => fn(updated));
            } catch (err) {
              console.error("❌ Gagal hapus notifikasi:", err);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifikasi</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Body */}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <TouchableOpacity
              key={notif.id}
              onLongPress={() => handleDelete(notif.id)}
              style={[
                styles.notifCard,
                notif.type === "error" && { borderLeftColor: "#ef4444" },
                notif.type === "info" && { borderLeftColor: "#3b82f6" },
              ]}
            >
              <View style={styles.icon}>{getIcon(notif.type)}</View>
              <View style={styles.textContainer}>
                <Text style={styles.notifTitle}>{notif.title || ""}</Text>
                <Text style={styles.notifMessage}>{notif.message || ""}</Text>
                <Text style={styles.notifTime}>
                  {notif.timestamp ? new Date(notif.timestamp).toLocaleString("id-ID") : ""}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>Belum ada notifikasi</Text>
        )}
      </ScrollView>
    </View>
  );
}

// ======================
// Styles
// ======================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#174A6A",
    justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
    borderLeftWidth: 5,
    borderLeftColor: "#22c55e",
  },
  icon: { marginRight: 10, marginTop: 2 },
  textContainer: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  notifMessage: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  notifTime: { fontSize: 11, color: "#9CA3AF", marginTop: 4 },
  emptyText: { textAlign: "center", marginTop: 20, color: "#6B7280" },
});