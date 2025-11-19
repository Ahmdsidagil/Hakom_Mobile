// src/screens/RiwayatScreen.js
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";

import {
  getAllRiwayatPendataan,
  getRiwayatHapus,
  getDatabase,
  syncDataToServer,
} from "../../config/database";

export default function RiwayatScreen({ navigation }) {
  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState("Semua");
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dataRiwayat, setDataRiwayat] = useState([]);
  const [kategori, setKategori] = useState(["Semua"]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCategories = async () => {
    try {
      const db = await getDatabase();
      if (!db) return;
      const categoriesResult = await db.getAllAsync("SELECT * FROM categories;");
      const kategoriNames = categoriesResult.map((c) => c.name_category);
      setKategori(["Semua", ...kategoriNames]);
    } catch (error) {
      console.error("❌ Gagal ambil kategori:", error);
    }
  };

  const fetchRiwayat = async () => {
    try {
      await syncDataToServer(false);

      const riwayatPendataan = await getAllRiwayatPendataan();
      const riwayatHapus = await getRiwayatHapus();

      const formattedOnline = riwayatPendataan.map((item) => ({
        ...item,
        status: "Sudah Tersinkron",
      }));
      const formattedHapus = riwayatHapus.map((item) => ({
        ...item,
        status: "Hapus",
      }));

      const combined = [...formattedOnline, ...formattedHapus];

      const uniqueMap = new Map();
      combined.forEach((item) => {
        const key =
          (item.commodity_id || item.name_commodity || "unknown") +
          "_" +
          (item.tanggal || item.created_at || "unknown");

        if (!uniqueMap.has(key)) uniqueMap.set(key, item);
      });

      const uniqueArray = Array.from(uniqueMap.values()).sort(
        (a, b) =>
          new Date(b.tanggal || b.created_at) - new Date(a.tanggal || a.created_at)
      );

      setDataRiwayat(uniqueArray);
    } catch (error) {
      console.error("❌ Gagal ambil data riwayat:", error);
      setDataRiwayat([]);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRiwayat();
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
      fetchRiwayat();
    }, [])
  );

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

  const filteredData = dataRiwayat.filter((item) => {
    const matchSearch = item.name_commodity
      ?.toLowerCase()
      .includes(search.toLowerCase().trim());
    const matchCategory = selectedTab === "Semua" || item.name_category === selectedTab;
    const matchStatus = filterStatus === "Semua" || item.status === filterStatus;
    const sameDay =
      new Date(item.tanggal || item.created_at).toDateString() ===
      selectedDate.toDateString();
    return matchSearch && matchCategory && matchStatus && sameDay;
  });

  const getStatusColor = (status) => {
    if (status === "Sudah Tersinkron") return "#22C55E";
    if (status === "Belum Sinkron") return "#F59E0B";
    if (status === "Hapus") return "#EF4444";
    return "#6B7280";
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={["#174A6A", "#0B3B53"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.leftGroup}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Riwayat Pendataan</Text>
          </View>
          <TouchableOpacity onPress={() => setFilterVisible(true)}>
            <Ionicons name="filter-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search */}
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

        {/* Filter Row */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.filterBox}
            onPress={() => setDatePickerVisible(true)}
          >
            <Ionicons name="calendar-outline" size={16} color="#174A6A" />
            <Text style={styles.filterText}>
              {selectedDate.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Text>
          </TouchableOpacity>

          <View style={styles.filterBox}>
            <Ionicons name="cube-outline" size={16} color="#174A6A" />
            <Text style={styles.filterText}>Total: {filteredData.length}</Text>
          </View>
        </View>

        {/* Tabs Kategori */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tabRow}>
            {kategori.map((item, index) => (
              <TouchableOpacity
                key={`${item}-${index}`}
                style={[styles.tabItem, selectedTab === item && styles.tabActive]}
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

      {/* LIST RIWAYAT */}
      <ScrollView
        style={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
      >
        {filteredData.length > 0 ? (
          filteredData.map((item, idx) => (
            <View
              key={`${item.commodity_id || item.name_commodity}-${idx}`}
              style={styles.card}
            >
              {/* GAMBAR */}
              <Image
                source={{
                  uri: "https://cdn-icons-png.flaticon.com/512/415/415682.png",
                }}
                style={styles.image}
                resizeMode="contain"
              />

              {/* KONTEN KIRI */}
              <View style={styles.cardLeft}>
                <Text style={styles.itemName}>{item.name_commodity || "-"}</Text>
                <Text style={styles.itemPrice}>
                  {formatHarga(item.price)} / {item.unit || "-"}
                </Text>
                <Text style={styles.itemDate}>
                  {formatTanggalItem(item.tanggal || item.created_at)}
                </Text>
              </View>

              {/* KONTEN KANAN */}
              <View style={styles.cardRight}>
                <Text style={styles.itemCategory}>
                  {item.name_category || "Lainnya"}
                </Text>

                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(item.status) },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ textAlign: "center", marginTop: 40, color: "#6B7280" }}>
            Tidak ada riwayat ditemukan
          </Text>
        )}
      </ScrollView>

      {/* Modal Filter */}
      <Modal
        visible={filterVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setFilterVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Riwayat</Text>

            {["Semua", "Sudah Tersinkron", "Belum Sinkron", "Hapus"].map(
              (status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterOption,
                    filterStatus === status && styles.filterOptionActive,
                  ]}
                  onPress={() => {
                    setFilterStatus(status);
                    setFilterVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filterStatus === status && { color: "#fff" },
                    ]}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Date Picker */}
      {datePickerVisible && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="calendar"
          onChange={(e, date) => {
            if (date) setSelectedDate(date);
            setDatePickerVisible(false);
          }}
        />
      )}
    </View>
  );
}

/* ========================== */
/*          STYLES            */
/* ========================== */

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
    alignItems: "center",
    justifyContent: "space-between",
  },

  leftGroup: { flexDirection: "row", alignItems: "center" },

  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 24,
  },

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

  tabRow: {
    flexDirection: "row",
    marginTop: 10,
    paddingBottom: 4,
  },

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

  /* CARD STYLE BARU */
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    elevation: 1,
    alignItems: "center",
  },

  image: {
    width: 55,
    height: 55,
    borderRadius: 8,
    marginRight: 12,
  },

  cardLeft: { flex: 1 },

  itemName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  itemPrice: {
    fontSize: 14,
    color: "#174A6A",
    fontWeight: "600",
    marginTop: 2,
  },

  itemDate: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },

  cardRight: {
    alignItems: "flex-end",
    minWidth: 100,
  },

  itemCategory: {
    fontSize: 13,
    fontWeight: "700",
    color: "#174A6A",
  },

  statusText: {
    fontWeight: "700",
    fontSize: 12,
    marginTop: 4,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    color: "#174A6A",
  },

  filterOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#E0F2FE",
  },

  filterOptionActive: { backgroundColor: "#174A6A" },

  filterOptionText: { color: "#174A6A", fontWeight: "600" },
});
