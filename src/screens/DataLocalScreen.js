// ===============================
// 📱 DataLocalScreen.js (FINAL - Hari Ini & Kemarin + Server + Lokal + Gambar)
// ===============================
import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import NetInfo from "@react-native-community/netinfo";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getAllLocalPrices,
  getDatabase,
  syncPricesToServer,
} from "../../config/database";

// ========================
// 🛠 HELPER FUNCTIONS
// ========================
const safeParsePrice = (value) => {
  if (value === null || value === undefined) return 0;
  const cleaned = value.toString().replace(/[^0-9]/g, "");
  const parsed = Number(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

const resolveName = (item) =>
  item.name_commodity ||
  item.nama ||
  item.commodity_name ||
  item.name ||
  item.commodity?.name ||
  "-";

const resolveUnit = (item) =>
  item.name_unit || item.unit || item.satuan || item.commodity?.unit || "-";

// ========================
// 🔥 FORMAT TANGGAL SERVER
// ========================
const formatServerDate = (isoString) => {
  if (!isoString) return null;
  const d = new Date(isoString);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// ========================
// 🔥 MERGE DATA
// ========================
const mergeServerAndLocal = (serverRows, localRows) => {
  const finalDataMap = new Map();
  const allRows = [...serverRows, ...localRows];

  for (const item of allRows) {
    const key = item.id_price || item.id || item.local_id || `local-${Math.random()}`;
    finalDataMap.set(key, item);
  }

  return Array.from(finalDataMap.values()).sort((a, b) => {
    const aTime = new Date(a.created_at || a.tanggal).getTime();
    const bTime = new Date(b.created_at || b.tanggal).getTime();
    return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
  });
};

// ========================
// 🔥 FETCH SERVER
// ========================
const getSyncedPricesFromServer = async () => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) return [];

    const response = await fetch("http://103.100.27.57:5100/api/prices", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await response.json();
    const data = Array.isArray(json.data) ? json.data : [];

    return data.map((item) => ({
      id_price: item.commodity_id,
      commodity_id: item.commodity_id,
      name_commodity: item.commodity_name || "-",
      price: item.average_price !== null ? Number(item.average_price) : 0,
      name_unit: item.unit_name || "-",
      created_at: item.created_at || new Date().toISOString(),
      name_category: item.category_name || "Lainnya",
      image: item.image_url
        ? `http://103.100.27.57:5100/${item.image_url}`
        : null,
      synced: true,
    }));
  } catch (err) {
    console.error("❌ Gagal ambil server:", err);
    return [];
  }
};

// ========================
// 🔥 MAIN COMPONENT
// ========================
export default function DataLocalScreen({ navigation }) {
  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState("Semua");
  const [dataKomoditas, setDataKomoditas] = useState([]);
  const [kategori, setKategori] = useState(["Semua"]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fetchCategories = async () => {
    try {
      const db = await getDatabase();
      const result = await db.getAllAsync("SELECT * FROM categories;");
      const names = result.map((c) => c.name_category);
      setKategori(["Semua", ...names]);
    } catch (e) {
      console.error("❌ Gagal ambil kategori:", e);
    }
  };

  const processDataForDisplay = (listData, isOnline) => {
    return listData
      .map((item) => {
        const priceNum = safeParsePrice(item.price || item.harga);
        const name = resolveName(item);
        if (name === "-") return null;

        return {
          id:
            item.id_price || item.id || item.local_id || `${item.commodity_id}-${Math.random()}`,
          commodity_id: item.commodity_id,
          nama: name,
          raw_price: priceNum,
          harga: priceNum > 0 ? `Rp ${priceNum.toLocaleString("id-ID")}` : "-",
          satuan: resolveUnit(item),
          tanggal: item.created_at || item.tanggal || new Date().toISOString(),
          kategori: item.name_category || item.category || item.kategori || "Lainnya",
          image: item.image || null,
          local_image: item.local_image || null,
          status: isOnline || item.synced ? "Tersinkron" : "Belum Tersinkron",
        };
      })
      .filter(Boolean);
  };

  const fetchData = async () => {
    try {
      const state = await NetInfo.fetch();
      const isOnline = !!state.isConnected;

      const local = (await getAllLocalPrices()) || [];
      const server = isOnline ? await getSyncedPricesFromServer() : [];
      const merged = mergeServerAndLocal(server, local);
      setDataKomoditas(processDataForDisplay(merged, isOnline));
    } catch (err) {
      console.error("❌ fetchData:", err);
    }
  };

  const autoSync = async () => {
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      try {
        await syncPricesToServer();
      } catch {}
      await fetchData();
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
      fetchData();
      const unsub = NetInfo.addEventListener(() => autoSync());
      return () => unsub();
    }, [])
  );

  // ========================
  // 🔥 HITUNG RATA-RATA KEMARIN
  // ========================
  const hitungRataRataKemarin = (commodityId) => {
    const yesterday = new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = formatServerDate(yesterday.toISOString());

    const yesterdayItems = dataKomoditas.filter(
      (item) =>
        String(item.commodity_id) === String(commodityId) &&
        formatServerDate(item.tanggal) === yesterdayStr
    );
    if (!yesterdayItems.length) return 0;
    const total = yesterdayItems.reduce((sum, item) => sum + item.raw_price, 0);
    return Math.round(total / yesterdayItems.length);
  };

  // ========================
  // 🔥 GROUP DATA HARI INI
  // ========================
  const groupedCommodities = useMemo(() => {
    const selectedDateStr = formatServerDate(selectedDate.toISOString());

    const filtered = dataKomoditas.filter((item) => {
      const itemDateStr = formatServerDate(item.tanggal);
      const matchDate = itemDateStr === selectedDateStr;
      const matchSearch = item.nama?.toLowerCase().includes(search.toLowerCase());
      const matchCategory = selectedTab === "Semua" || item.kategori === selectedTab;
      return matchDate && matchSearch && matchCategory;
    });

    const map = new Map();
    for (const item of filtered) {
      const id = item.commodity_id;
      if (!map.has(id)) {
        map.set(id, { totalPrice: 0, count: 0, latestItem: item });
      }
      const current = map.get(id);
      current.totalPrice += item.raw_price;
      current.count += 1;
      if (new Date(item.tanggal) > new Date(current.latestItem.tanggal)) {
        current.latestItem = item;
      }
    }

    return Array.from(map.values()).map((group) => {
      const avg = group.count ? Math.round(group.totalPrice / group.count) : 0;
      return {
        id: group.latestItem.commodity_id,
        commodity_id: group.latestItem.commodity_id,
        nama: group.latestItem.nama,
        harga: avg > 0 ? `Rp ${avg.toLocaleString("id-ID")}` : "-",
        raw_price: avg,
        satuan: group.latestItem.satuan,
        tanggal: group.latestItem.tanggal,
        kategori: group.latestItem.kategori,
        image: group.latestItem.image,
        local_image: group.latestItem.local_image,
        status: group.latestItem.status,
        entry_count: group.count,
      };
    });
  }, [dataKomoditas, search, selectedTab, selectedDate]);

  // ========================
  // 🔥 FORMAT TANGGAL
  // ========================
  const formatTanggalHeader = () =>
    selectedDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  const formatTanggalItem = (tgl) => {
    if (!tgl) return "-";
    const d = new Date(tgl);
    if (isNaN(d.getTime())) return "-";
    return `${d.getUTCDate()} ${d.toLocaleString("id-ID", { month: "short" })} ${d.getUTCFullYear()}, ${d.getUTCHours().toString().padStart(2, "0")}.${d.getUTCMinutes().toString().padStart(2, "0")}`;
  };

  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };

  // ========================
  // 🔥 RENDER
  // ========================
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={["#174A6A", "#0B3B53"]} style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Rata-Rata Harga Komoditas</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Riwayat")} style={{ padding: 6 }}>
            <Ionicons name="time-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker value={selectedDate} mode="date" display="calendar" onChange={handleDateChange} />
        )}

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#6B7280" />
          <TextInput
            placeholder="Cari komoditas..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterBox} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={16} color="#174A6A" />
            <Text style={styles.filterText}>{formatTanggalHeader()}</Text>
          </TouchableOpacity>

          <View style={styles.filterBox}>
            <Ionicons name="cube-outline" size={16} color="#174A6A" />
            <Text style={styles.filterText}>Total: {groupedCommodities.length} Komoditas</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tabRow}>
            {kategori.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.tabItem, selectedTab === item && styles.tabActive]}
                onPress={() => setSelectedTab(item)}
              >
                <Text style={[styles.tabText, selectedTab === item && styles.tabTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </LinearGradient>

      {/* LIST */}
      <ScrollView style={styles.listContainer}>
        {groupedCommodities.length ? (
          groupedCommodities.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => {
                const yesterdayAvg = hitungRataRataKemarin(item.commodity_id);
                navigation.navigate("DetailHarga", {
                  commodity_id: item.commodity_id,
                  nama_komoditas: item.nama,
                  kategori: item.kategori,
                  satuan: item.satuan,
                  initialPrice: item.raw_price,
                  yesterdayPrice: yesterdayAvg,
                });
              }}
            >
              <Image
                source={
                  item.image
                    ? { uri: item.image }
                    : item.local_image
                    ? { uri: item.local_image }
                    : null
                }
                style={{ width: 64, height: 64, borderRadius: 10, marginEnd: 8, backgroundColor: "#EEE" }}
              />

              <View style={styles.leftSection}>
                <Text style={styles.itemName}>{item.nama}</Text>
                <Text style={styles.itemPrice}>{item.harga} / {item.satuan}</Text>
                <Text style={styles.avgPrice}>Diinput {item.entry_count} kali (Hari Ini)</Text>
                <Text style={styles.itemDate}>Update Terakhir: {formatTanggalItem(item.tanggal)}</Text>
              </View>

              <View style={styles.rightSection}>
                <Text style={styles.itemCategory}>{item.kategori}</Text>
                <Text style={[styles.statusText, { color: item.status === "Tersinkron" ? "#16A34A" : "#DC2626" }]}>
                  {item.status}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={{ alignItems: "center", marginTop: 50 }}>
            <Ionicons name="file-tray-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>Tidak ada data di tanggal ini.</Text>
            <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 4 }}>Coba ubah tanggal atau masukkan data baru.</Text>
          </View>
        )}
      </ScrollView>

      {/* BOTTOM NAV */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate("Dashboard")}>
          <Ionicons name="home-outline" size={24} color="#6B7280" />
          <Text style={styles.navText}>Beranda</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="folder" size={24} color="#174A6A" />
          <Text style={[styles.navText, styles.navTextActive]}>Rata-rata</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate("Profile")}>
          <Ionicons name="person-outline" size={24} color="#6B7280" />
          <Text style={styles.navText}>Profil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ===============================
