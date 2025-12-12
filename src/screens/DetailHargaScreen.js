// ===============================
// 📱 DetailHargaScreen.js (FIXED, clean & safe)
// ===============================
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import {
  getAllLocalPrices,
  deleteLocalPrice,
  getDatabase,
} from "../../config/database";

// -----------------------------
// Helpers
// -----------------------------
const formatTanggal = (tgl) => {
  if (!tgl) return "-";
  const d = new Date(tgl);
  if (isNaN(d.getTime())) return "-";
  const bulan = [
    "Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des",
  ];
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
};

const formatTanggalHeader = (tgl) => {
  if (!tgl) return "-";
  const d = new Date(tgl);
  try {
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return formatTanggal(tgl);
  }
};

const get30DaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  date.setHours(0, 0, 0, 0);
  return date;
};

const safeNumber = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

// -----------------------------
// Cache helpers
// -----------------------------
const getCacheKey = (commodityId) => `detail_prices_${commodityId}`;

const saveDetailCacheToStorage = async (commodityId, data) => {
  try {
    await AsyncStorage.setItem(getCacheKey(commodityId), JSON.stringify(data));
  } catch (err) {
    console.warn("⚠ saveDetailCacheToStorage failed:", err);
  }
};

const getDetailCacheFromStorage = async (commodityId) => {
  try {
    const cached = await AsyncStorage.getItem(getCacheKey(commodityId));
    return cached ? JSON.parse(cached) : [];
  } catch (err) {
    console.warn("⚠ getDetailCacheFromStorage failed:", err);
    return [];
  }
};

