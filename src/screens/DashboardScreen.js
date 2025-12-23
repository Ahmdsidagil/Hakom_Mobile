// ===============================
// 📱 DashboardScreen.js (STYLE ASLI + AUTO SYNC NOTIF)
// ===============================
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "@react-navigation/native";

import BottomNav from "../components/BottomNav";

// ✅ Import Tambahan untuk Logic Sync
import { initDatabase, getDatabase } from "../../config/database";
import { pushNotification } from "../../src/screens/NotificationScreen";

// ===============================
// Helper Waktu Lokal (ANTI UTC)
// ===============================
const getTodayLocalDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now - offset).toISOString().split("T")[0];
};

// ===============================
// 🔧 FIX PARSE TANGGAL
// ===============================
const parseLocalDate = (iso) => {
  if (!iso) return null;
  return new Date(iso.replace("Z", ""));
};

const formatTanggalItem = (tgl) => {
  const d = parseLocalDate(tgl);
  if (!d || isNaN(d.getTime())) return "-";

  return `${d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}, ${d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const formatHarga = (harga) => {
  const num = Number(harga);
  if (isNaN(num)) return "-";
  return `Rp ${num.toLocaleString("id-ID")}`;
};

// ===============================
// Component
// ===============================
export default function DashboardScreen({ navigation }) {
  const [dashboardData, setDashboardData] = useState([]);
  const [uniqueCount, setUniqueCount] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [greeting, setGreeting] = useState("");
  const [user, setUser] = useState({
    user_name: "",
    market_name: "",
    total_commodities: 0,
  });

  // ===============================
  // 🔄 LOGIKA AUTO SYNC (OFFLINE -> ONLINE)
  // ===============================
  const syncOfflineData = async () => {
    try {
      const db = await getDatabase();
      // Cari data yang belum tersinkron (is_synced = 0)
      const unsyncedData = await db.getAllAsync("SELECT * FROM prices WHERE is_synced = 0");

      if (unsyncedData && unsyncedData.length > 0) {
        for (const item of unsyncedData) {
          try {
            // Upload ke Server
            const response = await fetch("http://103.100.27.57:5000/api/prices", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                commodity_id: item.commodity_id,
                price: item.price,
              }),
            });

            if (response.ok) {
              // Jika sukses, update status lokal jadi 1
              await db.runAsync("UPDATE prices SET is_synced = 1 WHERE id = ?", [item.id]);

              // 🔥 PUSH NOTIFIKASI "TERSINKRON" (BIRU)
              await pushNotification({
                type: "synced",
                title: "Data Tersinkronisasi",
                message: `Harga Rp ${formatHarga(item.price)} berhasil diupload ke server.`,
              });
            }
          } catch (err) {
            console.log("Gagal upload item:", item.id);
          }
        }
        reloadDashboard(); 
      }
    } catch (e) {
      console.log("Sync error:", e);
    }
  };

  // ===============================
  // RELOAD DASHBOARD (LOG LOKAL)
  // ===============================
  const reloadDashboard = useCallback(async () => {
    try {
      const today = getTodayLocalDate();
      const logRaw = await AsyncStorage.getItem("dashboard_log");
      const allLogs = logRaw ? JSON.parse(logRaw) : [];

      const dataHariIni = allLogs.filter((it) => it.tanggal === today);

      setDashboardData(dataHariIni);

      const uniqueItems = new Set(
        dataHariIni.map((item) => item.name_commodity)
      );
      setUniqueCount(uniqueItems.size);
    } catch (e) {
      console.error("Dashboard load error:", e);
    }
  }, []);

  // ===============================
  // Connectivity Listener
  // ===============================
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected);
      setIsConnected(online);

      // ✅ JIKA INTERNET NYALA, JALANKAN SYNC
      if (online) {
        syncOfflineData();
      }
    });
    return () => unsub();
  }, []);

  // ===============================
  // Screen Focus
  // ===============================
  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const setup = async () => {
        await initDatabase();

        const storedUser = await AsyncStorage.getItem("user");
        if (storedUser && mounted) {
          setUser(JSON.parse(storedUser));
        }

        const hour = new Date().getHours();
        setGreeting(
          hour < 11
            ? "Selamat Pagi"
            : hour < 15
            ? "Selamat Siang"
            : hour < 18
            ? "Selamat Sore"
            : "Selamat Malam"
        );

        if (mounted) await reloadDashboard();
      };

      setup();
      return () => (mounted = false);
    }, [reloadDashboard])
  );

  // ===============================
  // Render Item
  // ===============================
  const renderItem = (item, idx) => (
    <View key={item.id_temp || idx} style={styles.cardItem}>
      <Image
        source={{ uri: item.local_image || "https://via.placeholder.com/65" }}
        style={styles.image}
      />

      <View style={styles.textContainer}>
        <Text style={styles.itemName}>{item.name_commodity}</Text>
        <Text style={styles.itemPrice}>
          {formatHarga(item.price)} / {item.unit}
        </Text>
        <Text style={styles.itemDate}>
          {formatTanggalItem(item.created_at)}
        </Text>
      </View>

      <View style={styles.rightSection}>
        {/* ✅ PERBAIKAN: numberOfLines dihapus agar kategori terlihat lengkap */}
        <Text style={styles.itemCategory}>
          {item.name_category || "Lainnya"}
        </Text>
      </View>
    </View>
  );

  const tanggalSekarang = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={["#174A6A", "#0F172A"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting}!</Text>
            <Text style={styles.name}>{user.user_name || "Petugas"}</Text>
          </View>

          <View style={styles.rightHeader}>
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isConnected ? "#22c55e" : "#ef4444" },
                ]}
              />
              <Text style={styles.statusText}>
                {isConnected ? "Online" : "Offline"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate("Notification")}
            >
              <Ionicons
                name="notifications-outline"
                size={26}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* BODY */}
      <View style={styles.body}>
        <View style={styles.infoCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>Pasar</Text>
              <Text style={styles.value}>{user.market_name || "-"}</Text>
              <Text style={styles.dateBelowMarket}>{tanggalSekarang}</Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.label}>Total Komoditas</Text>
              <Text style={styles.value}>{user.total_commodities}</Text>
              <Text style={styles.subLabel}>Sudah Diinput</Text>
              <Text style={styles.uniqueValue}>{uniqueCount}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.btnTambah}
            onPress={() =>
              navigation.navigate("Input", { onAddPrice: reloadDashboard })
            }
          >
            <Text style={styles.btnText}>+ Tambah Data</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Pendataan Terakhir (Hari Ini)</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {dashboardData.length ? (
            dashboardData.map(renderItem)
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons
                name="document-text-outline"
                size={50}
                color="#D1D5DB"
              />
              <Text style={styles.emptyText}>
                Belum ada pendataan hari ini
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      <BottomNav navigation={navigation} active="Dashboard" />
    </View>
  );
}

// ===============================
// Styles (ORIGINAL - NO CHANGE)
// ===============================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: { paddingTop: 50, paddingBottom: 40, paddingHorizontal: 20 },
  headerTop: { flexDirection: "row", justifyContent: "space-between" },
  rightHeader: { flexDirection: "row", alignItems: "center" },
  statusContainer: { flexDirection: "row", alignItems: "center", marginRight: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  greeting: { color: "#E0F2FE", fontSize: 14 },
  name: { color: "#fff", fontSize: 18, fontWeight: "700" },
  body: {
    flex: 1,
    marginTop: -25,
    backgroundColor: "#F3F4F6",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 16,
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: "#6B7280", fontSize: 12 },
  value: { fontSize: 15, fontWeight: "700" },
  subLabel: { fontSize: 11, marginTop: 8 },
  uniqueValue: { fontSize: 16, fontWeight: "800", color: "#174A6A" },
  dateBelowMarket: { fontSize: 11, color: "#9CA3AF" },
  btnTambah: {
    backgroundColor: "#174A6A",
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 15,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  cardItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    padding: 12,
    elevation: 1,
  },
  image: { width: 60, height: 60, borderRadius: 8, marginRight: 12 },
  textContainer: { flex: 1 },
  rightSection: { width: 85, alignItems: "flex-end" },
  itemName: { fontSize: 15, fontWeight: "700" },
  itemPrice: { fontSize: 14, fontWeight: "700", color: "#174A6A" },
  itemDate: { fontSize: 11, color: "#6B7280" },
  itemCategory: {
    fontSize: 11,
    fontWeight: "700",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: "#0d7ec0ff",
  },
  emptyBox: { marginTop: 40, alignItems: "center" },
  emptyText: { color: "#9CA3AF", marginTop: 10 },
});