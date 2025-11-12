// ✅ src/screens/DataLocalScreen.js (versi final & konsisten dengan input)
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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import {
  getAllLocalPrices,
  deleteLocalPrice,
  addRiwayatHapus,
  getDatabase,
} from "../../config/database";

export default function DataLocalScreen({ navigation }) {
  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState("Semua");
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [dataKomoditas, setDataKomoditas] = useState([]);
  const [kategori, setKategori] = useState(["Semua"]);

  // ======================================================
  // 🔹 Ambil kategori dari database
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

  // 🔹 Ambil data lokal
  const fetchData = async () => {
    try {
      const data = await getAllLocalPrices();
      if (data?.length) {
        setDataKomoditas(
          data.map((item) => ({
            id: item.id,
            nama: item.name_commodity,
            harga: `Rp ${parseInt(item.price).toLocaleString("id-ID")}`,
            satuan: item.unit || "-",
            tanggal: item.tanggal || null,
            kategori: item.name_category || "Lainnya",
            gambar:
              "https://cdn-icons-png.flaticon.com/512/415/415682.png",
          }))
        );
      } else {
        setDataKomoditas([]);
      }
    } catch (err) {
      console.error("❌ Gagal ambil data lokal:", err);
    }
  };

  // ======================================================
  // 🔁 Load data setiap kali screen aktif
  useFocusEffect(
    useCallback(() => {
      fetchCategories();
      fetchData();
    }, [])
  );

  // 🔹 Format tanggal header
  const formatTanggalHeader = () => {
    const now = new Date();
    return now.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // 🔹 Format tanggal item
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

  // ======================================================
  // 🔹 Pilih semua / batal
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

  // 🔹 Hapus data lokal + simpan ke riwayat hapus
  const handleDelete = () => {
    Alert.alert("Konfirmasi", "Hapus data terpilih?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            const deleted = dataKomoditas.filter((i) =>
              selectedItems.includes(i.id)
            );
            for (const item of deleted) {
              await addRiwayatHapus({
                name_commodity: item.nama,
                price: item.harga.replace(/\D/g, ""),
                unit: item.satuan,
                name_category: item.kategori,
                tanggal: item.tanggal,
              });
              await deleteLocalPrice(item.id);
            }

            setDataKomoditas((prev) =>
              prev.filter((i) => !selectedItems.includes(i.id))
            );
            setSelectedItems([]);
            setIsSelectionMode(false);
            Alert.alert("✅ Sukses", "Data berhasil dihapus & disimpan ke riwayat.");
          } catch (error) {
            console.error("❌ Gagal hapus data:", error);
            Alert.alert("❌ Gagal", "Terjadi kesalahan saat menghapus data.");
          }
        },
      },
    ]);
  };

  // 🔹 Toggle pilih item
  const toggleSelectItem = (id) => {
    const updated = selectedItems.includes(id)
      ? selectedItems.filter((itemId) => itemId !== id)
      : [...selectedItems, id];
    setSelectedItems(updated);
    if (updated.length === 0) setIsSelectionMode(false);
  };

  // 🔹 Filter data
  const filteredData = dataKomoditas.filter((item) => {
    const matchSearch = item.nama
      ?.toLowerCase()
      .includes(search.toLowerCase().trim());
    const matchCategory =
      selectedTab === "Semua" || item.kategori === selectedTab;
    return matchSearch && matchCategory;
  });

  // ======================================================
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

        {/* Popup menu */}
        <Modal
          transparent
          visible={menuVisible}
          animationType="fade"
          onRequestClose={() => setMenuVisible(false)}
        >
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPressOut={() => setMenuVisible(false)}
          >
            <View style={styles.menuContainer}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  navigation.navigate("Riwayat");
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color="#fff"
                  style={styles.menuIcon}
                />
                <Text style={styles.menuText}>Lihat Riwayat</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleSelectAll}>
                <Ionicons
                  name="checkmark-done-outline"
                  size={18}
                  color="#fff"
                  style={styles.menuIcon}
                />
                <Text style={styles.menuText}>
                  {selectedItems.length === dataKomoditas.length
                    ? "Batal Pilih Semua"
                    : "Pilih Semua"}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

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

        {/* Filter Info */}
        <View style={styles.filterRow}>
          <View style={styles.filterBox}>
            <Ionicons name="calendar-outline" size={16} color="#174A6A" />
            <Text style={styles.filterText}>{formatTanggalHeader()}</Text>
          </View>

          <View style={styles.filterBox}>
            <Ionicons name="cube-outline" size={16} color="#174A6A" />
            <Text style={styles.filterText}>Total: {filteredData.length}</Text>
          </View>
        </View>

        {/* Tab kategori dinamis */}
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

      {/* LIST DATA */}
      <ScrollView
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
      >
        {filteredData.length > 0 ? (
          filteredData.map((item) => {
            const selected = selectedItems.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => {
                  if (isSelectionMode) toggleSelectItem(item.id);
                }}
                onLongPress={() => {
                  setIsSelectionMode(true);
                  toggleSelectItem(item.id);
                }}
                delayLongPress={300}
              >
                {!isSelectionMode && (
                  <TouchableOpacity
                    style={styles.editIcon}
                    onPress={() => navigation.navigate("EditData", { item })}
                  >
                    <Ionicons name="create-outline" size={18} color="#174A6A" />
                  </TouchableOpacity>
                )}

                <Image source={{ uri: item.gambar }} style={styles.image} />
                <View style={styles.cardContent}>
                  <Text style={styles.itemName}>{item.nama}</Text>
                  <Text style={styles.itemPrice}>
                    {item.harga} / {item.satuan}
                  </Text>
                  <Text style={styles.itemDate}>
                    {formatTanggalItem(item.tanggal)}
                  </Text>
                  <Text style={styles.itemCategory}>{item.kategori}</Text>
                </View>

                {selected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color="#16A34A"
                    style={{ alignSelf: "center" }}
                  />
                )}
              </TouchableOpacity>
            );
          })
        ) : (
          <Text
            style={{
              textAlign: "center",
              color: "#6B7280",
              marginTop: 40,
            }}
          >
            Tidak ada data ditemukan
          </Text>
        )}
      </ScrollView>

      {/* Tombol Hapus */}
      {selectedItems.length > 0 && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={styles.deleteText}>Hapus</Text>
        </TouchableOpacity>
      )}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Dashboard")}
        >
          <Ionicons name="home-outline" size={24} color="#6B7280" />
          <Text style={styles.navText}>Beranda</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="folder" size={24} color="#174A6A" />
          <Text style={[styles.navText, styles.navTextActive]}>Data Lokal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Profile")}
        >
          <Ionicons name="person-outline" size={24} color="#6B7280" />
          <Text style={styles.navText}>Profil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ======================================================
