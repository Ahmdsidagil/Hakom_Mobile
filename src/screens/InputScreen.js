// src/screens/InputScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getDatabase, addPrice } from "../../config/database";

export default function InputScreen({ navigation, route }) {
  const [categories, setCategories] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [filteredCommodities, setFilteredCommodities] = useState([]);

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedCommodity, setSelectedCommodity] = useState(null);
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");

  const [modalKategoriVisible, setModalKategoriVisible] = useState(false);
  const [modalKomoditasVisible, setModalKomoditasVisible] = useState(false);
  const [searchKategori, setSearchKategori] = useState("");
  const [searchKomoditas, setSearchKomoditas] = useState("");

  const [loading, setLoading] = useState(false);

  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarAnim] = useState(new Animated.Value(0));

  // ================== INIT DATA ==================
  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    try {
      const db = await getDatabase();
      const categoriesResult = await db.getAllAsync("SELECT * FROM categories;");
      const commoditiesResult = await db.getAllAsync("SELECT * FROM commodities;");
      setCategories(categoriesResult);
      setCommodities(commoditiesResult);
    } catch (error) {
      console.log("initData error:", error);
    }
  };

  // ================== SNACKBAR ==================
  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    Animated.timing(snackbarAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(snackbarAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 1500);
    });
  };

  // ================== HANDLER ==================
  const handleToggleCategory = (category) => {
    let newSelection = [...selectedCategories];
    const index = selectedCategories.findIndex((c) => c.id === category.id);
    if (index > -1) {
      newSelection.splice(index, 1);
    } else {
      newSelection.push(category);
    }
    setSelectedCategories(newSelection);

    const filtered = commodities.filter((c) =>
      newSelection.some((cat) => cat.id === c.category_id)
    );
    setFilteredCommodities(filtered);

    if (selectedCommodity && !filtered.some((c) => c.id === selectedCommodity.id)) {
      setSelectedCommodity(null);
      setUnit("");
    }
  };

  const handleToggleSelectAllCategories = () => {
    if (selectedCategories.length === categories.length) {
      // Jika semua sudah dipilih → batal pilih semua
      setSelectedCategories([]);
      setFilteredCommodities([]);
      setSelectedCommodity(null);
      setUnit("");
    } else {
      // Pilih semua
      setSelectedCategories([...categories]);
      setFilteredCommodities([...commodities]);
    }
  };

  const handleSelectCommodity = (commodity) => {
    setSelectedCommodity(commodity);
    setUnit(commodity.unit);
  };

  const sanitizePriceToNumber = (raw) => {
    if (!raw && raw !== 0) return 0;
    const cleaned = String(raw)
      .replace(/Rp/gi, "")
      .replace(/[^0-9.,-]/g, "")
      .replace(/,/g, "")
      .replace(/\s+/g, "");
    const asNumber = parseFloat(cleaned);
    return isNaN(asNumber) ? null : asNumber;
  };

  // ================== SIMPAN DATA ==================
  const handleSubmit = async () => {
    if (selectedCategories.length === 0 || !selectedCommodity || !price) {
      Alert.alert("Peringatan", "Semua field wajib diisi!");
      return;
    }

    const priceNumber = sanitizePriceToNumber(price);
    if (priceNumber === null) {
      Alert.alert("Peringatan", "Masukkan harga yang valid (angka).");
      return;
    }

    setLoading(true);
    try {
      const tanggalInput = new Date().toISOString();

      const relevantCategories = selectedCategories.filter(
        (cat) => cat.id === selectedCommodity.category_id
      );

      if (relevantCategories.length === 0) {
        Alert.alert(
          "Peringatan",
          "Komoditas yang dipilih tidak sesuai kategori yang dipilih!"
        );
        setLoading(false);
        return;
      }

      for (const category of relevantCategories) {
        await addPrice(
          selectedCommodity.id,
          category.id,
          priceNumber,
          unit,
          tanggalInput
        );
      }

      // Snackbar notification
      showSnackbar("✅ Data harga berhasil disimpan");

      // Reset harga & komoditas tapi **kategori tetap dipilih**
      setPrice("");
      setSelectedCommodity(null);
      setUnit("");

      if (route?.params?.onAddPrice) {
        await route.params.onAddPrice();
      }
    } catch (error) {
      console.error("❌ Gagal menyimpan data:", error);
      showSnackbar("❌ Terjadi kesalahan saat menyimpan data");
    } finally {
      setLoading(false);
    }
  };

  // ================== FILTER ==================
  const filteredCategories = categories.filter((c) =>
    c.name_category.toLowerCase().includes(searchKategori.toLowerCase())
  );

  const filteredComs = filteredCommodities.filter((c) =>
    c.name_commodity.toLowerCase().includes(searchKomoditas.toLowerCase())
  );

  // ================== UI ==================
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tambah Data Harga</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Kategori */}
        <Text style={styles.label}>Kategori</Text>
        <TouchableOpacity
          style={styles.dropdownHeader}
          onPress={() => setModalKategoriVisible(true)}
        >
          <Text style={{ color: selectedCategories.length ? "#000" : "#9CA3AF", flex: 1 }}>
            {selectedCategories.length
              ? selectedCategories.map((c) => c.name_category).join(", ")
              : "Pilih kategori"}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#174A6A" />
        </TouchableOpacity>

        {/* Komoditas */}
        <Text style={styles.label}>Nama Komoditas</Text>
        <TouchableOpacity
          style={styles.dropdownHeader}
          onPress={() => {
            if (selectedCategories.length === 0) {
              Alert.alert("Peringatan", "Pilih minimal satu kategori terlebih dahulu!");
              return;
            }
            setModalKomoditasVisible(true);
          }}
        >
          <Text style={{ color: selectedCommodity ? "#000" : "#9CA3AF", flex: 1 }}>
            {selectedCommodity ? selectedCommodity.name_commodity : "Pilih komoditas"}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#174A6A" />
        </TouchableOpacity>

        {/* Harga & Satuan */}
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Harga</Text>
            <TextInput
              style={styles.input}
              placeholder="Rp."
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
              editable={!loading}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Satuan</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#f0f0f0" }]}
              value={unit}
              editable={false}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "Menyimpan..." : "Simpan"}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Pilih Kategori */}
      <Modal visible={modalKategoriVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Pilih Kategori</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Cari kategori..."
              value={searchKategori}
              onChangeText={setSearchKategori}
            />
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={handleToggleSelectAllCategories}
            >
              <Text style={styles.selectAllText}>
                {selectedCategories.length === categories.length ? "Batal Pilih Semua" : "Pilih Semua"}
              </Text>
            </TouchableOpacity>
            <ScrollView style={{ maxHeight: 300 }}>
              {filteredCategories.map((item) => {
                const isSelected = selectedCategories.some((c) => c.id === item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.optionItem, isSelected && { backgroundColor: "#E0F2FE" }]}
                    onPress={() => handleToggleCategory(item)}
                  >
                    <Text style={styles.optionText}>
                      {item.name_category} {isSelected ? "✅" : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity onPress={() => setModalKategoriVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Pilih Komoditas */}
      <Modal visible={modalKomoditasVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Pilih Komoditas</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Cari komoditas..."
              value={searchKomoditas}
              onChangeText={setSearchKomoditas}
            />
            <ScrollView style={{ maxHeight: 300 }}>
              {filteredComs.map((item) => {
                const categoryNames = selectedCategories
                  .filter((cat) => cat.id === item.category_id)
                  .map((cat) => cat.name_category)
                  .join(", ");

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.optionItem}
                    onPress={() => {
                      handleSelectCommodity(item);
                      setModalKomoditasVisible(false);
                    }}
                  >
                    <Text style={styles.optionText}>
                      {item.name_commodity} {categoryNames ? `(Kategori: ${categoryNames})` : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity onPress={() => setModalKomoditasVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Snackbar */}
      {snackbarMessage ? (
        <Animated.View
          style={[
            styles.snackbar,
            {
              opacity: snackbarAnim,
              transform: [
                {
                  translateY: snackbarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.snackbarText}>{snackbarMessage}</Text>
        </Animated.View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

// ================== STYLES ==================
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", backgroundColor: "#174A6A", paddingVertical: 12, paddingHorizontal: 12 },
  backButton: { padding: 8, marginTop: 24, marginRight: 12 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 24 },
  container: { padding: 22, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginTop: 10, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: "#174A6A", borderRadius: 10, padding: 10, backgroundColor: "#fff" },
  dropdownHeader: { borderWidth: 1, borderColor: "#174A6A", borderRadius: 10, padding: 10, backgroundColor: "#fff", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  button: { backgroundColor: "#174A6A", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 20 },
  buttonText: { color: "#fff", fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: "85%", backgroundColor: "#fff", borderRadius: 12, padding: 20, borderWidth: 1, borderColor: "#174A6A", maxHeight: "80%" },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#174A6A", marginBottom: 10 },
  searchInput: { borderWidth: 1, borderColor: "#174A6A", borderRadius: 8, padding: 8, marginBottom: 10 },
  optionItem: { paddingVertical: 10, borderBottomWidth: 1, borderColor: "#eee" },
  optionText: { color: "#333" },
  closeButton: { marginTop: 10, alignItems: "center" },
  closeText: { color: "#174A6A", fontWeight: "600" },
  selectAllButton: { paddingVertical: 10, backgroundColor: "#E0F2FE", borderRadius: 8, alignItems: "center", marginBottom: 8 },
  selectAllText: { fontWeight: "600", color: "#174A6A" },
  snackbar: { position: "absolute", bottom: 30, left: 20, right: 20, backgroundColor: "#16A34A", padding: 12, borderRadius: 10, alignItems: "center" },
  snackbarText: { color: "#fff", fontWeight: "600" },
});
