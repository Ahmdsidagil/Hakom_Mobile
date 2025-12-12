// ===============================
// 📱 DashboardScreen.js (FINAL SAFE VERSION)
// Fully compatible with offline/online + image fallback
// ===============================

import React, { useEffect, useState } from "react";
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

import BottomNav from "../components/BottomNav";
import { userInfo } from "../../config/api";

import {
  initDatabase,
  syncFromServer,
  syncPricesToServer,
  getAllRiwayatPendataan,
  getAllLocalPrices,
  countUniqueCommodities,
  getImageForCommodityByName,
  ensureFullImageUrl,
  restoreAllPricesFromServer,
} from "../../config/database";

// =========================================
// Helper Format
// =========================================
const formatTanggalItem = (tgl) => {
  if (!tgl) return "-";
  const d = new Date(tgl);
  if (isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
};

const formatHarga = (harga) => {
  if (harga == null) return "-";
  const num = typeof harga === "string" ? parseFloat(harga) : harga;
  if (isNaN(num)) return "-";
  return `Rp ${num.toLocaleString("id-ID")}`;
};

// =========================================
// Enrich images with fallback: local → server → placeholder
// =========================================
const enrichItemsWithImages = async (items) => {
  const enriched = [];

  for (const it of items) {
    const item = { ...it };

    // 1️⃣ local_image from DB
    if (!item.local_image && item.name_commodity) {
      const img = await getImageForCommodityByName(item.name_commodity);
      if (img) item.local_image = img;
    }

    // 2️⃣ fallback to server URL if local missing
    if (!item.local_image && item.image) {
      item.local_image = ensureFullImageUrl(item.image);
    }

    // 3️⃣ fallback placeholder
    if (!item.local_image) {
      item.local_image = "https://via.placeholder.com/65"; // replace with your own placeholder if needed
    }

    enriched.push(item);
  }

  return enriched;
};

// =========================================
// Load Riwayat Pendataan with dedup + online/offline safe
// =========================================
const loadRiwayatPendataan = async () => {
  try {
    const online = (await getAllRiwayatPendataan()) || []; // server-synced
    const offline = (await getAllLocalPrices()) || []; // local unsynced

    const combined = [...online, ...offline];

    // Deduplicate by name + date
    const map = new Map();
    for (const item of combined) {
      const key = `${item.name_commodity}_${item.tanggal?.split("T")[0] || ""}`;
      const existing = map.get(key);
      const timestamp = new Date(item.tanggal ?? item.created_at).getTime();
      const existingTs = existing ? new Date(existing.tanggal ?? existing.created_at).getTime() : 0;
      if (!existing || timestamp >= existingTs) map.set(key, item);
    }

    const unique = Array.from(map.values());

    // Sort by timestamp descending
    const sorted = unique.sort((a, b) => new Date(b.tanggal ?? b.created_at) - new Date(a.tanggal ?? a.created_at));

    // Top 10 latest
    const top10 = sorted.slice(0, 10);

    // enrich images
    return await enrichItemsWithImages(top10);
  } catch (e) {
    console.error("loadRiwayatPendataan error:", e);
    return [];
  }
};

// =========================================
// MAIN COMPONENT
// =========================================
export default function DashboardScreen({ navigation }) {
  const [dashboardData, setDashboardData] = useState([]);
  const [user, setUser] = useState({ user_name: "", market_name: "", total_commodities: 0 });
  const [greeting, setGreeting] = useState("");
  const [isConnected, setIsConnected] = useState(true);
  const [uniqueCount, setUniqueCount] = useState(0);

  // ======================================
  // Main setup
  // ======================================
  useEffect(() => {
    let unsubscribe;
    const setup = async () => {
      await initDatabase();

      // check connectivity
      const net = await NetInfo.fetch();
      setIsConnected(net.isConnected);

      // restore server data if empty local
      const allLocal = await getAllLocalPrices();
      if (!allLocal || allLocal.length === 0) {
        try {
          await restoreAllPricesFromServer();
        } catch (e) {
          console.warn("Restore failed:", e);
        }
      }

      const token = await AsyncStorage.getItem("token");
      if (token && net.isConnected) {
        await syncFromServer();
        await syncPricesToServer();

        // fetch user info
        const data = await userInfo(token);
        if (data?.success) {
          const userData = {
            user_name: data.user_name || "Petugas Pasar",
            market_name: data.market_name || "Tidak diketahui",
            total_commodities: data.total_commodities ?? 0,
          };
          setUser(userData);
          await AsyncStorage.setItem("user_info", JSON.stringify(userData));
        }
      } else {
        // offline fallback
        const stored = await AsyncStorage.getItem("user_info");
        if (stored) setUser(JSON.parse(stored));
      }

      const greetingHour = new Date().getHours();
      if (greetingHour >= 4 && greetingHour < 11) setGreeting("Selamat Pagi");
      else if (greetingHour >= 11 && greetingHour < 15) setGreeting("Selamat Siang");
      else if (greetingHour >= 15 && greetingHour < 18) setGreeting("Selamat Sore");
      else setGreeting("Selamat Malam");

      // Load latest prices
      const latest = await loadRiwayatPendataan();
      setDashboardData(latest);

      // Count unique commodities
      const uc = await countUniqueCommodities();
      setUniqueCount(uc ?? 0);

      // NetInfo listener
      unsubscribe = NetInfo.addEventListener((s) => setIsConnected(s.isConnected));
    };

    setup();
    return () => unsubscribe && unsubscribe();
  }, []);

  // ======================================
  // Navigation
  // ======================================
  const handleTambahData = () => navigation.navigate("Input", { onAddPrice: async () => {
    const latest = await loadRiwayatPendataan();
    setDashboardData(latest);
    const uc = await countUniqueCommodities();
    setUniqueCount(uc ?? 0);
  }});

  const handleNotifikasi = () => navigation.navigate("Notification");

  const tanggalSekarang = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ======================================
  // RENDER
  // ======================================
  return (
    <View style={styles.container}>
      <LinearGradient colors={["#174A6A", "#0B3B53"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting}!</Text>
            <Text style={styles.name}>{user?.user_name}</Text>
          </View>

          <View style={styles.rightHeader}>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: isConnected ? "#22c55e" : "#ef4444" }]} />
              <Text style={styles.statusText}>{isConnected ? "Online" : "Offline"}</Text>
            </View>

            <TouchableOpacity onPress={handleNotifikasi}>
              <Ionicons name="notifications-outline" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.infoCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>Pasar</Text>
              <Text style={styles.value}>{user.market_name}</Text>
              <Text style={styles.dateBelowMarket}>{tanggalSekarang}</Text>
            </View>

            <View>
              <Text style={styles.label}>Total Komoditas</Text>
              <Text style={styles.value}>{String(user.total_commodities)}</Text>

              <Text style={styles.subLabel}>Komoditas Sudah Diinput</Text>
              <Text style={styles.uniqueValue}>{String(uniqueCount)}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.btnTambah} onPress={handleTambahData}>
            <Text style={styles.btnText}>+ Tambah Data</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Pendataan Terakhir</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {dashboardData.length > 0 ? dashboardData.map((item, idx) => (
            <View key={idx} style={styles.cardItem}>
              <Image
                source={{ uri: item.local_image }}
                style={styles.image}
              />
              <View style={styles.textContainer}>
                <Text style={styles.itemName}>{item.name_commodity || "-"}</Text>
                <Text style={styles.itemPrice}>{formatHarga(item.price)} / {item.unit}</Text>
                <Text style={styles.itemDate}>{formatTanggalItem(item.tanggal)}</Text>
              </View>
              <View style={styles.rightSection}>
                <Text style={styles.itemCategory}>{item.name_category || "Lainnya"}</Text>
              </View>
            </View>
          )) : (
            <Text style={styles.emptyText}>Belum ada pendataan terakhir</Text>
          )}
        </ScrollView>
      </View>

      <BottomNav navigation={navigation} active="Dashboard" />
    </View>
  );
}

