/// ====================================================
// 📱 DataLocalScreen.js (FIXED DATA HILANG/KEDIP)
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
// 🛠️ HELPER FUNCTIONS
// ========================
const safeParsePrice = (value) => {
  if (value === null || value === undefined) return 0;
  const cleaned = value.toString().replace(/[^0-9]/g, "");
  return Number(cleaned) || 0;
};

const resolveName = (item) => item.name_commodity || item.nama || item.commodity_name || item.name || "-";
const resolveUnit = (item) => item.name_unit || item.unit || item.satuan || "Kg";

const getLocalYMD = (dateInput) => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
};

const getLocalDateMidnight = (dateInput) => {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
};

// 🔥 UPDATE FORMAT TANGGAL & JAM (Pakai Titik)
const formatTanggalItem = (tgl) => {
  if (!tgl) return "-";
  const d = new Date(tgl);
  if (isNaN(d.getTime())) return "-";
  
  const datePart = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  const timePart = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  return `${datePart}, ${timePart.replace(':', '.')}`;
};

// ========================
// 🔥 FETCHING LOGIC
// ========================
const getSyncedPricesWithPersistence = async (selectedDateStr) => {
  const db = await getDatabase();
  const net = await NetInfo.fetch();
  
  await db.execAsync(`CREATE TABLE IF NOT EXISTS server_prices_cache (id_price TEXT PRIMARY KEY, commodity_id INTEGER, name_commodity TEXT, raw_price REAL, name_unit TEXT, name_category TEXT, date TEXT, created_at TEXT, image TEXT, local_image TEXT);`);

  if (net.isConnected) {
    try {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        const res = await fetch(`http://103.100.27.57:5100/api/prices?date=${selectedDateStr}`, {
           headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
           for (const item of json.data) {
             const idPrice = `server-${item.commodity_id}-${selectedDateStr}`;
             await db.runAsync(
               `INSERT OR REPLACE INTO server_prices_cache (id_price, commodity_id, name_commodity, raw_price, name_unit, name_category, date, created_at, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
               [idPrice, item.commodity_id, item.commodity_name, item.average_price, item.unit_name, item.category_name, selectedDateStr, item.created_at || new Date().toISOString(), item.image]
             );
           }
        }
      }
    } catch (e) {
      console.log("Fetch Error:", e);
    }
  }
  
  const rows = await db.getAllAsync(`SELECT * FROM server_prices_cache WHERE date = ?`, [selectedDateStr]);
  return rows.map(i => ({ ...i, synced: true, is_daily_average: true }));
};

const getLocalPricesLast30Days = async () => {
  const all = (await getAllLocalPrices()) || [];
  const d = new Date(); d.setDate(d.getDate() - 30);
  return all.filter(i => new Date(i.tanggal) >= d);
};

// ========================
// 📱 MAIN COMPONENT
// ========================
export default function DataLocalScreen({ navigation }) {
  const route = useRoute();
  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState("Semua");
  const [dataKomoditas, setDataKomoditas] = useState([]);
  const [kategori, setKategori] = useState(["Semua"]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false); 

  // ========================
  // 🔥 FETCH DATA FUNCTION DENGAN FLAG ISACTIVE
  // ========================
  const fetchData = useCallback(async () => {
    let isActive = true;

    const dateStr = getLocalYMD(selectedDate);
    const server = await getSyncedPricesWithPersistence(dateStr);
    const local = await getLocalPricesLast30Days();

    if (!isActive) return;

    const merged = [...server, ...local].map(item => {
        const price = safeParsePrice(item.raw_price || item.price || item.harga);
        const name = resolveName(item);
        if (!name || price <= 0) return null;

        let cat = item.name_category || item.category || item.kategori;
        if (!cat || cat === "") cat = null; 

        return {
            id: item.id_price || item.id,
            commodity_id: item.commodity_id,
            nama: name,
            raw_price: price,
            satuan: resolveUnit(item),
            tanggal: item.created_at || item.tanggal,
            date: item.date || getLocalYMD(item.tanggal),
            kategori: cat,
            image: item.image,
            local_image: item.local_image,
            synced: item.synced === true || item.is_synced === 1,
            is_daily_average: item.is_daily_average || false
        };
    }).filter(Boolean);

    if (isActive) {
      setDataKomoditas(merged);
      
      const uniqueCats = ["Semua", ...new Set(merged.map(i => i.kategori).filter(c => c && c !== "Lainnya"))];
      if (uniqueCats.length === 1) uniqueCats.push("Lainnya");
      setKategori(uniqueCats);
    }

    return () => { isActive = false };
  }, [selectedDate, route.params?.refresh]);

  // ========================
  // 🔥 USEFOCUSEFFECT
  // ========================
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // ========================
  // 🔥 NETINFO LISTENER
  // ========================
  useEffect(() => {
    let unsubscribed = false;
    const unsub = NetInfo.addEventListener(state => {
      if (!unsubscribed && state.isConnected) {
        setIsSyncing(true);
        syncPricesToServer()
          .then(() => fetchData())
          .finally(() => { if(!unsubscribed) setIsSyncing(false) });
      }
    });
    return () => { unsub(); unsubscribed = true; };
  }, [fetchData]);

  // ========================
  // 🔒 LOGIC GROUPING & DISPLAY (TIDAK DIUBAH)
  // ========================
  const groupedCommodities = useMemo(() => {
    const dateStr = getLocalYMD(selectedDate);
    const groups = new Map();

    dataKomoditas.forEach(item => {
        if (item.date !== dateStr) return;
        if (search && !item.nama.toLowerCase().includes(search.toLowerCase())) return;

        const id = item.commodity_id;
        if (!groups.has(id)) {
            groups.set(id, {
                commodity_id: id,
                items: [],
                serverData: null,
                maxTimestamp: 0,
                displayName: item.nama,
                displayUnit: item.satuan,
                displayCategory: item.kategori, 
                displayImage: item.image || item.local_image,
            });
        }

        const group = groups.get(id);
        group.items.push(item);

        const itemTime = new Date(item.tanggal).getTime();
        if (itemTime > group.maxTimestamp) {
            group.maxTimestamp = itemTime;
            if (!item.is_daily_average && item.local_image) {
                group.displayImage = item.local_image;
            }
        }

        if (item.is_daily_average) {
            group.serverData = item;
            group.displayName = item.nama; 
            group.displayCategory = item.kategori;
            if (item.image) group.displayImage = item.image;
        } else {
            if (item.kategori && !group.displayCategory) {
                group.displayCategory = item.kategori;
            }
        }
    });

    const results = Array.from(groups.values()).map(group => {
        const finalCategory = group.displayCategory || "Lainnya";
        if (selectedTab !== "Semua" && finalCategory !== selectedTab) return null;

        let localTotal = 0;
        let localCount = 0;

        group.items.forEach(i => {
            if (!i.is_daily_average) {
                localTotal += i.raw_price;
                localCount += 1;
            }
        });

        let finalPrice = 0;
        let status = "Tersinkron";

        if (group.serverData) {
            finalPrice = group.serverData.raw_price;
        } else {
            finalPrice = localCount > 0 ? Math.round(localTotal / localCount) : 0;
            status = "Belum Tersinkron";
        }

        return {
            id: group.commodity_id,
            commodity_id: group.commodity_id,
            nama: group.displayName,
            harga: `Rp ${finalPrice.toLocaleString("id-ID")}`,
            satuan: group.displayUnit,
            tanggal: new Date(group.maxTimestamp).toISOString(),
            displayDate: formatTanggalItem(new Date(group.maxTimestamp)),
            kategori: finalCategory,
            image: group.displayImage,
            status: status,
            localCount: localCount
        };
    }).filter(Boolean);

    return results.sort((a, b) => {
        return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
    });

  }, [dataKomoditas, search, selectedTab, selectedDate]);

  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) setSelectedDate(getLocalDateMidnight(date));
  };

  // ======================
  // RENDERING
  // ======================
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={["#174A6A", "#0F172A"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Harga Rata Rata Komoditas</Text>
          </View>
          <View style={styles.headerActions}>
            {isSyncing && (
              <View style={styles.syncBadge}>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.syncText}>Sync...</Text>
              </View>
            )}
            <TouchableOpacity 
              onPress={() => navigation.navigate("Riwayat")} 
              style={styles.historyBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={20} color="#174A6A" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.dateSelector} 
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.9}
        >
          <Ionicons name="calendar" size={18} color="#174A6A" />
          <Text style={styles.dateSelectorText}>
            {selectedDate.toLocaleDateString("id-ID", { weekday: 'long', day: "numeric", month: "long", year: "numeric" })}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#94A3B8" />
        </TouchableOpacity>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            placeholder="Cari komoditas..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {kategori.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.tabItem, selectedTab === item && styles.tabItemActive]}
                onPress={() => setSelectedTab(item)}
              >
                <Text style={[styles.tabText, selectedTab === item && styles.tabTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={{width: 20}} />
          </ScrollView>
        </View>

        <View style={styles.totalBadgeContainer}>
           <View style={styles.totalBadge}>
              <Ionicons name="cube-outline" size={14} color="#E2E8F0" />
              <Text style={styles.totalBadgeText}>
                 Total {groupedCommodities.length} Data
              </Text>
           </View>
        </View>

      </LinearGradient>

      {showDatePicker && (
        <DateTimePicker value={selectedDate} mode="date" display="calendar" onChange={handleDateChange} />
      )}

      <ScrollView style={styles.listContainer}>
        {groupedCommodities.length > 0 ? (
          groupedCommodities.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => navigation.navigate("DetailHarga", {
                commodity_id: item.commodity_id,
                nama_komoditas: item.nama,
                kategori: item.kategori,
                satuan: item.satuan,
                selectedDate: getLocalYMD(selectedDate),
              })}
            >
              <Image
                source={item.image ? { uri: item.image } : null}
                style={styles.itemImage}
              />
              <View style={styles.leftSection}>
                <Text style={styles.itemName}>{item.nama}</Text>
                <Text style={styles.itemPrice}>{item.harga} / {item.satuan}</Text>
                <Text style={styles.avgPrice}>
                   {item.status === "Tersinkron" ? "Harga Rata-Rata" : `Inputan (${item.localCount} data)`}
                </Text>
                <Text style={styles.itemDate}>Update harga : {item.displayDate}</Text>
              </View>

              <View style={styles.rightSection}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{item.kategori}</Text>
                </View>
                <View style={styles.detailLinkContainer}>
                    <Text style={styles.detailLinkText}>Lihat Detail</Text>
                    <Ionicons name="chevron-forward" size={14} color="#174A6A" />
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={{ alignItems: "center", marginTop: 50 }}>
            <Ionicons name="file-tray-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>Tidak ada data di tanggal ini.</Text>
          </View>
        )}
        <View style={{height: 100}} /> 
      </ScrollView>

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

// ========================
// STYLES (TIDAK DIRUBAH)
// ========================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  syncBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  syncText: { color: '#fff', fontSize: 10, marginLeft: 4, fontWeight: '700' },
  historyBtn: { backgroundColor: "#fff", width: 32, height: 32, borderRadius: 19, justifyContent: "center", alignItems: "center", elevation: 2 },
  dateSelector: { backgroundColor: "#fff", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 12 },
  dateSelectorText: { flex: 1, fontSize: 15, fontWeight: "700", color: "#1E293B", marginLeft: 10 },
  searchBar: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 12, height: 40, alignItems: "center" },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: "#fff" },
  tabItem: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", marginRight: 8 },
  tabItemActive: { backgroundColor: "#fff", borderColor: "#fff" },
  tabText: { color: "#E2E8F0", fontSize: 12, fontWeight: "500" },
  tabTextActive: { color: "#174A6A", fontWeight: "700" },
  totalBadgeContainer: { alignItems: 'flex-end', marginTop: 12 },
  totalBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  totalBadgeText: { color: '#E2E8F0', fontSize: 11, fontWeight: '600', marginLeft: 6 },
  listContainer: { padding: 16 },
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 12, elevation: 2, alignItems: "center" },
  itemImage: { width: 65, height: 65, borderRadius: 10, marginEnd: 12, backgroundColor: "#F1F5F9" },
  leftSection: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 2 },
  itemPrice: { fontSize: 14, color: "#174A6A", fontWeight: "700" },
  avgPrice: { fontSize: 11, color: "#475569", fontWeight: "600", marginTop: 2 },
  itemDate: { fontSize: 10, color: "#94A3B8", marginTop: 2, fontStyle:'italic' },
  rightSection: { alignItems: "flex-end", justifyContent: "space-between", height: 65, minWidth: 70 },
  categoryBadge: { backgroundColor: "#E0F2FE", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryBadgeText: { color: "#0284C7", fontSize: 10, fontWeight: "700" },
  detailLinkContainer: { flexDirection: 'row', alignItems: 'center' },
  detailLinkText: { fontSize: 11, color: "#174A6A", fontWeight: "700", marginRight: 2 },
  emptyText: { marginTop: 10, color: "#64748B", fontSize: 14, fontWeight: "500" },
  bottomNav: { flexDirection: "row", justifyContent: "space-around", backgroundColor: "#fff", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#E5E7EB", position: 'absolute', bottom: 0, width: '100%' },
  navItem: { alignItems: "center" },
  navText: { color: "#6B7280", fontSize: 12 },
  navTextActive: { color: "#174A6A", fontWeight: "700" },
});