// 🎨 STYLES
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
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "flex-end",
  },
  menuContainer: {
    backgroundColor: "#174A6A",
    borderRadius: 10,
    marginTop: 70,
    marginRight: 15,
    paddingVertical: 6,
    width: 170,
    elevation: 6,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.2)",
  },
  menuIcon: { marginRight: 8 },
  menuText: { fontSize: 14, color: "#fff", fontWeight: "600" },
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
    borderRadius: 10,
    marginBottom: 12,
    padding: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    alignItems: "center",
  },
  editIcon: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: "#E0F2FE",
    borderRadius: 8,
    padding: 4,
  },
  image: { width: 60, height: 60, borderRadius: 8, marginRight: 10 },
  cardContent: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  itemPrice: { fontSize: 14, color: "#174A6A", fontWeight: "600" },
  itemDate: { fontSize: 12, color: "#6B7280" },
  itemCategory: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
    fontStyle: "italic",
  },
  deleteButton: {
    position: "absolute",
    bottom: 150,
    right: 20,
    backgroundColor: "#EF4444",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  deleteText: { color: "#fff", fontWeight: "700", marginLeft: 6 },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderTopColor: "#E5E7EB",
    borderTopWidth: 1,
  },
  navItem: { alignItems: "center" },
  navText: { fontSize: 12, color: "#6B7280", marginTop: 3 },
  navTextActive: { color: "#174A6A", fontWeight: "bold" },
});
