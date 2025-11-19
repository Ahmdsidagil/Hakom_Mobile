// src/screens/DashboardScreen.js
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
  getDashboardStats,
  getLatestPrices,
} from "../../config/database";

export default function DashboardScreen({ navigation }) {
  const [dashboardData, setDashboardData] = useState({ latest_prices: [] });
  const [user, setUser] = useState({
    user_name: "",
    market_name: "",
    total_commodities: "",
  });
  const [greeting, setGreeting] = useState("");
  const [isConnected, setIsConnected] = useState(true);

  const formatTanggalItem = (tgl) => {
    if (!tgl) return "-";
    const dateObj = new Date(tgl);
    if (isNaN(dateObj.getTime())) return "-";
    return `${dateObj.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}, ${dateObj.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const formatHarga = (harga) => {
    if (harga == null) return "-";
    const num = typeof harga === "string" ? parseFloat(harga) : harga;
    if (isNaN(num)) return "-";
    return `Rp ${num.toLocaleString("id-ID")}`;
  };

  // 🔹 Load riwayat gabungan offline + online tanpa status
  const loadRiwayatPendataan = async () => {
    try {
      const riwayatOnline = await getAllRiwayatPendataan();
      const riwayatOffline = await getAllLocalPrices();

      // Hanya ambil data tanpa status
      const offlineFormatted = riwayatOffline.map((item) => ({
        ...item,
      }));

      const onlineFormatted = riwayatOnline.map((item) => ({
        ...item,
      }));

      const combined = [...onlineFormatted, ...offlineFormatted];

      // Unik berdasarkan commodity_id + timestamp
      const map = new Map();
      combined.forEach((item) => {
        const key =
          (item.commodity_id || item.name_commodity) +
          "_" +
          (item.created_at || item.tanggal || "");
        if (!map.has(key)) {
          map.set(key, item);
        }
      });

      const uniqueArray = Array.from(map.values()).sort(
        (a, b) =>
          new Date(b.tanggal || b.created_at) -
          new Date(a.tanggal || a.created_at)
      );

      setDashboardData((prev) => ({
        ...prev,
        latest_prices: uniqueArray.slice(0, 10),
      }));
    } catch (err) {
      console.error("❌ Gagal load riwayat pendataan:", err);
    }
  };

  // 🔹 Setup awal & salam
  useEffect(() => {
    let unsubscribe;
    const setup = async () => {
      await initDatabase();
      await loadRiwayatPendataan();

      unsubscribe = NetInfo.addEventListener((state) => {
        setIsConnected(state.isConnected);
      });

      const token = await AsyncStorage.getItem("token");

      if (token) {
        try {
          const state = await NetInfo.fetch();
          if (state.isConnected) {
            await syncFromServer();
            await syncPricesToServer();
            await loadRiwayatPendataan();

            const data = await userInfo(token);
            if (data?.success) {
              const userData = {
                user_name: data.user_name || "Petugas Pasar",
                market_name: data.market_name || "Tidak diketahui",
                total_commodities: data.total_commodities || 0,
              };
              setUser(userData);
              await AsyncStorage.setItem("user_info", JSON.stringify(userData));
            }
          } else {
            const stored = await AsyncStorage.getItem("user_info");
            if (stored) setUser(JSON.parse(stored));
          }
        } catch (err) {
          console.error("❌ Gagal fetch dashboard:", err);
        }
      } else {
        const stored = await AsyncStorage.getItem("user_info");
        if (stored) setUser(JSON.parse(stored));
      }

      const hour = new Date().getHours();
      if (hour >= 4 && hour < 11) setGreeting("Selamat Pagi");
      else if (hour >= 11 && hour < 15) setGreeting("Selamat Siang");
      else if (hour >= 15 && hour < 18) setGreeting("Selamat Sore");
      else setGreeting("Selamat Malam");
    };

    setup();
    return () => unsubscribe && unsubscribe();
  }, []);

  // 🔄 Auto-sync ketika online kembali
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      setIsConnected(state.isConnected);
      if (state.isConnected) {
        try {
          console.log("🔄 Online kembali — mulai auto sync...");
          await syncPricesToServer();
          await loadRiwayatPendataan();
        } catch (err) {
          console.error("❌ Auto-sync gagal:", err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleTambahData = () => {
    navigation.navigate("Input", {
      onAddPrice: async () => {
        await loadRiwayatPendataan();
      },
    });
  };

  const handleNotifikasi = () => navigation.navigate("Notification");

  // 🔹 UI
  return (
    <View style={styles.container}>
      <LinearGradient colors={["#174A6A", "#0B3B53"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting}!</Text>
            <Text style={styles.name}>{user?.user_name}</Text>
          </View>

          <View style={styles.rightHeader}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isConnected ? "#10B981" : "#EF4444" },
              ]}
            >
              <Text style={styles.statusText}>
                {isConnected ? "Online" : "Offline"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleNotifikasi}
              style={{ marginLeft: 12 }}
            >
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
              <Text style={styles.value}>{user?.market_name}</Text>
            </View>
            <View>
              <Text style={styles.label}>Total Komoditas</Text>
              <Text style={styles.value}>{user?.total_commodities}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.btnTambah} onPress={handleTambahData}>
            <Text style={styles.btnText}>+ Tambah Data</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Pendataan Terakhir</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {dashboardData?.latest_prices?.length > 0 ? (
            dashboardData.latest_prices.map((item, idx) => (
              <View
                key={`${item.commodity_id || item.name_commodity}-${item.created_at || item.tanggal}-${idx}`}
                style={styles.cardItem}
              >
                <Image
                  source={{
                    uri: "https://cdn-icons-png.flaticon.com/512/1998/1998707.png",
                  }}
                  style={styles.image}
                />
                <View style={styles.textContainer}>
                  <Text style={styles.itemName}>
                    {item.name_commodity || item.nama || "-"}
                  </Text>
                  <Text style={styles.itemPrice}>
                    {formatHarga(item.price)} / {item.unit || "-"}
                  </Text>
                  <Text style={styles.itemDate}>
                    {formatTanggalItem(item.tanggal || item.created_at)}
                  </Text>
                  <Text style={styles.itemCategory}>
                    {item.name_category || item.kategori || "Lainnya"}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Belum ada pendataan terakhir</Text>
          )}
        </ScrollView>
      </View>

      <BottomNav navigation={navigation} active="Dashboard" />
    </View>
  );
}

// 🎨 Styles tetap sama
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: { paddingTop: 50, paddingBottom: 40, paddingHorizontal: 20 },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rightHeader: { flexDirection: "row", alignItems: "center" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  greeting: { color: "#E0F2FE", fontSize: 16, fontWeight: "500" },
  name: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  body: {
    flex: 1,
    marginTop: -20,
    backgroundColor: "#F3F4F6",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 16,
    paddingTop: 25,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: "#6B7280", fontSize: 13 },
  value: { color: "#111827", fontSize: 15, fontWeight: "600" },
  btnTambah: {
    backgroundColor: "#174A6A",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  cardItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  image: { width: 55, height: 55, borderRadius: 10, marginRight: 12 },
  textContainer: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  itemPrice: { fontSize: 14, color: "#174A6A", fontWeight: "600" },
  itemDate: { fontSize: 12, color: "#6B7280" },
  itemCategory: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
    fontStyle: "italic",
  },
  emptyText: { color: "#6B7280", textAlign: "center", marginTop: 20 },
});
