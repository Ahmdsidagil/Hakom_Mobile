// ====================================================
// 📱 DataLocalScreen.js (CLEAN - NO LOADING SPINNER)
// ====================================================
import React, { useState, useCallback, useMemo, useEffect } from "react";
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
  item.name_commodity || item.nama || item.commodity_name || item.name || item.commodity?.name || "-";

const resolveUnit = (item) =>
  item.name_unit || item.unit || item.satuan || item.commodity?.unit || "-";

const getLocalYMD = (dateInput) => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
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

const formatTanggalItem = (tgl) => {
  if (!tgl) return "-";
  const d = new Date(tgl);
  return `${d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}, ${d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })} WIB`;
};

// ========================
// 🔥 DATA FETCHING LOGIC
// ========================
const CACHE_KEY = "server_prices_cache";

const saveServerDataToCache = async (data) => {
  try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (err) {}
};

const getServerDataFromCache = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (err) { return []; }
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
      const itemDate = new Date(item.created_at);
      if (itemDate < thirtyDaysAgo) continue;

      let localRow = null;
      try {
        localRow = await db.getFirstAsync(
          `SELECT local_image FROM commodities WHERE id_commodity = ? LIMIT 1;`,
          [item.commodity_id]
        );
      } catch {}

      mapped.push({
        id_price: item.id_price,
        commodity_id: item.commodity_id,
        name_commodity: item.commodity_name,
        raw_price: Number(item.average_price) || 0,
        name_unit: item.unit_name,
        name_category: item.category_name,
        created_at: item.created_at,
        image: item.image || item.image_url_full || null,
        local_image: localRow?.local_image || null,
        synced: true,
        is_daily_average: true,
        entry_count: item.input_count || 1,
      });
    }

    await saveServerDataToCache(mapped);
    return mapped;
  } catch (err) {
    return await getServerDataFromCache();
  }
};

const getLocalPricesLast30Days = async () => {
  const allLocal = (await getAllLocalPrices()) || [];
  const thirtyDaysAgo = get30DaysAgo();
  return allLocal.filter(
    (item) => new Date(item.created_at || item.tanggal) >= thirtyDaysAgo && !item.synced
  );
};

