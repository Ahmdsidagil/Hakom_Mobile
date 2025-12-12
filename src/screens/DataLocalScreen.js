// ===============================
// 📱 DataLocalScreen.js (FIXED: SERVER CACHE + LOCAL + 30 DAYS)
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
// 🛠 HELPER
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

const formatServerDate = (isoString) => {
  if (!isoString) return null;
  const d = new Date(isoString);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// ========================
// 🔥 GET 30 DAYS DATE RANGE
// ========================
const get30DaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  date.setHours(0, 0, 0, 0);
  return date;
};

// ========================
// 🔥 CACHE MANAGEMENT
// ========================
const CACHE_KEY = "server_prices_cache";

const saveServerDataToCache = async (data) => {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    console.log("💾 Data server berhasil di-cache");
  } catch (err) {
    console.error("❌ Gagal simpan cache:", err);
  }
};

const getServerDataFromCache = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (!cached) return [];
    const data = JSON.parse(cached);
    console.log(`📦 Menggunakan ${data.length} data dari cache`);
    return data;
  } catch (err) {
    console.error("❌ Gagal baca cache:", err);
    return [];
  }
};

// ========================
// 🔥 FETCH SERVER DATA (30 HARI TERAKHIR) + CACHE
// ========================
const getSyncedPricesFromServer = async (useCache = false) => {
  // Jika offline, ambil dari cache
  if (useCache) {
    const cached = await getServerDataFromCache();
    const thirtyDaysAgo = get30DaysAgo();
    
    // Filter cache 30 hari terakhir
    return cached.filter((item) => {
      const itemDate = new Date(item.created_at);
      return itemDate >= thirtyDaysAgo;
    });
  }

  // Jika online, fetch dari server
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) return [];

    const response = await fetch("http://103.100.27.57:5100/api/prices", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await response.json();
    const data = Array.isArray(json.data) ? json.data : [];

    const db = await getDatabase();
    const thirtyDaysAgo = get30DaysAgo();

    const mapped = [];
    for (const item of data) {
      try {
        // 🔥 FILTER: Hanya ambil data 30 hari terakhir
        const itemDate = new Date(item.created_at);
        if (itemDate < thirtyDaysAgo) continue;

        const commodityId = item.commodity_id;

        const serverImage =
          item.image ||
          item.image_url ||
          item.photo ||
          item.image_url_full ||
          null;

        let localRow = null;
        try {
          localRow = await db.getFirstAsync(
            `SELECT local_image, image FROM commodities WHERE id_commodity = ? LIMIT 1;`,
            [commodityId]
          );
        } catch {}

        mapped.push({
          id_price: item.id_price || item.commodity_id,
          commodity_id: commodityId,
          name_commodity: item.commodity_name,
          price: item.average_price ? Number(item.average_price) : 0,
          name_unit: item.unit_name,
          name_category: item.category_name,
          created_at: item.created_at || new Date().toISOString(),
          image: serverImage || null,
          local_image: localRow?.local_image || null,
          synced: true,
        });
      } catch (e) {
        console.warn("⚠ getSyncedPricesFromServer item map error:", e);
      }
    }

    // 💾 SIMPAN KE CACHE
    await saveServerDataToCache(mapped);

    return mapped;
  } catch (err) {
    console.error("❌ Gagal ambil server:", err);
    // Jika error, coba ambil dari cache
    return await getServerDataFromCache();
  }
};

// ========================
// 🔥 GET LOCAL DATA (30 HARI TERAKHIR)
// ========================
const getLocalPricesLast30Days = async () => {
  try {
    const allLocal = (await getAllLocalPrices()) || [];
    const thirtyDaysAgo = get30DaysAgo();

    // 🔥 FILTER: Hanya ambil data lokal 30 hari terakhir
    return allLocal.filter((item) => {
      const itemDate = new Date(item.created_at || item.tanggal);
      return itemDate >= thirtyDaysAgo;
    });
  } catch (err) {
    console.error("❌ Gagal ambil data lokal:", err);
    return [];
  }
};