// -----------------------------
// Fetch server prices (30 days) + cache
// -----------------------------
const fetchServerPricesForCommodity = async (commodityId, useCache = false) => {
  if (useCache) {
    const cached = await getDetailCacheFromStorage(commodityId);
    const thirtyDaysAgo = get30DaysAgo();
    return cached.filter((item) => new Date(item.created_at || item.tanggal) >= thirtyDaysAgo);
  }

  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) return [];

    const url = `http://103.100.27.57:5100/api/prices?commodity_id=${commodityId}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return await getDetailCacheFromStorage(commodityId);

    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];
    const db = await getDatabase();
    const thirtyDaysAgo = get30DaysAgo();

    const mapped = [];

    for (const item of data) {
      try {
        const itemDate = new Date(item.created_at || item.tanggal || new Date().toISOString());
        if (itemDate < thirtyDaysAgo) continue;

        let localRow = null;
        try {
          localRow = await db.getFirstAsync(
            `SELECT local_image FROM commodities WHERE id_commodity = ? LIMIT 1;`,
            [commodityId]
          );
        } catch {}

        mapped.push({
          id: item.id_price || item.id || null,
          id_price: item.id_price || item.id || null,
          commodity_id: commodityId,
          price: safeNumber(item.price || item.average_price || item.avg_price),
          raw_price: safeNumber(item.price || item.average_price || item.avg_price),
          created_at: item.created_at || item.tanggal || new Date().toISOString(),
          tanggal: item.created_at || item.tanggal || new Date().toISOString(),
          image: item.image || item.image_url || item.photo || null,
          local_image: localRow?.local_image || null,
          synced: true,
        });
      } catch {}
    }

    await saveDetailCacheToStorage(commodityId, mapped);
    return mapped;
  } catch (err) {
    console.warn("❌ fetchServerPricesForCommodity error:", err);
    return await getDetailCacheFromStorage(commodityId);
  }
};

// -----------------------------
// Get local prices
// -----------------------------
const getLocalPricesForCommodity = async (commodityId) => {
  try {
    const allLocal = await getAllLocalPrices();
    const thirtyDaysAgo = get30DaysAgo();
    return allLocal.filter((item) => {
      if (String(item.commodity_id) !== String(commodityId)) return false;
      const itemDate = new Date(item.created_at || item.tanggal || item.date);
      return !isNaN(itemDate.getTime()) && itemDate >= thirtyDaysAgo;
    });
  } catch {
    return [];
  }
};

// -----------------------------
// Merge server + local prices
// -----------------------------
const mergeServerAndLocalPrices = (serverPrices = [], localPrices = []) => {
  const finalMap = new Map();

  for (const s of serverPrices) {
    const sid = s.id_price || s.id || null;
    if (!sid) continue;
    finalMap.set(`price-${sid}`, { ...s, source: "server" });
  }

  for (const l of localPrices) {
    if (l.id_price && finalMap.has(`price-${l.id_price}`)) continue;
    const key = l.local_id || l.id || `local-${Math.random()}`;
    finalMap.set(key, { ...l, source: "local" });
  }

  return Array.from(finalMap.values()).sort((a, b) => {
    const ta = new Date(a.created_at || a.tanggal).getTime();
    const tb = new Date(b.created_at || b.tanggal).getTime();
    return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
  });
};

// -----------------------------
// Group prices per day
// -----------------------------
const groupPricesByDay = (prices = []) => {
  const map = new Map();
  for (const p of prices) {
    const d = new Date(p.created_at || p.tanggal || new Date().toISOString());
    if (isNaN(d.getTime())) continue;
    const key = d.toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }

  const groups = Array.from(map.entries()).map(([key, items]) => {
    const total = items.reduce((s, it) => s + safeNumber(it.price ?? it.raw_price), 0);
    const avg = Math.round(total / (items.length || 1));
    return { dateKey: key, date: new Date(items[0].created_at || items[0].tanggal), items, avg, count: items.length, sample: items[0] };
  });

  return groups.sort((a, b) => b.date - a.date);
};

// -----------------------------
// Component
// -----------------------------
export default function DetailHargaScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { commodity_id, nama_komoditas, kategori, satuan } = route.params || {};

  const [allPrices, setAllPrices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [expandedDateKey, setExpandedDateKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const net = await NetInfo.fetch();
      const isOnline = typeof net.isInternetReachable === "boolean" ? net.isInternetReachable : net.isConnected;

      const local = await getLocalPricesForCommodity(commodity_id);
      const server = await fetchServerPricesForCommodity(commodity_id, !isOnline);

      const merged = mergeServerAndLocalPrices(server, local);
      setAllPrices(merged);

      const grouped = groupPricesByDay(merged);
      setGroups(grouped);

      const selKey = new Date(date).toDateString();
      setExpandedDateKey(grouped.find((g) => g.dateKey === selKey) ? selKey : null);
    } catch (err) {
      console.warn("❌ fetchData detail error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = NetInfo.addEventListener((state) => {
      const online = typeof state.isInternetReachable === "boolean" ? state.isInternetReachable : state.isConnected;
      if (online) fetchData().catch(() => {});
    });
    return () => unsub();
  }, [commodity_id]);

  useEffect(() => {
    const key = new Date(date).toDateString();
    setExpandedDateKey(groups.find((g) => g.dateKey === key) ? key : expandedDateKey);
  }, [date, groups]);

  const toggleSelect = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const handleLongPressItem = (item) => { if (!item.synced) { if (!selectionMode) setSelectionMode(true); toggleSelect(item.id || item.local_id); } };
  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return;
    Alert.alert("Hapus data", `Hapus ${selectedIds.length} item lokal yang dipilih?`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => { 
        for (const id of selectedIds) await deleteLocalPrice(id).catch(() => {}); 
        setSelectedIds([]); setSelectionMode(false); await fetchData(); 
      }},
    ]);
  };
  const handleEdit = (item) => { if (!item.synced) navigation.navigate("EditDataScreen", { data: item, onGoBack: fetchData }); };

  const renderImage = (item) => {
    if (item.local_image) return <Image source={{ uri: item.local_image }} style={styles.image} />;
    if (item.image) return <Image source={{ uri: item.image }} style={styles.image} />;
    return <View style={[styles.image, { alignItems: "center", justifyContent: "center" }]}><Ionicons name="image-outline" size={24} color="#9CA3AF" /></View>;
  };

  const toggleGroupExpand = (dateKey) => setExpandedDateKey(prev => prev === dateKey ? null : dateKey);

  const headerAvg = useMemo(() => {
    const todayKey = new Date(date).toDateString();
    const g = groups.find((x) => x.dateKey === todayKey);
    if (g) return g.avg;
    if (!allPrices.length) return 0;
    const total = allPrices.reduce((s, it) => s + safeNumber(it.price ?? it.raw_price), 0);
    return Math.round(total / allPrices.length);
  }, [groups, date, allPrices]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {selectionMode ? (
          <>
            <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedIds([]); }} style={styles.backBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{selectedIds.length} dipilih</Text>
            <TouchableOpacity onPress={handleDeleteSelected} style={styles.deleteBtnHeader}>
              <Ionicons name="trash" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{nama_komoditas || "Detail Harga"}</Text>
          </>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Info Header */}
        <View style={styles.infoHeader}>
          <Text style={styles.title}>{nama_komoditas || "-"}</Text>
          <Text style={styles.subtitle}>Kategori: {kategori || "-"} | Satuan: {satuan || "-"}</Text>

          <View style={styles.infoBoxRow}>
            <View style={styles.infoBox}>
              <Text style={styles.avg}>Rata-rata: Rp {Number(headerAvg).toLocaleString("id-ID")}</Text>
              <Text style={styles.totalData}>Total Data (30 Hari): {allPrices.length}</Text>
              <Text style={styles.totalData}>Hari Ini: {groups.find((g) => g.dateKey === new Date().toDateString())?.count ?? 0}</Text>
            </View>

            <TouchableOpacity style={styles.dateBox} onPress={() => setShowPicker(true)}>
              <Ionicons name="calendar-outline" size={16} color="#174A6A" />
              <Text style={styles.dateBoxText}>{formatTanggalHeader(date)}</Text>
            </TouchableOpacity>
          </View>

          {showPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={(e, sel) => { setShowPicker(Platform.OS === "ios"); if (sel) setDate(sel); }}
            />
          )}
        </View>

        {/* Grouped Days List */}
        {loading ? (
          <Text style={styles.empty}>Loading...</Text>
        ) : groups.length ? (
          groups.map((group) => {
            const isExpanded = expandedDateKey === group.dateKey;
            return (
              <View key={group.dateKey} style={styles.groupCard}>
                <TouchableOpacity onPress={() => toggleGroupExpand(group.dateKey)} style={styles.groupHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ marginRight: 12 }}>{group.sample && renderImage(group.sample)}</View>
                    <View>
                      <Text style={styles.groupDate}>{formatTanggal(group.date)}</Text>
                      <Text style={styles.groupMeta}>{group.count} input • Rata-rata Rp {Number(group.avg).toLocaleString("id-ID")}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 13, color: "#174A6A", fontWeight: "700" }}>Lihat</Text>
                    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#174A6A" />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.groupItems}>
                    {group.items.map((item) => {
                      const idKey = item.id || item.local_id || item.id_price || JSON.stringify(item.created_at);
                      return (
                        <TouchableOpacity
                          key={idKey}
                          style={styles.card}
                          onLongPress={() => handleLongPressItem(item)}
                          onPress={() => { if (selectionMode && !item.synced) toggleSelect(item.id || item.local_id); }}
                        >
                          {selectionMode && !item.synced && (
                            <View style={[styles.checkbox, selectedIds.includes(item.id || item.local_id) && styles.checked]}>
                              {selectedIds.includes(item.id || item.local_id) && <Ionicons name="checkmark" size={16} color="#fff" />}
                            </View>
                          )}

                          <View style={{ marginRight: 12 }}>{renderImage(item)}</View>

                          <View style={styles.info}>
                            <Text style={styles.price}>Rp {Number(item.price ?? item.raw_price).toLocaleString("id-ID")} / {satuan || "-"}</Text>
                            <Text style={styles.date}>Jam: {new Date(item.created_at || item.tanggal).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</Text>
                            <Text style={[styles.status, { color: item.synced ? "#16A34A" : "#DC2626" }]}>{item.synced ? "Tersinkron" : "Belum Tersinkron"}</Text>
                          </View>

                          {!selectionMode && !item.synced && (
                            <TouchableOpacity onPress={() => handleEdit(item)} style={styles.editBtnRight}>
                              <Ionicons name="pencil" size={20} color="#2563EB" />
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <Text style={styles.empty}>Belum ada data harga dalam 30 hari terakhir.</Text>
        )}
      </ScrollView>
    </View>
  );
}

// -----------------------------
// Styles (tidak diubah, aman)
// -----------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: "#174A6A", paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff", flex: 1 },
  deleteBtnHeader: { marginLeft: "auto" },
  content: { flex: 1, padding: 16 },
  infoHeader: { marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  infoBoxRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 12 },
  infoBox: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, marginRight: 8 },
  avg: { fontSize: 16, fontWeight: "700", color: "#174A6A", marginBottom: 4 },
  totalData: { fontSize: 14, fontWeight: "600", color: "#111827", marginTop: 2 },
  dateBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#E0F2FE", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3 },
  dateBoxText: { marginLeft: 6, fontSize: 14, fontWeight: "600", color: "#174A6A" },
  groupCard: { backgroundColor: "#fff", borderRadius: 12, marginBottom: 12, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3 },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", padding: 12, alignItems: "center" },
  groupDate: { fontSize: 16, fontWeight: "700", color: "#111827" },
  groupMeta: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  groupItems: { paddingHorizontal: 8, paddingBottom: 12 },
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, padding: 12, marginVertical: 8, alignItems: "center", position: "relative" },
  checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 1, borderColor: "#6B7280", justifyContent: "center", alignItems: "center", marginRight: 8 },
  checked: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  image: { width: 64, height: 64, borderRadius: 10, marginRight: 12, backgroundColor: "#EEE" },
  info: { flex: 1 },
  price: { fontSize: 14, fontWeight: "700", color: "#174A6A" },
  date: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  status: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  editBtnRight: { marginLeft: 12 },
  empty: { textAlign: "center", marginTop: 40, color: "#6B7280" },
});