const mergeServerAndLocal = (serverRows, localRows) => {
  const finalDataMap = new Map();
  for (const item of localRows) {
    const key = `local-${item.local_id || item.id}`;
    finalDataMap.set(key, { ...item, synced: false });
  }
  for (const item of serverRows) {
    const key = `server-${item.commodity_id}-${getLocalYMD(item.created_at)}`;
    finalDataMap.set(key, { ...item, synced: true });
  }
  return Array.from(finalDataMap.values());
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

  // Kategori dinamis
  const updateCategories = useCallback((mergedData) => {
    const dynamicCats = mergedData.map(item => 
      item.name_category || item.category || item.kategori || "Lainnya"
    );
    const uniqueCats = ["Semua", ...new Set(dynamicCats.filter(Boolean))];
    setKategori(uniqueCats);
  }, []);

  const fetchMasterCategories = async () => {
    try {
      const db = await getDatabase();
      const result = await db.getAllAsync("SELECT name_category FROM categories;");
      if (result.length > 0) {
        const names = result.map((c) => c.name_category).filter(Boolean);
        setKategori(prev => ["Semua", ...new Set([...prev, ...names])]);
      }
    } catch (e) {}
  };

  const processDataForDisplay = (listData) =>
    listData
      .map((item) => {
        const priceNum = safeParsePrice(item.price || item.harga || item.raw_price);
        const name = resolveName(item);
        const tanggal = item.created_at || item.tanggal;
        if (name === "-" || priceNum <= 0 || !tanggal) return null;

        return {
          id: item.id_price || item.id || item.local_id || Math.random().toString(),
          commodity_id: item.commodity_id,
          nama: name,
          raw_price: priceNum,
          harga: `Rp ${priceNum.toLocaleString("id-ID")}`,
          satuan: resolveUnit(item),
          tanggal,
          kategori: item.name_category || item.category || item.kategori || "Lainnya",
          image: item.image || null,
          local_image: item.local_image || null,
          synced: item.synced,
          status: item.synced ? "Tersinkron" : "Belum Tersinkron",
          is_daily_average: item.is_daily_average || false,
          entry_count_server: item.entry_count || 1,
        };
      })
      .filter(Boolean);

  const fetchData = async () => {
    try {
      const net = await NetInfo.fetch();
      const isOnline = !!net.isConnected;
      const local = await getLocalPricesLast30Days();
      const server = await getSyncedPricesFromServer(!isOnline);
      const merged = mergeServerAndLocal(server, local);
      
      const processed = processDataForDisplay(merged);
      setDataKomoditas(processed);
      updateCategories(processed);
    } catch (err) {
      console.error(err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMasterCategories();
      fetchData();
      const unsub = NetInfo.addEventListener((state) => {
        if (state.isConnected) syncPricesToServer().then(() => fetchData());
      });
      return () => unsub();
    }, [route.params?.refresh])
  );

  const groupedCommodities = useMemo(() => {
    const selectedDateStr = getLocalYMD(selectedDate);

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

    filtered.forEach(item => {
      if (item.is_daily_average) {
        serverAverageMap.set(item.commodity_id, item);
      }
    });

    filtered.forEach(item => {
      if (!item.is_daily_average && !serverAverageMap.has(item.commodity_id)) {
        const id = item.commodity_id;
        if (!localRawMap.has(id)) {
          localRawMap.set(id, { totalPrice: 0, count: 0, latestItem: item });
        }
        const current = localRawMap.get(id);
        current.totalPrice += item.raw_price;
        current.count += 1;
        if (new Date(item.tanggal) > new Date(current.latestItem.tanggal)) {
          current.latestItem = item;
        }
      }
    });

    serverAverageMap.forEach(item => {
      finalGroup.push({
        ...item,
        status: "Tersinkron",
        entry_count: item.entry_count_server,
      });
    });

    localRawMap.forEach((group) => {
      const avg = Math.round(group.totalPrice / group.count);
      finalGroup.push({
        ...group.latestItem,
        harga: `Rp ${avg.toLocaleString("id-ID")}`,
        raw_price: avg,
        status: "Belum Tersinkron",
        entry_count: group.count,
      });
    });

    return finalGroup.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  }, [dataKomoditas, search, selectedTab, selectedDate]);

  const handleDateChange = (event, d) => {
    setShowDatePicker(false);
    if (d) setSelectedDate(getLocalDateMidnight(d));
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#174A6A", "#0B3B53"]} style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Rata-Rata Harga Komoditas</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Riwayat")} style={{ padding: 6 }}>
            <Ionicons name="time-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

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
            <Text style={styles.filterText}>
              {selectedDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
            </Text>
          </TouchableOpacity>
          <View style={styles.filterBox}>
            <Ionicons name="cube-outline" size={16} color="#174A6A" />
            <Text style={styles.filterText}>{groupedCommodities.length} Komoditas</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
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

      {showDatePicker && (
        <DateTimePicker value={selectedDate} mode="date" display="calendar" onChange={handleDateChange} />
      )}

      <ScrollView style={styles.listContainer}>
        {groupedCommodities.length ? (
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
              <Image
                source={item.local_image || item.image ? { uri: item.local_image || item.image } : null}
                style={styles.itemImage}
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
  tabRow: { flexDirection: "row" },
  tabItem: { paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, borderRadius: 20, borderWidth: 1, borderColor: "#fff" },
  tabActive: { backgroundColor: "#fff" },
  tabText: { color: "#fff", fontWeight: "500" },
  tabTextActive: { color: "#174A6A", fontWeight: "700" },
  listContainer: { padding: 16 },
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, elevation: 2, alignItems: "center" },
  itemImage: { width: 64, height: 64, borderRadius: 10, marginEnd: 12, backgroundColor: "#EEE" },
  leftSection: { flex: 1 },
  rightSection: { alignItems: "flex-end", minWidth: 100 },
  itemName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  itemPrice: { fontSize: 14, color: "#174A6A", fontWeight: "700" },
  avgPrice: { fontSize: 11, color: "#1e293b", fontWeight: "700", marginTop: 2 },
  itemDate: { fontSize: 10, color: "#64748b", marginTop: 2 },
  itemCategory: { fontSize: 12, color: "#174A6A", fontWeight: "700" },
  statusText: { fontSize: 11, fontWeight: "700" },
  emptyText: { marginTop: 10, color: "#64748B", fontSize: 16 },
  bottomNav: { flexDirection: "row", justifyContent: "space-around", backgroundColor: "#fff", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  navItem: { alignItems: "center" },
  navText: { color: "#6B7280", fontSize: 12 },
  navTextActive: { color: "#174A6A", fontWeight: "700" },
});