// ====================================================
// 📱 DataLocalScreen.js (FINAL FIXED - MENGHINDARI DUPLIKASI ENTRY COUNT)
// ====================================================
import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import NetInfo from "@react-native-community/netinfo";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getAllLocalPrices,
  getDatabase,
  syncPricesToServer,
} from "../../config/database";

// ========================
// 🛠 HELPERS
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

const getLocalYMD = (dateInput) => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getLocalDateMidnight = (dateInput) => {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
};

const get30DaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  date.setHours(0, 0, 0, 0);
  return date;
};

// ========================
// 🔥 CACHE & DATA FETCHING
// ========================
const CACHE_KEY = "server_prices_cache";

const saveServerDataToCache = async (data) => {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("❌ Gagal simpan cache:", err);
  }
};

const getServerDataFromCache = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (!cached) return [];
    return JSON.parse(cached);
  } catch (err) {
    console.error("❌ Gagal baca cache:", err);
    return [];
  }
};

const getSyncedPricesFromServer = async (useCache = false) => {
  if (useCache) {
    const cached = await getServerDataFromCache();
    const thirtyDaysAgo = get30DaysAgo();
    return cached.filter((item) => new Date(item.created_at) >= thirtyDaysAgo);
  }

  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) return [];

    const response = await fetch("http://103.100.27.57:5100/api/prices", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await response.json();
    const data = Array.isArray(json.data) ? json.data : [];
    const db = await getDatabase();
    const thirtyDaysAgo = get30DaysAgo();
    const mapped = [];

    for (const item of data) {
      try {
        const itemDate = new Date(item.created_at);
        if (itemDate < thirtyDaysAgo) continue;

        const commodityId = item.commodity_id;
        const serverImage =
          item.image || item.image_url || item.photo || item.image_url_full || null;

        let localRow = null;
        try {
          localRow = await db.getFirstAsync(
            `SELECT local_image, image FROM commodities WHERE id_commodity = ? LIMIT 1;`,
            [commodityId]
          );
        } catch {}

        mapped.push({
          id_price: item.id_price || `${commodityId}-${getLocalYMD(item.created_at)}`,
          commodity_id: commodityId,
          name_commodity: item.commodity_name,
          raw_price: item.average_price ? Number(item.average_price) : 0,
          name_unit: item.unit_name,
          name_category: item.category_name,
          created_at: item.created_at || new Date().toISOString(),
          image: serverImage || null,
          local_image: localRow?.local_image || null,
          synced: true,
          is_daily_average: true,
          entry_count: item.input_count || 1,
        });
      } catch (e) {
        console.warn("⚠ getSyncedPricesFromServer item map error:", e);
      }
    }

    await saveServerDataToCache(mapped);
    return mapped;
  } catch (err) {
    console.error("❌ Gagal ambil server:", err);
    return await getServerDataFromCache();
  }
};

const getLocalPricesLast30Days = async () => {
  try {
    const allLocal = (await getAllLocalPrices()) || [];
    const thirtyDaysAgo = get30DaysAgo();
    return allLocal.filter(
      (item) =>
        new Date(item.created_at || item.tanggal) >= thirtyDaysAgo &&
        !item.synced &&
        !item.id_price
    );
  } catch (err) {
    console.error("❌ Gagal ambil data lokal:", err);
    return [];
  }
};

const mergeServerAndLocal = (serverRows, localRows) => {
  const finalDataMap = new Map();

  for (const item of localRows) {
    const localKey = item.local_id || item.id || `local-${Math.random()}`;
    finalDataMap.set(localKey, { ...item, source: "local", synced: false, is_daily_average: false });
  }

  for (const item of serverRows) {
    const serverKey = `${item.commodity_id}-${getLocalYMD(item.created_at)}`;
    finalDataMap.set(`server-${serverKey}`, { ...item, source: "server", synced: true, is_daily_average: true });
  }

  return Array.from(finalDataMap.values()).sort((a, b) => {
    const aTime = new Date(a.created_at || a.tanggal).getTime();
    const bTime = new Date(b.created_at || b.tanggal).getTime();
    return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
  });
};