// 🎨 STYLES
// ===============================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

  searchContainer: { flexDirection: "row", backgroundColor: "#fff", alignItems: "center", borderRadius: 10, marginTop: 10, paddingHorizontal: 10, height: 40 },
  searchInput: { flex: 1, marginLeft: 6, color: "#111827" },

  filterRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  filterBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#E0F2FE", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  filterText: { marginLeft: 5, color: "#174A6A", fontWeight: "600" },

  tabRow: { flexDirection: "row", marginTop: 10, paddingBottom: 4 },
  tabItem: { backgroundColor: "transparent", paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, borderRadius: 20, borderWidth: 1, borderColor: "#fff" },
  tabActive: { backgroundColor: "#fff" },
  tabText: { color: "#fff", fontWeight: "500" },
  tabTextActive: { color: "#174A6A", fontWeight: "700" },

  listContainer: { padding: 16 },
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, alignItems: "center", paddingRight: 16 },
  leftSection: { flex: 1, justifyContent: "center" },
  rightSection: { minWidth: 110, alignItems: "flex-end", justifyContent: "center" },

  itemName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  itemPrice: { fontSize: 14, color: "#174A6A", fontWeight: "700", marginTop: 2 },
  itemDate: { fontSize: 11, color: "#6B7280", marginTop: 4 },
  avgPrice: { fontSize: 12, color: "#0F172A", fontWeight: "700", marginTop: 3 }, 
  itemCategory: { fontSize: 13, color: "#174A6A", fontWeight: "700" },
  statusText: { fontSize: 12, fontWeight: "700" },
  emptyText: { textAlign: "center", marginTop: 10, color: "#64748B", fontSize: 16, fontWeight: "600" },

  bottomNav: { flexDirection: "row", justifyContent: "space-around", backgroundColor: "#fff", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  navItem: { alignItems: "center" },
  navText: { color: "#6B7280", fontSize: 12 },
  navTextActive: { color: "#174A6A", fontWeight: "700" },
});
