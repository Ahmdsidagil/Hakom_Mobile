// ===============================
// 📱 InputScreen.js (FINAL FIXED + SERVER IMAGE SAFE)
// ===============================
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";

// FIX: Import notifikasi harus benar
import { pushNotification } from "./NotificationScreen";

// FIX: DATABASE path harus benar (InputScreen di src/screens -> config ada di root/config)
import {
  getCategories,
  getCommoditiesByCategory,
  addPrice,
  getDatabase,
} from "../../config/database";


export default function InputScreen({ navigation, route }) {
  const [categories, setCategories] = useState([]);
  const [commodities, setCommodities] = useState([]);

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedCommodity, setSelectedCommodity] = useState(null);

  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarAnim] = useState(new Animated.Value(0));

  const scrollRef = useRef();

  // ===============================
  // LOAD DATA
  // ===============================
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const cats = await getCategories();
      setCategories(cats || []);

      const all = [];
      if (cats && cats.length) {
        for (const cat of cats) {
          const res = await getCommoditiesByCategory(cat.id_category);
          if (res && res.length) all.push(...res);
        }
      }
      setCommodities(all);
    } catch (err) {
      console.log("Load error:", err);
    }
  };

  // ===============================
  // SNACKBAR
  // ===============================
  const showSnackbar = (msg) => {
    setSnackbarMessage(msg);
    Animated.timing(snackbarAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(snackbarAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => setSnackbarMessage(""));
      }, 1500);
    });
  };

  // ===============================
  // TOGGLE CATEGORY
  // ===============================
  const toggleCategory = (cat) => {
    const exists = selectedCategories.some(
      (c) => c.id_category === cat.id_category
    );

    let updated;
    if (exists)
      updated = selectedCategories.filter(
        (c) => c.id_category !== cat.id_category
      );
    else updated = [...selectedCategories, cat];

    setSelectedCategories(updated);

    if (
      selectedCommodity &&
      !updated.some((c) => c.id_category === selectedCommodity.category_id)
    ) {
      setSelectedCommodity(null);
      setUnit("");
    }
  };

  // ===============================
  // SELECT COMMODITY + UNIT
  // ===============================
  const handleSelectCommodity = async (item) => {
    setSelectedCommodity(item);

    if (item.unit || item.name_unit) {
      setUnit(item.unit || item.name_unit);
    } else if (item.unit_id) {
      try {
        const db = await getDatabase();
        const unitRow = await db.getFirstAsync(
          `SELECT name_unit FROM units WHERE id = ?`,
          [item.unit_id]
        );
        setUnit(unitRow?.name_unit || "");
      } catch (e) {
        console.warn("⚠ fetch unit failed:", e);
        setUnit("");
      }
    } else {
      setUnit("");
    }
  };

  // ===============================
  // FORMAT RUPIAH
  // ===============================
  const formatRupiah = (value) => {
    if (!value) return "";
    let numberString = value.replace(/[^,\d]/g, "");
    const split = numberString.split(",");
    let sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa);
    const ribuan = split[0].substr(sisa).match(/\d{3}/g);

    if (ribuan) {
      const separator = sisa ? "." : "";
      rupiah += separator + ribuan.join(".");
    }
    return rupiah;
  };

  const sanitizePriceToNumber = (raw) => {
    if (!raw) return 0;
    const cleaned = raw.replace(/Rp/gi, "").replace(/[^0-9]/g, "");
    const num = parseInt(cleaned);
    return isNaN(num) ? null : num;
  };
