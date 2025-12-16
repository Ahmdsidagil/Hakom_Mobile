// ===============================
// 📱 DashboardScreen.js (FINAL — LOCAL INPUT ONLY)
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

import {
  initDatabase,
  getAllLocalPrices,
  countUniqueCommodities,
  getImageForCommodityByName,
} from "../../config/database";

// ===============================
// Helper Functions
// ===============================
const formatTanggalItem = (tgl) => {
  if (!tgl) return "-";
  const d = new Date(tgl);
  if (isNaN(d.getTime())) return "-";
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
// Enrich Image
// ===============================
const enrichItemsWithImages = async (items) => {
  return Promise.all(
    items.map(async (item) => {
      const copy = { ...item };

      if (!copy.local_image && copy.name_commodity) {
        const img = await getImageForCommodityByName(copy.name_commodity);
        copy.local_image = img || "https://via.placeholder.com/65";
      }

      if (!copy.local_image) copy.local_image = "https://via.placeholder.com/65";
      return copy;
    })
  );
};

// ===============================
// Load Dashboard Data (LOCAL INPUT ONLY)
// ===============================
const loadDashboardData = async () => {
  const all = (await getAllLocalPrices()) || [];

  // ✅ FILTER hanya data input lokal
  const localInputOnly = all.filter((it) => it.local_id); // atau it.is_local === 1 kalau pakai flag

  const sorted = localInputOnly.sort((a, b) => {
    const da = new Date(a.tanggal || a.created_at);
    const db = new Date(b.tanggal || b.created_at);
    return db - da;
  });

  return enrichItemsWithImages(sorted.slice(0, 10));
};

// ===============================
// Component
// ===============================
export default function DashboardScreen({ navigation }) {
  const [dashboardData, setDashboardData] = useState([]);
  const [user, setUser] = useState({
    user_name: "",
    market_name: "",
    total_commodities: 0,
  });
  const [greeting, setGreeting] = useState("");
  const [isConnected, setIsConnected] = useState(true);
  const [uniqueCount, setUniqueCount] = useState(0);

  const reloadDashboard = useCallback(async () => {
    const data = await loadDashboardData();
    setDashboardData(data);

    const uc = await countUniqueCommodities();
    setUniqueCount(uc ?? 0);
  }, []);

  // ===============================
  // Connectivity
  // ===============================
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) =>
      setIsConnected(Boolean(s.isConnected))
    );
    return () => unsub && unsub();
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
        if (storedUser && mounted) setUser(JSON.parse(storedUser));

        const h = new Date().getHours();
        let g = "Selamat Malam";
        if (h >= 4 && h < 11) g = "Selamat Pagi";
        else if (h >= 11 && h < 15) g = "Selamat Siang";
        else if (h >= 15 && h < 18) g = "Selamat Sore";
        if (mounted) setGreeting(g);

        if (mounted) await reloadDashboard();
      };

      setup();
      return () => {
        mounted = false;
      };
    }, [reloadDashboard])
  );

  // ===============================
  // Navigation
  // ===============================
  const handleTambahData = () =>
    navigation.navigate("Input", { onAddPrice: reloadDashboard });

  const tanggalSekarang = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ===============================
  // Render
  // ===============================
  return (
    <View style={styles.container}>
      <LinearGradient colors={["#174A6A", "#0B3B53"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting}!</Text>
            <Text style={styles.name}>{user.user_name}</Text>
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
            <Ionicons name="notifications-outline" size={26} color="#fff" />
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
          {dashboardData.length ? (
            dashboardData.map((item, idx) => (
              <View
                key={item.local_id || idx}
                style={styles.cardItem}
              >
                <Image source={{ uri: item.local_image }} style={styles.image} />
                <View style={styles.textContainer}>
                  <Text style={styles.itemName}>{item.name_commodity || "-"}</Text>
                  <Text style={styles.itemPrice}>
                    {formatHarga(item.price)} / {item.unit}
                  </Text>
                  <Text style={styles.itemDate}>
                    {formatTanggalItem(item.tanggal || item.created_at)}
                  </Text>
                </View>
                <View style={styles.rightSection}>
                  <Text style={styles.itemCategory}>{item.name_category || "Lainnya"}</Text>
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

// ===============================
// Styles
// ===============================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: { paddingTop: 50, paddingBottom: 40, paddingHorizontal: 20 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rightHeader: { flexDirection: "row", alignItems: "center" },
  statusContainer: { flexDirection: "row", alignItems: "center", marginRight: 12 },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 6, borderWidth: 1.5, borderColor: "#fff" },
  statusText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  greeting: { color: "#E0F2FE", fontSize: 16 },
  name: { color: "#fff", fontSize: 18, fontWeight: "700" },
  body: { flex: 1, marginTop: -20, backgroundColor: "#F3F4F6", borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 16 },
  infoCard: { backgroundColor: "#fff", borderRadius: 15, padding: 16, marginBottom: 16 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: "#6B7280", fontSize: 13 },
  value: { color: "#111827", fontSize: 15, fontWeight: "600" },
  subLabel: { color: "#6B7280", fontSize: 12, marginTop: 8 },
  uniqueValue: { fontSize: 15, fontWeight: "700" },
  dateBelowMarket: { fontSize: 12, color: "#6B7280" },
  btnTambah: { backgroundColor: "#174A6A", paddingVertical: 10, borderRadius: 10, marginTop: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  cardItem: { backgroundColor: "#fff", borderRadius: 10, flexDirection: "row", alignItems: "center", marginBottom: 10, padding: 12 },
  image: { width: 65, height: 65, borderRadius: 10, marginRight: 12 },
  textContainer: { flex: 1 },
  rightSection: { width: 80, alignItems: "flex-end" },
  itemName: { fontSize: 15, fontWeight: "700" },
  itemPrice: { fontSize: 14, fontWeight: "600", color: "#174A6A" },
  itemDate: { fontSize: 12, color: "#6B7280" },
  itemCategory: { fontSize: 12, fontWeight: "700", color: "#174A6A" },
  emptyText: { textAlign: "center", color: "#6B7280", marginTop: 20 },
});
