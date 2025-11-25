// src/screens/DataLocalScreen.js
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import NetInfo from "@react-native-community/netinfo";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getAllLocalPrices,
  deleteLocalPrice,
  getDatabase,
  syncPricesToServer,
} from "../../config/database";


// Fungsi ambil data server
const getSyncedPricesFromServer = async () => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) return [];

    const response = await fetch("http://103.100.27.57:5100/api/prices", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    if (data?.success && Array.isArray(data.prices)) {
      return data.prices.map((item) => ({
        id: item.id,
        name_commodity: item.name,
        price: item.price,
        unit: item.unit || "-",
        tanggal: item.updated_at || new Date().toISOString(),
        name_category: item.category || "Lainnya",
        image: item.image_url || null,
        synced: true,
      }));
    }
    return [];
  } catch (err) {
    console.error("❌ Gagal ambil data server:", err);
    return [];
  }
};

export default function DataLocalScreen({ navigation }) {
  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState("Semua");
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [dataKomoditas, setDataKomoditas] = useState([]);
  const [kategori, setKategori] = useState(["Semua"]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Ambil kategori
  const fetchCategories = async () => {
    try {
      const db = await getDatabase();
      const result = await db.getAllAsync("SELECT * FROM categories;");
      const kategoriNames = result.map((c) => c.name_category);
      setKategori(["Semua", ...kategoriNames]);
    } catch (error) {
      console.error("❌ Gagal ambil kategori:", error);
    }
  };

  // Ambil data lokal + server
  const fetchData = async () => {
    try {
      const localData = await getAllLocalPrices();
      const serverData = await getSyncedPricesFromServer();

      const combined = [
        ...(Array.isArray(serverData) ? serverData : []),
        ...localData.filter((ld) => !(Array.isArray(serverData) ? serverData : []).some((sd) => sd.id === ld.id)),
      ];

      setDataKomoditas(
        combined.map((item) => ({
          id: item.id,
          nama: item.name_commodity,
          harga: `Rp ${parseInt(item.price || 0).toLocaleString("id-ID")}`,
          satuan: item.unit || "-",
          tanggal: item.tanggal || new Date().toISOString(),
          kategori: item.name_category || "Lainnya",
          image: item.image,
          local_image: item.local_image,
          status: item.synced ? "Tersinkron" : "Belum Tersinkron",
        }))
      );
    } catch (err) {
      console.error("❌ Gagal ambil data:", err);
    }
  };

  // Auto-sync server
  const autoSync = async () => {
    try {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        try { await syncPricesToServer(); } catch {}
        await fetchData();
      }
    } catch (err) {
      console.error("❌ Gagal auto sync:", err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
      fetchData();
      const unsubscribe = NetInfo.addEventListener(() => autoSync());
      return () => unsubscribe();
    }, [])
  );

  // Format tanggal
  const formatTanggalHeader = () =>
    selectedDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  const formatTanggalItem = (tgl) => {
    if (!tgl) return "-";
    const dateObj = new Date(tgl);
    if (isNaN(dateObj.getTime())) return "-";
    return `${dateObj.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}, ${dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
  };

  // Seleksi item
  const toggleSelectItem = (id) => {
    const updated = selectedItems.includes(id)
      ? selectedItems.filter((itemId) => itemId !== id)
      : [...selectedItems, id];
    setSelectedItems(updated);
    setIsSelectionMode(updated.length > 0);
  };

  const handleSelectAll = () => {
    if (selectedItems.length === dataKomoditas.length) {
      setSelectedItems([]);
      setIsSelectionMode(false);
    } else {
      setSelectedItems(dataKomoditas.map((item) => item.id));
      setIsSelectionMode(true);
    }
    setMenuVisible(false);
  };

  const handleDelete = () => {
    if (selectedItems.length === 0) return;
    Alert.alert("Konfirmasi", "Hapus data terpilih?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            for (const id of selectedItems) {
              const itemData = dataKomoditas.find((i) => i.id === id);
              if (itemData) await deleteLocalPrice(id, itemData);
            }
            setDataKomoditas((prev) => prev.filter((i) => !selectedItems.includes(i.id)));
            setSelectedItems([]);
            setIsSelectionMode(false);
            Alert.alert("✅ Sukses", "Data berhasil dihapus.");
          } catch (error) {
            console.error("❌ Gagal hapus data:", error);
          }
        },
      },
    ]);
  };

  // Filter data
  const filteredData = dataKomoditas.filter((item) => {
    const itemDate = new Date(item.tanggal).toISOString().split("T")[0];
    const selectedDateString = selectedDate.toISOString().split("T")[0];
    const matchDate = itemDate === selectedDateString;
    const matchSearch = item.nama?.toLowerCase().includes(search.toLowerCase().trim());
    const matchCategory = selectedTab === "Semua" || item.kategori === selectedTab;
    return matchDate && matchSearch && matchCategory;
  });

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={["#174A6A", "#0B3B53"]} style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Data Komoditas Lokal</Text>
          <TouchableOpacity onPress={() => setMenuVisible(true)}>
            <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="calendar"
            onChange={(e, newDate) => {
              setShowDatePicker(false);
              if (newDate) setSelectedDate(newDate);
            }}
          />
        )}

        {/* Menu */}
        <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPressOut={() => setMenuVisible(false)}>
            <View style={styles.menuContainer}>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate("Riwayat"); }}>
                <Ionicons name="time-outline" size={18} color="#fff" />
                <Text style={styles.menuText}>Lihat Riwayat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleSelectAll}>
                <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                <Text style={styles.menuText}>
                  {selectedItems.length === dataKomoditas.length ? "Batal Pilih Semua" : "Pilih Semua"}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#6B7280" />
          <TextInput placeholder="Cari komoditas..." value={search} onChangeText={setSearch} placeholderTextColor="#9CA3AF" style={styles.searchInput} />
        </View>

        {/* Filter Row */}
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterBox} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={16} color="#174A6A" />
            <Text style={styles.filterText}>{formatTanggalHeader()}</Text>
          </TouchableOpacity>
          <View style={styles.filterBox}>
            <Ionicons name="cube-outline" size={16} color="#174A6A" />
            <Text style={styles.filterText}>Total: {filteredData.length}</Text>
          </View>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tabRow}>
            {kategori.map((item, index) => (
              <TouchableOpacity key={`${item}-${index}`} style={[styles.tabItem, selectedTab === item && styles.tabActive]} onPress={() => setSelectedTab(item)}>
                <Text style={[styles.tabText, selectedTab === item && styles.tabTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </LinearGradient>

      {/* List */}
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
        {filteredData.length > 0 ? filteredData.map((item) => {
          const selected = selectedItems.includes(item.id);
          return (
            <TouchableOpacity key={item.id} style={styles.card} onPress={() => isSelectionMode && toggleSelectItem(item.id)} onLongPress={() => { setIsSelectionMode(true); toggleSelectItem(item.id); }}>
              {!isSelectionMode && (
                <TouchableOpacity style={styles.editIcon} onPress={() => navigation.navigate("EditData", { item })}>
                  <Ionicons name="create-outline" size={14} color="#174A6A" />
                </TouchableOpacity>
              )}
              <Image
                source={item.image ? { uri: item.image } : item.local_image ? { uri: item.local_image } : placeholderImg}
                style={{ width: 64, height: 64, borderRadius: 10, marginEnd: 8 }}
                resizeMode="cover"
              />
              <View style={styles.leftSection}>
                <Text style={styles.itemName}>{item.nama}</Text>
                <Text style={styles.itemPrice}>{item.harga} / {item.satuan}</Text>
                <Text style={styles.itemDate}>{formatTanggalItem(item.tanggal)}</Text>
              </View>
              <View style={styles.rightSection}>
                <Text style={styles.itemCategory}>{item.kategori}</Text>
                <Text style={[styles.statusText, { color: item.status === "Tersinkron" ? "#16A34A" : "#DC2626" }]}>{item.status}</Text>
              </View>
              {selected && <Ionicons name="checkmark-circle" size={22} color="#16A34A" style={{ alignSelf: "center", marginLeft: 8 }} />}
            </TouchableOpacity>
          );
        }) : <Text style={styles.emptyText}>Tidak ada data ditemukan</Text>}
      </ScrollView>

      {/* Delete Button */}
      {selectedItems.length > 0 && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={styles.deleteText}>Hapus</Text>
        </TouchableOpacity>
      )}

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate("Dashboard")}>
          <Ionicons name="home-outline" size={24} color="#6B7280" />
          <Text style={styles.navText}>Beranda</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="folder" size={24} color="#174A6A" />
          <Text style={[styles.navText, styles.navTextActive]}>Data Lokal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate("Profile")}>
          <Ionicons name="person-outline" size={24} color="#6B7280" />
          <Text style={styles.navText}>Profil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.2)", alignItems: "flex-end" },
  menuContainer: { backgroundColor: "#174A6A", borderRadius: 10, marginTop: 70, marginRight: 15, paddingVertical: 6, width: 170 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.2)" },
  menuText: { color: "#fff", fontSize: 14, fontWeight: "600" },
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
  editIcon: { position: "absolute", top: 6, right: 6, zIndex: 10, backgroundColor: "#E0F2FE", borderRadius: 6, padding: 3 },
  leftSection: { flex: 1, justifyContent: "center" },
  rightSection: { minWidth: 110, alignItems: "flex-end", justifyContent: "center" },
  itemName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  itemPrice: { fontSize: 14, color: "#174A6A", fontWeight: "700", marginTop: 2 },
  itemDate: { fontSize: 11, color: "#6B7280", marginTop: 4 },
  itemCategory: { fontSize: 13, color: "#174A6A", fontWeight: "700", marginBottom: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  emptyText: { textAlign: "center", marginTop: 40, color: "#6B7280" },
  deleteButton: { position: "absolute", bottom: 90, right: 20, backgroundColor: "#DC2626", flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 30 },
  deleteText: { color: "#fff", marginLeft: 6, fontWeight: "700" },
  bottomNav: { flexDirection: "row", justifyContent: "space-around", backgroundColor: "#fff", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  navItem: { alignItems: "center" },
  navText: { color: "#6B7280", fontSize: 12 },
  navTextActive: { color: "#174A6A", fontWeight: "700" },
});
