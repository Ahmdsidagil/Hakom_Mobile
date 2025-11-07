// DashboardScreen.js
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
import { getDashboard } from "../../config/api";
import {
  initDatabase,
  syncFromServer,
  syncPricesToServer,
  getAllRiwayatPendataan,
} from "../../config/database";

export default function DashboardScreen({ navigation }) {
  const [dashboardData, setDashboardData] = useState({ latest_prices: [] });
  const [greeting, setGreeting] = useState("");

  // Helper untuk load riwayat
  const loadRiwayatPendataan = async () => {
    const riwayatData = await getAllRiwayatPendataan();

    // Urutkan descending berdasarkan tanggal/created_at
    const sorted = riwayatData?.sort((a, b) => {
      const dateA = new Date(a.tanggal || a.created_at);
      const dateB = new Date(b.tanggal || b.created_at);
      return dateB - dateA; // terbaru di atas
    });

    setDashboardData((prev) => ({
      ...prev,
      latest_prices: sorted?.slice(0, 10) || [], // ambil 10 data terbaru
    }));
  };

  useEffect(() => {
    const setup = async () => {
      await initDatabase();
      await loadRiwayatPendataan();

      // Ambil info user & pasar dari server (jika online)
      const token = await AsyncStorage.getItem("token");
      if (token) {
        try {
          const state = await NetInfo.fetch();
          if (state.isConnected) {
            await syncFromServer();
            await syncPricesToServer();
          }

          const data = await getDashboard(token);
          if (data?.success) {
            setDashboardData((prev) => ({
              ...prev,
              user_name: data.user_name,
              market_name: data.market_name,
              total_commodities: data.total_commodities,
            }));
          }
        } catch (err) {
          console.error("❌ Gagal fetch dashboard:", err);
        }
      }

      // Greeting berdasarkan jam
      const hour = new Date().getHours();
      if (hour >= 4 && hour < 11) setGreeting("Selamat Pagi");
      else if (hour >= 11 && hour < 15) setGreeting("Selamat Siang");
      else if (hour >= 15 && hour < 18) setGreeting("Selamat Sore");
      else setGreeting("Selamat Malam");
    };

    setup();
  }, []);

  // Navigasi ke InputScreen
  const handleTambahData = () => {
    navigation.navigate("Input", {
      onAddPrice: async () => {
        await loadRiwayatPendataan(); // refresh data setelah tambah
      },
    });
  };

  const handleNotifikasi = () => navigation.navigate("Notification");

  // Format tanggal + jam
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#174A6A", "#0B3B53"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting}!</Text>
            <Text style={styles.name}>
              {dashboardData?.user_name || "Petugas Pasar"}
            </Text>
          </View>
          <TouchableOpacity onPress={handleNotifikasi}>
            <Ionicons name="notifications-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.infoCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>Pasar</Text>
              <Text style={styles.value}>
                {dashboardData?.market_name || "Tidak diketahui"}
              </Text>
            </View>
            <View>
              <Text style={styles.label}>Total Komoditas</Text>
              <Text style={styles.value}>
                {dashboardData?.total_commodities || 0}
              </Text>
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
              <View key={idx} style={styles.cardItem}>
                <Image
                  source={{
                    uri: "https://cdn-icons-png.flaticon.com/512/1998/1998707.png",
                  }}
                  style={styles.image}
                />
                <View style={styles.textContainer}>
                  <Text style={styles.itemName}>
                    {item.name_commodity || item.nama}
                  </Text>
                  <Text style={styles.itemPrice}>
                    Rp {item.price?.toLocaleString("id-ID")}/{item.unit}
                  </Text>
                  <Text style={styles.itemDate}>{formatTanggalItem(item.tanggal)}</Text>
                  {/* Tambahkan kategori */}
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

      {/* Bottom Navigation */}
      <BottomNav navigation={navigation} active="Dashboard" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: { paddingTop: 50, paddingBottom: 40, paddingHorizontal: 20 },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
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
  itemCategory: { fontSize: 12, color: "#9CA3AF", marginTop: 2, fontStyle: "italic" },
  emptyText: { color: "#6B7280", textAlign: "center", marginTop: 20 },
});
