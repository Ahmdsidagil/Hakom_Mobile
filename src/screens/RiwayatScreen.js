import React, { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { getRiwayatHapus } from "../../config/database"; // ⬅️ pastikan path sesuai

export default function RiwayatScreen({ navigation }) {
  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState("Semua");
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dataRiwayat, setDataRiwayat] = useState([]); // ⬅️ sekarang ambil dari DB

  const kategori = ["Semua", "Sayuran", "Daging", "Ikan", "Buah", "Telur"];

  // 🔹 Ambil data dari database setiap kali screen difokuskan
  useFocusEffect(
    useCallback(() => {
      const fetchRiwayat = async () => {
        const data = await getRiwayatHapus();
        console.log("📦 Riwayat dari DB:", data);
        setDataRiwayat(data);
      };
      fetchRiwayat();
    }, [])
  );

  // 🔹 Format tanggal biar rapi
  const formatDate = (tgl) => {
    try {
      return new Date(tgl).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return tgl;
    }
  };

  // 🔹 Filter data berdasarkan search, kategori, dan tanggal
  const filteredData = dataRiwayat.filter((item) => {
    const cocokSearch =
      item.name_commodity?.toLowerCase().includes(search.toLowerCase()) ?? false;
    const cocokKategori =
      selectedTab === "Semua"
        ? true
        : item.name_category?.toLowerCase() === selectedTab.toLowerCase();
    return cocokSearch && cocokKategori;
  });

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={["#174A6A", "#0B3B53"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.leftGroup}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Riwayat</Text>
          </View>

          <TouchableOpacity onPress={() => setFilterVisible(true)}>
            <Ionicons name="filter-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* SEARCH */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#6B7280" />
          <TextInput
            placeholder="Search"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>

        {/* FILTER ROW */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.filterBox}
            onPress={() => setDatePickerVisible(true)}
          >
            <Ionicons name="calendar-outline" size={16} color="#174A6A" />
            <Text style={styles.filterText}>{formatDate(selectedDate)}</Text>
          </TouchableOpacity>

          <View style={styles.filterBox}>
            <Ionicons name="cube-outline" size={16} color="#174A6A" />
            <Text style={styles.filterText}>Total : {filteredData.length}</Text>
          </View>
        </View>

        {/* TAB KATEGORI */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tabRow}>
            {kategori.map((item) => (
              <TouchableOpacity
                key={item}
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

      {/* LIST RIWAYAT */}
      <ScrollView
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {filteredData.length > 0 ? (
          filteredData.map((item) => (
            <View key={item.id} style={styles.card}>
              <Image
                source={{
                  uri:
                    "https://cdn-icons-png.flaticon.com/512/1046/1046784.png",
                }}
                style={styles.image}
              />
              <View style={styles.cardContent}>
                <Text style={styles.itemName}>{item.name_commodity}</Text>
                <Text style={styles.itemPrice}>Rp {item.price}</Text>
                <Text style={styles.itemDate}>{formatDate(item.tanggal)}</Text>
              </View>
              <View style={styles.iconRight}>
                <Text style={[styles.statusText, { color: "#EF4444" }]}>
                  Hapus
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ textAlign: "center", marginTop: 20, color: "#6B7280" }}>
            Tidak ada riwayat hapus
          </Text>
        )}
      </ScrollView>

      {/* MODAL FILTER */}
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
            {["Semua", "upload", "edit", "hapus"].map((status) => (
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
                  {status === "upload"
                    ? "Sinkron"
                    : status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {datePickerVisible && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="spinner"
          onChange={(event, date) => {
            if (date) setSelectedDate(date);
            setDatePickerVisible(false);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    marginTop: 12,
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
    borderRadius: 10,
    marginBottom: 12,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    alignItems: "center",
  },
  image: { width: 60, height: 60, borderRadius: 8, marginRight: 10 },
  cardContent: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  itemPrice: { fontSize: 14, color: "#174A6A", fontWeight: "600" },
  itemDate: { fontSize: 12, color: "#6B7280" },
  iconRight: { marginLeft: 8 },
  statusText: { fontWeight: "700", fontSize: 13 },
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