// ========================
// 🔥 MAIN COMPONENT
// ========================
export default function DataLocalScreen({ navigation }) {
  const route = useRoute();
  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState("Semua");
  const [dataKomoditas, setDataKomoditas] = useState([]);
  const [kategori, setKategori] = useState(["Semua"]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchCategories = async () => {
    try {
      const db = await getDatabase();
      const result = await db.getAllAsync("SELECT * FROM categories;");
      const names = result.map((c) => c.name_category);
      setKategori(["Semua", ...names.filter(Boolean)]);
    } catch (e) {
      console.error("❌ Gagal ambil kategori:", e);
    }
  };

  const processDataForDisplay = (listData) =>
    listData
      .map((item) => {
        const priceNum = safeParsePrice(item.price || item.harga || item.raw_price);
        const name = resolveName(item);
        const tanggal = item.created_at || item.tanggal;
        if (name === "-" || priceNum <= 0 || !tanggal) return null;

        const resolvedCategory =
          item.name_category || item.category || item.kategori || item.commodity?.category_name || "Lainnya";

        const isSynced = item.synced;

        return {
          id: item.id_price || item.id || item.local_id || `${item.commodity_id}-${Math.random()}`,
          commodity_id: item.commodity_id,
          nama: name,
          raw_price: priceNum,
          harga: `Rp ${priceNum.toLocaleString("id-ID")}`,
          satuan: resolveUnit(item),
          tanggal,
          kategori: resolvedCategory,
          image: item.image || null,
          local_image: item.local_image || item.localImage || null,
          synced: isSynced,
          status: isSynced ? "Tersinkron" : "Belum Tersinkron",
          is_daily_average: item.is_daily_average || false,
          entry_count_server: item.entry_count || 1,
        };
      })
      .filter(Boolean);

  const fetchData = async () => {
    setLoading(true);
    try {
      const net = await NetInfo.fetch();
      const isOnline = !!net.isConnected;
      const local = await getLocalPricesLast30Days();
      const server = await getSyncedPricesFromServer(!isOnline);
      const merged = mergeServerAndLocal(server, local);
      setDataKomoditas(processDataForDisplay(merged));
    } catch (err) {
      console.error("❌ fetchData:", err);
    } finally {
      setLoading(false);
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
      const unsub = NetInfo.addEventListener((state) => {
        if (state.isConnected) autoSync();
      });
      return () => unsub();
    }, [route.params?.refresh])
  );

  // ===================================================================
  // 💥 LOGIKA GROUPING (MENGHINDARI DUPLIKASI ENTRY COUNT)
  // ===================================================================
  const groupedCommodities = useMemo(() => {
    const selectedDateStr = getLocalYMD(selectedDate.toISOString());

    const filtered = dataKomoditas.filter((item) => {
      const itemDateStr = getLocalYMD(item.tanggal);
      const matchDate = itemDateStr === selectedDateStr;
      const matchSearch = item.nama?.toLowerCase().includes(search.toLowerCase());
      const matchCategory = selectedTab === "Semua" || item.kategori === selectedTab;
      return matchDate && matchSearch && matchCategory;
    });

    const serverAverageMap = new Map();
    const localRawMap = new Map();
    const finalGroup = [];

    // 1. Server Average
    for (const item of filtered) {
      if (item.is_daily_average) serverAverageMap.set(item.commodity_id, item);
    }

    // 2. Local Raw Data
    for (const item of filtered) {
      if (item.is_daily_average || serverAverageMap.has(item.commodity_id)) continue;

      const id = item.commodity_id;
      if (!localRawMap.has(id))
        localRawMap.set(id, { totalPrice: 0, count: 0, latestItem: item });

      const current = localRawMap.get(id);
      current.totalPrice += item.raw_price;
      current.count += 1;
      if (new Date(item.tanggal) > new Date(current.latestItem.tanggal)) current.latestItem = item;
    }

    // 3. Gabungkan
    for (const item of serverAverageMap.values()) {
      finalGroup.push({
        id: item.id,
        commodity_id: item.commodity_id,
        nama: item.nama,
        harga: item.raw_price > 0 ? `Rp ${item.raw_price.toLocaleString("id-ID")}` : "-",
        raw_price: item.raw_price,
        satuan: resolveUnit(item),
        tanggal: item.tanggal,
        kategori: item.kategori,
        image: item.image,
        local_image: item.local_image,
        status: "Tersinkron",
        entry_count: item.entry_count_server || 1,
      });
    }

    for (const [id, group] of localRawMap.entries()) {
      if (serverAverageMap.has(id)) continue;
      const avg = group.count ? Math.round(group.totalPrice / group.count) : 0;
      finalGroup.push({
        id: group.latestItem.id,
        commodity_id: id,
        nama: group.latestItem.nama,
        harga: avg > 0 ? `Rp ${avg.toLocaleString("id-ID")}` : "-",
        raw_price: avg,
        satuan: group.latestItem.satuan,
        tanggal: group.latestItem.tanggal,
        kategori: group.latestItem.kategori,
        image: group.latestItem.image,
        local_image: group.latestItem.local_image,
        status: "Belum Tersinkron",
        entry_count: group.count,
      });
    }

    return finalGroup.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [dataKomoditas, search, selectedTab, selectedDate]);

  const handleDateChange = (event, d) => {
    setShowDatePicker(false);
    if (d) setSelectedDate(getLocalDateMidnight(d));
  };

  const formatTanggalHeader = () =>
    selectedDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  const formatTanggalItem = (tgl) => {
    if (!tgl) return "-";
    const d = new Date(tgl);
    if (isNaN(d.getTime())) return "-";
    return `${d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  };

  // ======================================
  // 💻 RENDER
  // ======================================
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
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="calendar"
            onChange={handleDateChange}
            maximumDate={new Date()}
            minimumDate={get30DaysAgo()}
          />
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
                <Text style={[styles.tabText, selectedTab === item && styles.tabTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </LinearGradient>

      {/* LIST */}
      <ScrollView style={styles.listContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#174A6A" style={{ marginTop: 50 }} />
        ) : groupedCommodities.length ? (
          groupedCommodities.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate("DetailHarga", {
                  commodity_id: item.commodity_id,
                  nama_komoditas: item.nama,
                  kategori: item.kategori,
                  satuan: item.satuan,
                  selectedDate: selectedDate.toISOString(),
                })
              }
            >
              {/* IMAGE */}
              {item.local_image || item.image ? (
                <Image
                  source={{ uri: item.local_image || item.image }}
                  style={{ width: 64, height: 64, borderRadius: 10, marginEnd: 8, backgroundColor: "#EEE" }}
                />
              ) : (
                <View style={{ width: 64, height: 64, borderRadius: 10, marginEnd: 8, backgroundColor: "#EEE", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                </View>
              )}

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
            <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 4 }}>
              Coba ubah tanggal, masukkan data baru, atau pastikan kategori dipilih dengan benar.
            </Text>
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