// ===============================
// SUBMIT (FUNGSI DIPERBAIKI: STANDBY PILIHAN)
// ===============================
const handleSubmit = async () => {
    // --- 1. VALIDASI ---
    if (selectedCategories.length === 0 || !selectedCommodity || !price) {
        Alert.alert("Peringatan", "Semua field wajib diisi!");
        return;
    }

    const priceNum = sanitizePriceToNumber(price);
    if (priceNum === null) {
        Alert.alert("Peringatan", "Harga tidak valid.");
        return;
    }

    setLoading(true);
    try {
        // --- 2. VALIDASI KATEGORI/KOMODITAS ---
        const related = selectedCategories.filter(
            (c) => c.id_category === selectedCommodity.category_id
        );

        if (related.length === 0) {
            Alert.alert(
                "Peringatan",
                "Komoditas tidak sesuai dengan kategori yang dipilih."
            );
            setLoading(false);
            return;
        }

        // --- 3. PROSES SIMPAN DATA ---
        const newPriceId = await addPrice(
            selectedCommodity.id_commodity,
            selectedCommodity.category_id,
            priceNum
        );

        // --- 4. NOTIFIKASI SUKSES ---
        const net = await NetInfo.fetch();
        const msg = net.isConnected
            ? "✅ Berhasil disimpan & tersinkron"
            : "📦 Disimpan offline, menunggu sinkron";

        showSnackbar(msg);
        
        await pushNotification({
            type: "success",
            title: "Pendataan Berhasil",
            message: `${selectedCommodity.name || selectedCommodity.name_commodity} telah ditambahkan`,
        });

        if (route?.params?.onAddPrice) {
            route.params.onAddPrice({
                id_price: newPriceId,
                commodity_id: selectedCommodity.id_commodity,
                name_commodity: selectedCommodity.name || selectedCommodity.name_commodity,
                price: priceNum,
                name_unit: unit || "-",
                created_at: new Date().toISOString(),
                name_category: selectedCommodity.category_name || "-",
                image: selectedCommodity.image || null,
                synced: net.isConnected,
            });
        }

        // --- 5. RESET HANYA HARGA & STANDBY PILIHAN ---
        setPrice(""); // HANYA HAPUS HARGA

        // Pilihan berikut dipertahankan (Standby):
        // selectedCommodity, selectedCategories, dan unit

        // Opsional: Scroll ke bagian input harga (jika layar panjang)
        // Jika Anda ingin memastikan input harga terlihat setelah simpan
        // (Anda perlu memastikan 'scrollRef' menargetkan area yang tepat atau menghapusnya jika tidak perlu)

        // navigation.goBack(); // <-- TETAP DIHAPUS

    } catch (err) {
        console.error(err);
        showSnackbar("❌ Terjadi kesalahan");
        await pushNotification({
            type: "error",
            title: "Pendataan Gagal",
            message: `Gagal menambahkan ${selectedCommodity?.name || ""}`,
        });
    } finally {
        setLoading(false);
    }
};

  // ===============================
  // FILTER
  // ===============================
  const filteredCommodities = commodities.filter((c) =>
    selectedCategories.some((cat) => cat.id_category === c.category_id)
  );

  // ===============================
  // IMAGE LOADER SUPER AMAN
  // ===============================
  // For your server:
  // - Category API returns full URL in `image` (asset('images/...')) -> use directly
  // - Commodity API may return path/filename -> prepend IMAGE_BASE
  const SERVER_BASE = "http://103.100.27.57:5000"; // server host
  const IMAGE_BASE = SERVER_BASE + "/"; // base for joining commodity paths

  const safeImage = (primary, localImg, fallback = null) => {
    try {
      // If primary already full URL (categories) -> use it
      if (primary && (primary.startsWith("http://") || primary.startsWith("https://"))) {
        return { uri: primary };
      }
      // If primary is a path/filename (komoditas) -> join with IMAGE_BASE
      if (primary && typeof primary === "string") {
        const cleaned = primary.startsWith("/") ? primary.substring(1) : primary;
        return { uri: IMAGE_BASE + cleaned };
      }
      // Fallback to local_image (offline)
      if (localImg) return { uri: localImg };
      return fallback;
    } catch (e) {
      return fallback;
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 6 }}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tambah Data Harga</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.page}>
        {/* ============ KATEGORI ============ */}
        <Text style={styles.title}>Pilih Kategori</Text>

        <View style={styles.grid}>
          {categories.map((cat) => {
            const selected = selectedCategories.some(
              (c) => c.id_category === cat.id_category
            );

            // For categories, server returns full URL in cat.image (asset('images/...')), local_image as fallback
            const imgSource = safeImage(cat.image, cat.local_image, null);

            return (
              <TouchableOpacity
                key={cat.id_category}
                style={[
                  styles.gridBoxSmall,
                  selected && styles.activeGridBox,
                ]}
                onPress={() => toggleCategory(cat)}
              >
                {imgSource ? (
                  <Image
                    source={imgSource}
                    style={{ width: 45, height: 45, borderRadius: 8 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons
                    name="grid-outline"
                    size={32}
                    color={selected ? "#fff" : "#174A6A"}
                  />
                )}

                <Text
                  style={[
                    styles.boxLabel,
                    { color: selected ? "#fff" : "#174A6A" },
                  ]}
                  numberOfLines={2}
                >
                  {cat.name_category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ============ KOMODITAS ============ */}
        {selectedCategories.length > 0 && (
          <>
            <Text style={[styles.title, { marginTop: 15 }]}>
              Pilih Komoditas
            </Text>

            <View style={styles.grid}>
              {filteredCommodities.map((item) => {
                const active =
                  selectedCommodity?.id_commodity === item.id_commodity;

                // For commodities: item.image might be filename/path -> safeImage will prepend IMAGE_BASE
              const imgSource = safeImage(item.image, item.local_image, null);

                return (
                  <TouchableOpacity
                    key={item.id_commodity}
                    style={[
                      styles.gridBoxSmall,
                      active && styles.activeGridBox,
                    ]}
                    onPress={() => handleSelectCommodity(item)}
                  >
                    {imgSource ? (
                      <Image
                        source={imgSource}
                        style={{
                          width: 62,
                          height: 56,
                          borderRadius: 10,
                          marginTop: 6,
                        }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons
                        name="image-outline"
                        size={32}
                        color={active ? "#fff" : "#174A6A"}
                      />
                    )}

                    <Text
                      style={[
                        styles.boxLabel,
                        {
                          color: active ? "#fff" : "#174A6A",
                          fontSize: 10,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {item.name || item.name_commodity}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* ============ INPUT HARGA ============ */}
        {selectedCommodity && (
          <View style={{ marginTop: 25 }}>
            <Text style={styles.title}>Harga & Satuan</Text>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.label}>Harga</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Rp."
                  keyboardType="numeric"
                  value={price}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, "");
                    setPrice(formatRupiah(cleaned));
                  }}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Satuan</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: "#f3f3f3" }]}
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
              <Text style={styles.buttonText}>
                {loading ? "Menyimpan..." : "Simpan"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* SNACKBAR */}
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
                    outputRange: [40, 0],
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

// ======================
// STYLES
// ======================
const styles = StyleSheet.create({
  header: {
    backgroundColor: "#174A6A",
    paddingVertical: 24,
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 10,
  },
  page: { padding: 20, paddingBottom: 80 },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    color: "#174A6A",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridBoxSmall: {
    width: "23%",
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: "#174A6A",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    backgroundColor: "#fff",
    padding: 6,
  },
  activeGridBox: { backgroundColor: "#174A6A" },
  boxLabel: {
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
    fontWeight: "600",
  },
  row: { flexDirection: "row" },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#174A6A",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
  },
  button: {
    marginTop: 20,
    backgroundColor: "#174A6A",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  snackbar: {
    position: "absolute",
    bottom: 25,
    left: 20,
    right: 20,
    backgroundColor: "#16A34A",
    padding: 12,
    borderRadius: 10,
  },
  snackbarText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
  },
});
