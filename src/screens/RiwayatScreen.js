import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Modal,
  Pressable,
  RefreshControl,
  ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";

import {
  getAllRiwayatPendataan,
  getAllRiwayatHapus,
  getDatabase,
  getImageForCommodityByName
} from "../../config/database";

// ================= GLOBAL CONST =================
const STATUS_OPTIONS = ["Semua", "Tersinkron", "Hapus"];

// ================= HELPER TANGGAL =================
const toLocalYMD = (dateObj) => {
  if (!dateObj) return "";
  const d = new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


const isSameDay = (dateInput, selectedDateObj) => {
  if (!dateInput || !selectedDateObj) return false;

  let inputStr = "";

  if (typeof dateInput === 'string' && dateInput.length === 10) {
    inputStr = dateInput;
  } else {
    inputStr = toLocalYMD(new Date(dateInput));
  }
  return inputStr === toLocalYMD(selectedDateObj);
};

export default function RiwayatScreen({ navigation }) {
  const [dataRiwayat, setDataRiwayat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState("Semua");
  const [kategoriList, setKategoriList] = useState(["Semua"]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDateFiltered, setIsDateFiltered] = useState(false);

  const formatIndoDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // =============================== FETCH DATA (FIXED CATEGORY) ===============================
  const fetchData = async () => {
    setLoading(true);
    try {
      const db = await getDatabase();

      // 1. Ambil Master Data untuk Sinkronisasi Kategori
      const masterCom = await db.getAllAsync(
        `SELECT id_commodity, name_commodity, category_name FROM commodities`
      );
      
      const categoryLookupById = {};
      const categoryLookupByName = {};

      masterCom.forEach(item => {
        if (item.id_commodity) categoryLookupById[item.id_commodity] = item.category_name;
        if (item.name_commodity) categoryLookupByName[item.name_commodity] = item.category_name;
      });

      // 2. Kategori Tabs
      const cats = await db.getAllAsync(`SELECT name_category FROM categories`);
      setKategoriList(["Semua", ...cats.map(c => c.name_category)]);

      // 3. Riwayat Hapus
      const hapusRaw = await getAllRiwayatHapus();
      
      const listHapus = await Promise.all(
        hapusRaw.map(async (h) => {
          let img = h.local_image || h.image;
          if (!img || img === "null") img = await getImageForCommodityByName(h.name_commodity);
          
          return {
            ...h,
            unique_key: `hapus_${h.id}_${Math.random()}`,
            type: "deleted",
            status_label: "Hapus",
            image: img,
            // SINKRONISASI KATEGORI
            name_category: h.name_category || categoryLookupById[h.commodity_id] || categoryLookupByName[h.name_commodity] || "Bumbu",
            tanggal_fix: h.tanggal || h.created_at || new Date().toISOString()
          };
        })
      );

      // 4. Riwayat Tersinkron
      const pendataanRaw = await getAllRiwayatPendataan();
      
      const listTersinkron = await Promise.all(
        pendataanRaw.map(async (p) => {
          if (!p.name_commodity) return null;
          const img = await getImageForCommodityByName(p.name_commodity);
          
          return {
            ...p,
            unique_key: `sync_${p.id}`,
            type: "active",
            status_label: "Tersinkron",
            image: img,
            // SINKRONISASI KATEGORI
            name_category: p.name_category || categoryLookupById[p.commodity_id] || categoryLookupByName[p.name_commodity] || "Bumbu",
            tanggal_fix: p.tanggal || p.created_at || new Date().toISOString()
          };
        })
      );


      const merged = [...listTersinkron, ...listHapus]
        .filter(Boolean)
        .sort((a, b) => new Date(b.tanggal_fix) - new Date(a.tanggal_fix));

      setDataRiwayat(merged);
    
    } catch (e) {
      console.error("❌ Riwayat error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // =============================== FILTER ===============================
  const filteredData = dataRiwayat.filter(item => {
  
    const matchSearch = item.name_commodity?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = selectedTab === "Semua" || item.name_category === selectedTab;
    const matchStatus = filterStatus === "Semua" || item.status_label === filterStatus;
    const matchDate = isSameDay(item.tanggal_fix, selectedDate) || isSameDay(item.created_at, selectedDate);

    return matchSearch && matchCategory && matchStatus && matchDate;
  });

  const getStatusColor = (s) => s === "Tersinkron" ? "#22C55E" : "#EF4444";

  const resolveImage = (item) => {
    if (item.local_image) return { uri: item.local_image };
    if (item.image) return { uri: item.image };
    return null;
  };

  // =============================== RENDER ===============================
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={["#174A6A", "#0F172A"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5, marginRight: 10 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Riwayat Pendataan</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => setFilterVisible(true)} style={{ padding: 5 }}>
            <Ionicons name="filter" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.dateSelector} onPress={() => setDatePickerVisible(true)}>
          <Ionicons name="calendar" size={18} color="#174A6A" />
          <Text style={styles.dateSelectorText}>{formatIndoDate(selectedDate)}</Text>
          <Ionicons name="chevron-down" size={16} color="#94A3B8" />
        </TouchableOpacity>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari komoditas..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {kategoriList.map((cat, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.tabItem, selectedTab === cat && styles.tabItemActive]}
                onPress={() => setSelectedTab(cat)}
              >
                <Text style={[styles.tabText, selectedTab === cat && styles.tabTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* TOTAL DATA BADGE (DIKEMBALIKAN) */}
        <View style={styles.totalBadgeContainer}>
          <View style={styles.totalBadge}>
            <Ionicons name="cube-outline" size={14} color="#E2E8F0" />
            <Text style={styles.totalBadgeText}>Total {filteredData.length} Data</Text>
          </View>
        </View>
      </LinearGradient>

      {/* CONTENT */}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#174A6A" style={{ marginTop: 50 }} />
        ) : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            {filteredData.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-clear-outline" size={64} color="#CBD5E1" />
                <Text style={styles.emptyText}>Kosong di Tanggal Ini</Text>
                <Text style={styles.emptySubText}>
                  Tidak ada data aktif maupun hapus pada {"\n"}
                  {formatIndoDate(selectedDate)}
                </Text>
              </View>
            ) : (
              filteredData.map((item) => (
                <View key={item.unique_key} style={[styles.card, item.type === "deleted" && styles.cardDeleted]}>
                  <View style={styles.imgWrapper}>
                    {resolveImage(item) ? (
                      <Image source={resolveImage(item)} style={styles.img} />
                    ) : (
                      <Ionicons name="image-outline" size={24} color="#CBD5E1" />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.rowTop}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.name_commodity}</Text>
                      <View style={styles.categoryBox}>
                        <Text style={styles.categoryText}>{item.name_category}</Text>
                      </View>
                    </View>

                    <View style={styles.rowMiddle}>
                        <Text style={styles.cardPrice}>
                            Rp {Number(item.price).toLocaleString("id-ID")} / {item.unit}
                        </Text>
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.cardTime}>
                        🕒 {new Date(item.tanggal_fix).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                      <Text style={[styles.statusText, { color: getStatusColor(item.status_label) }]}>
                        {item.status_label}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* MODAL FILTER */}
      <Modal visible={filterVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setFilterVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Status</Text>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.modalOption, filterStatus === opt && styles.modalOptionActive]}
                onPress={() => {
                  setFilterStatus(opt);
                  setFilterVisible(false);
                }}
              >
                <Text style={[styles.modalOptionText, filterStatus === opt && { color: "#fff" }]}>{opt}</Text>
                {filterStatus === opt && <Ionicons name="checkmark" size={20} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* DATE PICKER */}
      {datePickerVisible && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={(e, d) => {
            setDatePickerVisible(false);
            if (d) {
              setSelectedDate(d);
              setIsDateFiltered(true);
            }
          }}
        />
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { paddingTop: 45, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTop: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  dateSelector: { backgroundColor: "#fff", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 12 },
  dateSelectorText: { flex: 1, fontSize: 16, fontWeight: "700", color: "#1E293B", marginLeft: 10 },
  searchBar: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 12, height: 44, alignItems: "center" },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: "#fff" },
  tabItem: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", marginRight: 8 },
  tabItemActive: { backgroundColor: "#fff", borderColor: "#fff" },
  tabText: { color: "#E2E8F0", fontSize: 12, fontWeight: "500" },
  tabTextActive: { color: "#174A6A", fontWeight: "700" },
  totalBadgeContainer: { alignItems: 'flex-end', marginTop: 12 },
  totalBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  totalBadgeText: { color: '#E2E8F0', fontSize: 11, fontWeight: '600', marginLeft: 6 },
  content: { flex: 1, padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 12, flexDirection: "row", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: {width:0, height:2} },
  cardDeleted: { backgroundColor: "#FEF2F2", borderColor: "#FECACA", borderWidth: 1 },
  imgWrapper: { width: 65, height: 65, borderRadius: 10, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center", marginRight: 12, overflow: "hidden" },
  img: { width: "100%", height: "100%" },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B", flex: 1, marginRight: 8 },
  categoryBox: { backgroundColor: "#E0F2FE", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryText: { fontSize: 10, fontWeight: "700", color: "#0369A1" },
  rowMiddle: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardPrice: { fontSize: 15, fontWeight: "700", color: "#174A6A", marginRight: 8 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between" },
  cardTime: { fontSize: 11, color: "#94A3B8" },
  statusText: { fontSize: 11, fontWeight: "700" },
  emptyState: { alignItems: "center", marginTop: 60 },
  emptyText: { marginTop: 16, color: "#64748B", fontWeight: "700", fontSize: 16 },
  emptySubText: { marginTop: 4, color: "#94A3B8", fontSize: 13, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 },
  modalContent: { backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 15, textAlign:'center' },
  modalOption: { flexDirection: "row", justifyContent: "space-between", padding: 15, borderRadius: 12, backgroundColor: "#F8FAFC", marginBottom: 8 },
  modalOptionActive: { backgroundColor: "#174A6A" },
  modalOptionText: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
});