// STYLES: sama seperti versi lama
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: { paddingTop: 50, paddingBottom: 40, paddingHorizontal: 20 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rightHeader: { flexDirection: "row", alignItems: "center" },
  statusContainer: { flexDirection: "row", alignItems: "center", marginRight: 12 },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 6, borderWidth: 1.5, borderColor: "#fff" },
  statusText: { color: "#fff", fontSize: 13, fontWeight: "600", marginRight: 6 },
  greeting: { color: "#E0F2FE", fontSize: 16, fontWeight: "500" },
  name: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },

  body: { flex: 1, marginTop: -20, backgroundColor: "#F3F4F6", borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 16, paddingTop: 25 },

  infoCard: { backgroundColor: "#FFFFFF", borderRadius: 15, padding: 16, marginBottom: 16, elevation: 2 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: "#6B7280", fontSize: 13 },
  value: { color: "#111827", fontSize: 15, fontWeight: "600" },
  subLabel: { color: "#6B7280", fontSize: 12, marginTop: 8 },
  uniqueValue: { color: "#111827", fontSize: 15, fontWeight: "700" },
  dateBelowMarket: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  btnTambah: { backgroundColor: "#174A6A", paddingVertical: 10, borderRadius: 10, marginTop: 14, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 },

  cardItem: { backgroundColor: "#FFFFFF", borderRadius: 10, flexDirection: "row", alignItems: "center", marginBottom: 10, padding: 12, elevation: 1 },
  image: { width: 65, height: 65, borderRadius: 10, marginRight: 12 },
  textContainer: { flex: 1 },
  rightSection: { justifyContent: "center", alignItems: "flex-end", width: 80 },
  itemName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  itemPrice: { fontSize: 14, color: "#174A6A", fontWeight: "600" },
  itemDate: { fontSize: 12, color: "#6B7280" },
  itemCategory: { fontSize: 12, fontWeight: "700", color: "#174A6A" },

  emptyText: { color: "#6B7280", textAlign: "center", marginTop: 20 },
});
