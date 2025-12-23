// ==========================================
// 🔔 NotificationScreen.js (FINAL VERSION)
// ==========================================
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
import { LinearGradient } from "expo-linear-gradient"; // ✅ Import Gradasi

// ======================
// 1. GLOBAL HELPER (Jantung Notifikasi)
// ======================
// Array untuk menampung fungsi update dari screen yang sedang aktif
let notificationListeners = [];

/**
 * Fungsi untuk memanggil notifikasi dari file mana saja
 * @param {object} param0 { type, title, message, data }
 */
export const pushNotification = async ({ type, title, message, data = null }) => {
  try {
    const stored = await AsyncStorage.getItem("notifications");
    const notifList = stored ? JSON.parse(stored) : [];

    const newNotif = {
      id: Date.now(),       // ID unik
      type,                 // 'success' | 'offline' | 'synced' | 'delete' | 'error'
      title,
      message,
      data,                 // Optional: simpan data terkait (misal ID komoditas)
      timestamp: new Date().toISOString(),
      read: false,
    };

    // Tambah notif baru ke paling atas
    const updatedList = [newNotif, ...notifList];
    
    // Simpan limit 50 notifikasi terakhir saja agar memori aman
    const limitedList = updatedList.slice(0, 50); 
    
    await AsyncStorage.setItem("notifications", JSON.stringify(limitedList));

    // Kabari listener agar UI update realtime
    notificationListeners.forEach((fn) => fn(limitedList));
  } catch (err) {
    console.error("❌ Gagal push notifikasi:", err);
  }
};

// ======================
// 2. MAIN COMPONENT UI
// ======================
export default function NotificationScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);

  // Load data awal
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

    // Register Listener (Agar saat ada notif baru, layar ini auto-refresh)
    const listener = (newList) => setNotifications(newList);
    notificationListeners.push(listener);

    return () => {
      // Unregister saat keluar screen
      notificationListeners = notificationListeners.filter((fn) => fn !== listener);
    };
  }, []);

  // ✅ LOGIKA IKON & WARNA SESUAI TIPE
  const getIcon = (type) => {
    switch (type) {
      case "success": // Input Online (Berhasil ke Server)
        return <Ionicons name="checkmark-circle" size={28} color="#22c55e" />;
      
      case "synced": // ✅ BARU: Sinkronisasi Otomatis
        return <Ionicons name="cloud-done" size={28} color="#3b82f6" />; // Biru
      
      case "offline": // Input Offline (Disimpan Lokal)
        return <Ionicons name="cloud-offline" size={28} color="#f97316" />; // Orange
      
      case "delete":  // ✅ BARU: Hapus Data
        return <Ionicons name="trash" size={28} color="#ef4444" />; // Merah
      
      case "error": 
        return <Ionicons name="alert-circle" size={28} color="#ef4444" />;
      
      case "edit":  // ✅ BARU: Edit Data
        return <Ionicons name="pencil" size={28} color="#a855f7" />; // Ungu  

      default:
        return <Ionicons name="information-circle" size={28} color="#64748B" />;
    }
  };

  // Format Waktu
  const formatTime = (iso) => {
    if (!iso) return "";
    const date = new Date(iso);
    return date.toLocaleDateString("id-ID", { day: 'numeric', month: 'short' }) + 
           ", " + 
           date.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
  };

  // Hapus Satu Riwayat (Long Press)
  const handleDeleteHistory = (id) => {
    Alert.alert("Hapus Log", "Hapus catatan aktivitas ini?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus", style: "destructive",
        onPress: async () => {
            const updated = notifications.filter((n) => n.id !== id);
            await AsyncStorage.setItem("notifications", JSON.stringify(updated));
            setNotifications(updated);
            notificationListeners.forEach((fn) => fn(updated));
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* ✅ HEADER GRADASI */}
      <LinearGradient
        colors={["#174A6A", "#0F172A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Riwayat Notifikasi</Text>
      </LinearGradient>

      {/* BODY LIST */}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <TouchableOpacity
              key={notif.id}
              activeOpacity={0.7}
              onLongPress={() => handleDeleteHistory(notif.id)}
              style={[
                styles.notifCard,
                // Border warna-warni sesuai tipe
                notif.type === "success" && { borderLeftColor: "#22c55e" },
                notif.type === "synced"  && { borderLeftColor: "#3b82f6" }, // Biru
                notif.type === "offline" && { borderLeftColor: "#f97316" },
                notif.type === "delete"  && { borderLeftColor: "#ef4444" },
                notif.type === "error"   && { borderLeftColor: "#ef4444" },
                notif.type === "edit"    && { borderLeftColor: "#a855f7" },
              ]}
            >
              <View style={styles.iconContainer}>{getIcon(notif.type)}</View>
              
              <View style={styles.textContainer}>
                <Text style={styles.notifTitle}>{notif.title}</Text>
                <Text style={styles.notifMessage}>{notif.message}</Text>
                <Text style={styles.notifTime}>{formatTime(notif.timestamp)}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={60} color="#cbd5e1" />
            <Text style={styles.emptyText}>Tidak ada notifikasi baru</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ======================
// STYLES
// ======================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  
  header: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    elevation: 4,
  },
  
  backBtn: { marginRight: 15 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", letterSpacing: 0.5 },
  
  body: { flex: 1, padding: 16 },
  
  notifCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 3, // Shadow Android
    shadowColor: "#64748B", // Shadow iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 5,
    borderLeftColor: "#94a3b8", // Default Grey
  },
  
  iconContainer: { 
    marginRight: 14, 
    justifyContent: 'flex-start',
    marginTop: 2 
  },
  
  textContainer: { flex: 1, justifyContent: 'center' },
  
  notifTitle: { fontSize: 14, fontWeight: "bold", color: "#1e293b", marginBottom: 4 },
  notifMessage: { fontSize: 13, color: "#475569", lineHeight: 18 },
  notifTime: { fontSize: 11, color: "#94a3b8", marginTop: 8 },
  
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 10, color: "#94a3b8", fontSize: 14 },
});