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
  countUniqueCommodities,
  getLocalImagePath,
  getImageForCommodityByName,
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
  const [uniqueCount, setUniqueCount] = useState(0);

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

  const enrichItemsWithImages = async (items) => {
    const enriched = [];
    for (const it of items) {
      const item = { ...it };
      if (!item.local_image && !item.image && item.name_commodity) {
        try {
          const found = await getImageForCommodityByName(item.name_commodity);
          if (found?.local_image) item.local_image = found.local_image;
          else if (found?.image) item.image = found.image;
        } catch {}
      }
      if (!item.local_image && item.image) {
        try {
          const local = await getLocalImagePath(item.image);
          if (local) item.local_image = local;
        } catch {}
      }
      enriched.push(item);
    }
    return enriched;
  };

  const loadRiwayatPendataan = async () => {
    try {
      const riwayatOnline = await getAllRiwayatPendataan();
      const riwayatOffline = await getAllLocalPrices();

      const combined = [...riwayatOnline, ...riwayatOffline];

      const uniqueArray = combined.filter(
        (item, index, self) =>
          index ===
          self.findIndex(
            (x) =>
              (x.server_id &&
                item.server_id &&
                x.server_id === item.server_id) ||
              (!item.server_id &&
                x.name_commodity === item.name_commodity &&
                (x.tanggal || x.created_at) ===
                  (item.tanggal || item.created_at))
          )
      );

      const sorted = uniqueArray.sort(
        (a, b) =>
          new Date(b.tanggal || b.created_at) -
          new Date(a.tanggal || a.created_at)
      );

      const top10 = sorted.slice(0, 10);
      const enriched = await enrichItemsWithImages(top10);

      setDashboardData((prev) => ({
        ...prev,
        latest_prices: enriched,
      }));
    } catch (err) {
      console.error("❌ Gagal load riwayat pendataan:", err);
    }
  };

  const loadUniqueCount = async () => {
    try {
      const c = await countUniqueCommodities();
      setUniqueCount(c ?? 0);
    } catch (err) {
      console.error("❌ Gagal ambil komoditas unik:", err);
      setUniqueCount(0);
    }
  };

  useEffect(() => {
    let unsubscribe;
    const setup = async () => {
      await initDatabase();
      await loadRiwayatPendataan();
      await loadUniqueCount();

      unsubscribe = NetInfo.addEventListener((state) =>
        setIsConnected(state.isConnected)
      );

      const token = await AsyncStorage.getItem("token");

      if (token) {
        try {
          const state = await NetInfo.fetch();
          if (state.isConnected) {
            await syncFromServer();
            await syncPricesToServer();
            await loadRiwayatPendataan();
            await loadUniqueCount();

            const data = await userInfo(token);
            if (data?.success) {
              const userData = {
                user_name: data.user_name || "Petugas Pasar",
                market_name: data.market_name || "Tidak diketahui",
                total_commodities: data.total_commodities || 0,
              };
              setUser(userData);
              await AsyncStorage.setItem(
                "user_info",
                JSON.stringify(userData)
              );
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

  const handleTambahData = () => {
    navigation.navigate("Input", {
      onAddPrice: async () => {
        await loadRiwayatPendataan();
        await loadUniqueCount();
      },
    });
  };

  const handleNotifikasi = () => navigation.navigate("Notification");

  const tanggalSekarang = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#174A6A", "#0B3B53"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting}!</Text>
            <Text style={styles.name}>{user?.user_name}</Text>
          </View>

          <View style={styles.rightHeader}>
            <TouchableOpacity onPress={handleNotifikasi}>
              <Ionicons
                name="notifications-outline"
                size={26}
                color="#fff"
              />
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
              <Text style={styles.dateBelowMarket}>
                {tanggalSekarang}
              </Text>
            </View>

            <View>
              <Text style={styles.label}>Total Komoditas</Text>
              <Text style={styles.value}>{user?.total_commodities}</Text>
              <Text style={styles.subLabel}>Komoditas Sudah Diinput</Text>
              <Text style={styles.uniqueValue}>{uniqueCount}</Text>
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
                key={`${item.server_id || item.name_commodity}-${idx}`}
                style={styles.cardItem}
              >
                <Image
                  source={
                    item.local_image
                      ? { uri: item.local_image }
                      : item.image
                      ? { uri: item.image }
                      : null
                  }
                  style={styles.image}
                />

                <View style={styles.textContainer}>
                  <Text style={styles.itemName}>
                    {item.name_commodity || "-"}
                  </Text>
                  <Text style={styles.itemPrice}>
                    {formatHarga(item.price)} / {item.unit || "-"}
                  </Text>
                  <Text style={styles.itemDate}>
                    {formatTanggalItem(item.tanggal || item.created_at)}
                  </Text>
                </View>

                {/* 🔥 KATEGORI DIPINDAH KE KANAN */}
                <View style={styles.rightSection}>
                  <Text style={styles.itemCategory}>
                    {item.name_category || "Lainnya"}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    paddingTop: 50,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rightHeader: { flexDirection: "row", alignItems: "center" },

  greeting: {
    color: "#E0F2FE",
    fontSize: 16,
    fontWeight: "500",
  },
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
    elevation: 2,
  },

  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: "#6B7280", fontSize: 13 },
  value: { color: "#111827", fontSize: 15, fontWeight: "600" },
  subLabel: { color: "#6B7280", fontSize: 12, marginTop: 8 },
  uniqueValue: { color: "#111827", fontSize: 15, fontWeight: "700" },
  dateBelowMarket: { fontSize: 12, color: "#6B7280", marginTop: 2 },

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
    padding: 12,
    elevation: 1,
  },

  image: {
    width: 65,
    height: 65,
    borderRadius: 10,
    marginRight: 12,
  },

  textContainer: { flex: 1 },

  rightSection: {
    justifyContent: "center",
    alignItems: "flex-end",
    width: 80,
  },

  itemName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  itemPrice: { fontSize: 14, color: "#174A6A", fontWeight: "600" },
  itemDate: { fontSize: 12, color: "#6B7280" },
  itemCategory: {
    fontSize: 12,
    fontWeight: "700", 
    color: "#174A6A" 
  },

  emptyText: {
    color: "#6B7280",
    textAlign: "center",
    marginTop: 20,
  },
});