// ========================
// 🔥 MERGE SERVER + LOKAL (TANPA DUPLIKASI - FIXED)
// ========================
const mergeServerAndLocal = (serverRows, localRows) => {
  const finalDataMap = new Map();

  // Tambahkan semua data server (dari API atau cache)
  for (const item of serverRows) {
    const serverId = item.id_price || item.id;
    if (!serverId) continue;
    finalDataMap.set(`price-${serverId}`, {
      ...item,
      source: 'server'
    });
  }

  // Tambahkan data lokal yang belum ada di server
  for (const item of localRows) {
    // 🔥 PENTING: Skip jika data lokal sudah punya id_price (sudah sync)
    if (item.id_price) {
      // Cek apakah id_price ini sudah ada di server
      if (finalDataMap.has(`price-${item.id_price}`)) {
        console.log(`⏭️ Skip local item ${item.id} - already synced as ${item.id_price}`);
        continue;
      }
    }

    // 🔥 Hanya tambahkan data lokal yang belum sync (id_price = null)
    if (!item.id_price || item.synced === 0) {
      const localKey = item.local_id || item.id || `local-${Math.random()}`;
      finalDataMap.set(localKey, {
        ...item,
        source: 'local'
      });
    }
  }

  // Sort berdasarkan tanggal terbaru
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
        const tanggal = item.created_at || item.tanggal;

        if (name === "-" || priceNum <= 0 || !tanggal) return null;

        return {
          id:
            item.id_price ||
            item.id ||
            item.local_id ||
            `${item.commodity_id}-${Math.random()}`,
          commodity_id: item.commodity_id,
          nama: name,
          raw_price: priceNum,
          harga: `Rp ${priceNum.toLocaleString("id-ID")}`,
          satuan: resolveUnit(item),
          tanggal,
          kategori:
            item.name_category || item.category || item.kategori || "Lainnya",
          image: item.image || null,
          local_image: item.local_image || item.localImage || null,
          status: isOnline || item.synced ? "Tersinkron" : "Belum Tersinkron",
        };
      })
      .filter(Boolean);
  };

  // ========================
  // 🔥 FETCH DATA: GABUNG SERVER (CACHE) + LOCAL (30 HARI)
  // ========================
  const fetchData = async () => {
    try {
      const net = await NetInfo.fetch();
      const isOnline = !!net.isConnected;

      console.log(`🌐 Status: ${isOnline ? "ONLINE" : "OFFLINE"}`);

      // Ambil data lokal (30 hari terakhir)
      const local = await getLocalPricesLast30Days();
      
      // 🔥 Ambil data server:
      // - Jika ONLINE: fetch dari API + simpan ke cache
      // - Jika OFFLINE: ambil dari cache
      const server = await getSyncedPricesFromServer(!isOnline);

      console.log(`📊 Data Lokal (30 hari): ${local.length}`);
      console.log(`📊 Data Server ${isOnline ? "(API)" : "(Cache)"} (30 hari): ${server.length}`);

      // Gabungkan data server (dari API/cache) dan lokal
      const merged = mergeServerAndLocal(server, local);

      console.log(`✅ Total Data Setelah Merge: ${merged.length}`);

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

  // ===========================
  // 🔥 AUTO REFRESH
  // ===========================
  useFocusEffect(
    useCallback(() => {
      fetchCategories();
      fetchData();
      const unsub = NetInfo.addEventListener(() => autoSync());
      return () => unsub();
    }, [route.params?.refresh])
  );

  const hitungRataRataKemarin = (commodityId) => {
    const yesterday = new Date(
      selectedDate.getTime() - 24 * 60 * 60 * 1000
    );
    const yesterdayStr = formatServerDate(yesterday.toISOString());

    const yesterdayItems = dataKomoditas.filter(
      (item) =>
        String(item.commodity_id) === String(commodityId) &&
        formatServerDate(item.tanggal) === yesterdayStr
    );

    if (!yesterdayItems.length) return 0;

    const total = yesterdayItems.reduce(
      (sum, item) => sum + item.raw_price,
      0
    );
    return Math.round(total / yesterdayItems.length);
  };

  const groupedCommodities = useMemo(() => {
    const selectedDateStr = formatServerDate(selectedDate.toISOString());

    const filtered = dataKomoditas.filter((item) => {
      const itemDateStr = formatServerDate(item.tanggal);
      const matchDate = itemDateStr === selectedDateStr;
      const matchSearch = item.nama
        ?.toLowerCase()
        .includes(search.toLowerCase());
      const matchCategory =
        selectedTab === "Semua" || item.kategori === selectedTab;

      return matchDate && matchSearch && matchCategory;
    });

    const map = new Map();
    for (const item of filtered) {
      const id = item.commodity_id;
      if (!map.has(id))
        map.set(id, { totalPrice: 0, count: 0, latestItem: item });

      const current = map.get(id);
      current.totalPrice += item.raw_price;
      current.count += 1;

      if (new Date(item.tanggal) > new Date(current.latestItem.tanggal)) {
        current.latestItem = item;
      }
    }

    return Array.from(map.values()).map((group) => {
      const avg =
        group.count ? Math.round(group.totalPrice / group.count) : 0;
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

  const handleDateChange = (event, d) => {
    setShowDatePicker(false);
    if (d) setSelectedDate(d);
  };

  const formatTanggalHeader = () =>
    selectedDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const formatTanggalItem = (tgl) => {
    if (!tgl) return "-";
    const d = new Date(tgl);
    if (isNaN(d.getTime())) return "-";
    return `${d.getUTCDate()} ${d.toLocaleString("id-ID", {
      month: "short",
    })} ${d.getUTCFullYear()}, ${d
      .getUTCHours()
      .toString()
      .padStart(2, "0")}.${d
      .getUTCMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  // ==============================
  // 🔥 RENDER UI
  // ==============================
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient
        colors={["#174A6A", "#0B3B53"]}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>
            Rata-Rata Harga Komoditas
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Riwayat")}
            style={{ padding: 6 }}
          >
            <Ionicons
              name="time-outline"
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="calendar"
            onChange={handleDateChange}
          />
        )}

        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={18}
            color="#6B7280"
          />
          <TextInput
            placeholder="Cari komoditas..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.filterBox}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color="#174A6A"
            />
            <Text style={styles.filterText}>
              {formatTanggalHeader()}
            </Text>
          </TouchableOpacity>

          <View style={styles.filterBox}>
            <Ionicons
              name="cube-outline"
              size={16}
              color="#174A6A"
            />
            <Text style={styles.filterText}>
              Total: {groupedCommodities.length} Komoditas
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <View style={styles.tabRow}>
            {kategori.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.tabItem,
                  selectedTab === item && styles.tabActive,
                ]}
                onPress={() => setSelectedTab(item)}
              >
                <Text
                  style={[
                    styles.tabText,
                    selectedTab === item && styles.tabTextActive,
                  ]}
                >
                  {item}
                </Text>
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
                const yesterdayAvg =
                  hitungRataRataKemarin(item.commodity_id);
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
              {item.local_image ? (
                <Image
                  source={{ uri: item.local_image }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 10,
                    marginEnd: 8,
                    backgroundColor: "#EEE",
                  }}
                />
              ) : item.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 10,
                    marginEnd: 8,
                    backgroundColor: "#EEE",
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 10,
                    marginEnd: 8,
                    backgroundColor: "#EEE",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="image-outline"
                    size={24}
                    color="#9CA3AF"
                  />
                </View>
              )}

              <View style={styles.leftSection}>
                <Text style={styles.itemName}>{item.nama}</Text>
                <Text style={styles.itemPrice}>
                  {item.harga} / {item.satuan}
                </Text>
                <Text style={styles.avgPrice}>
                  Diinput {item.entry_count} kali (Hari Ini)
                </Text>
                <Text style={styles.itemDate}>
                  Update Terakhir:{" "}
                  {formatTanggalItem(item.tanggal)}
                </Text>
              </View>

              <View style={styles.rightSection}>
                <Text style={styles.itemCategory}>
                  {item.kategori}
                </Text>
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        item.status === "Tersinkron"
                          ? "#16A34A"
                          : "#DC2626",
                    },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View
            style={{ alignItems: "center", marginTop: 50 }}
          >
            <Ionicons
              name="file-tray-outline"
              size={48}
              color="#CBD5E1"
            />
            <Text style={styles.emptyText}>
              Tidak ada data di tanggal ini.
            </Text>
            <Text
              style={{
                color: "#94A3B8",
                fontSize: 12,
                marginTop: 4,
              }}
            >
              Coba ubah tanggal atau masukkan data baru.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* BOTTOM NAV */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Dashboard")}
        >
          <Ionicons
            name="home-outline"
            size={24}
            color="#6B7280"
          />
          <Text style={styles.navText}>Beranda</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons
            name="folder"
            size={24}
            color="#174A6A"
          />
          <Text
            style={[styles.navText, styles.navTextActive]}
          >
            Rata-rata
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Profile")}
        >
          <Ionicons
            name="person-outline"
            size={24}
            color="#6B7280"
          />
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
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

  searchContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    alignItems: "center",
    borderRadius: 10,
    marginTop: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: { flex: 1, marginLeft: 6, color: "#111827" },

  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  filterBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterText: { marginLeft: 5, color: "#174A6A", fontWeight: "600" },

  tabRow: { flexDirection: "row", marginTop: 10, paddingBottom: 4 },
  tabItem: {
    backgroundColor: "transparent",
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#fff",
  },
  tabActive: { backgroundColor: "#fff" },
  tabText: { color: "#fff", fontWeight: "500" },
  tabTextActive: { color: "#174A6A", fontWeight: "700" },

  listContainer: { padding: 16 },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    alignItems: "center",
    paddingRight: 16,
  },
  leftSection: { flex: 1, justifyContent: "center" },
  rightSection: {
    minWidth: 110,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  itemName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  itemPrice: {
    fontSize: 14,
    color: "#174A6A",
    fontWeight: "700",
    marginTop: 2,
  },
  itemDate: { fontSize: 11, color: "#6B7280", marginTop: 4 },
  avgPrice: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "700",
    marginTop: 3,
  },
  itemCategory: {
    fontSize: 13,
    color: "#174A6A",
    fontWeight: "700",
  },
  statusText: { fontSize: 12, fontWeight: "700" },
  emptyText: {
    textAlign: "center",
    marginTop: 10,
    color: "#64748B",
    fontSize: 16,
    fontWeight: "600",
  },

  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  navItem: { alignItems: "center" },
  navText: { color: "#6B7280", fontSize: 12 },
  navTextActive: { color: "#174A6A", fontWeight: "700" },
});