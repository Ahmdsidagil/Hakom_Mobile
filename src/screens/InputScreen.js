// ===============================
// 📱 InputScreen.js (STYLE ASLI + HEADER GRADASI + SMART NOTIF)
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
  Image,
  Modal,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ✅ 1. Import Tambahan (Gradasi & NetInfo)
import { LinearGradient } from "expo-linear-gradient";
import NetInfo from "@react-native-community/netinfo";

import {
  getCategories,
  getCommoditiesByCategory,
  getDatabase,
  addPrice,
} from "../../config/database";

// 🔔 Import Notifikasi
import { pushNotification } from "../../src/screens/NotificationScreen";

export default function InputScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [units, setUnits] = useState([]);

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedCommodity, setSelectedCommodity] = useState(null);

  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  // State untuk Popup Modern
  const [popup, setPopup] = useState({ visible: false, type: "success", message: "" });
  const popupAnim = useRef(new Animated.Value(0)).current;

  const scrollRef = useRef(null);
  const priceRef = useRef(null);

  // ===============================
  // UTIL WAKTU LOKAL
  // ===============================
  const getLocalDateTime = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const local = new Date(now - offset);
    return {
      tanggal: local.toISOString().split("T")[0],
      waktu: local.toISOString().split("T")[1].slice(0, 8),
      created_at: local.toISOString(),
    };
  };

  // ===============================
  // POPUP LOGIC
  // ===============================
  const showPopup = (type, message) => {
    setPopup({ visible: true, type, message });
    Animated.spring(popupAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();

    setTimeout(() => {
      Animated.timing(popupAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setPopup({ ...popup, visible: false }));
    }, 1000);
  };

  // ===============================
  // LOAD DATA
  // ===============================
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const catsStr = await AsyncStorage.getItem("categories");
      const cats = catsStr ? JSON.parse(catsStr) : await getCategories();
      setCategories(Array.isArray(cats) ? cats : []);

      const commStr = await AsyncStorage.getItem("commodities");
      let all = [];

      if (commStr) {
        const parsed = JSON.parse(commStr);
        all = Array.isArray(parsed) ? parsed : parsed?.data || [];
      } else {
        for (const c of cats) {
          const res = await getCommoditiesByCategory(c.id_category);
          if (Array.isArray(res)) all.push(...res);
        }
      }

      all = all.map((c) => ({
        ...c,
        category_id: Number(c.category_id ?? c.id_category ?? c.category?.id_category) || null,
      }));

      setCommodities(all);

      const unitsStr = await AsyncStorage.getItem("units");
      setUnits(unitsStr ? JSON.parse(unitsStr) : []);
    } catch (e) {
      console.log("Load error:", e);
    }
  };

  // ===============================
  // FORMAT RUPIAH
  // ===============================
  const formatRupiah = (value) => {
    if (!value) return "";
    const clean = value.replace(/\D/g, "");
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const rupiahToNumber = (val) => Number(val.replace(/\./g, "")) || 0;

  // ===============================
  // INTERAKSI GRID
  // ===============================
  const toggleCategory = (cat) => {
    const exists = selectedCategories.some((c) => c.id_category === cat.id_category);
    const updated = exists
      ? selectedCategories.filter((c) => c.id_category !== cat.id_category)
      : [...selectedCategories, cat];

    setSelectedCategories(updated);
    if (selectedCommodity && !updated.some((c) => c.id_category === selectedCommodity.category_id)) {
      setSelectedCommodity(null);
      setUnit("");
      setPrice("");
    }
  };

  const handleSelectCommodity = async (item) => {
    setSelectedCommodity(item);
    setPrice("");

    if (item.unit || item.name_unit) {
      setUnit(item.unit || item.name_unit);
    } else if (item.unit_id) {
      const local = units.find((u) => Number(u.id) === Number(item.unit_id));
      if (local) {
        setUnit(local.name_unit);
      } else {
        const db = await getDatabase();
        const row = await db.getFirstAsync("SELECT name_unit FROM units WHERE id = ?", [item.unit_id]);
        setUnit(row?.name_unit || "");
      }
    } else {
      setUnit("");
    }

    setTimeout(() => {
      priceRef.current?.measureLayout(scrollRef.current, (_, y) => {
        scrollRef.current.scrollTo({ y: y - 20, animated: true });
      });
    }, 300);
  };

  // ===============================
  // 🔥 HANDLE SUBMIT (Dengan Smart Notif)
  // ===============================
  const handleSubmit = async () => {
    if (!selectedCommodity || !price) return;

    setLoading(true);
    try {
      const priceNumeric = rupiahToNumber(price);
      const namaKomoditas = selectedCommodity.name || selectedCommodity.name_commodity;

      // 1. Simpan ke Database Lokal (SQLite)
      await addPrice(
        selectedCommodity.id_commodity,
        selectedCommodity.category_id,
        priceNumeric
      );

      // 2. Simpan ke Log Dashboard (AsyncStorage)
      const waktu = getLocalDateTime();
      const catAktif = categories.find((c) => Number(c.id_category) === Number(selectedCommodity.category_id));
      
      const aktivitasBaru = {
        id_temp: Date.now().toString(),
        source: "LOCAL_INPUT",
        name_commodity: namaKomoditas,
        name_category: catAktif?.name_category || "Lainnya",
        price: priceNumeric,
        unit,
        tanggal: waktu.tanggal,
        waktu: waktu.waktu,
        created_at: waktu.created_at,
        local_image: selectedCommodity.image,
      };

      const logLama = await AsyncStorage.getItem("dashboard_log");
      const logs = logLama ? JSON.parse(logLama) : [];
      await AsyncStorage.setItem("dashboard_log", JSON.stringify([aktivitasBaru, ...logs].slice(0, 20)));

      // ✅ 3. LOGIKA NOTIFIKASI PINTAR (Check Internet)
      const networkState = await NetInfo.fetch();
      
      if (networkState.isConnected) {
        // ONLINE: Kirim Notif Sukses (Hijau)
        await pushNotification({
          type: "success",
          title: "Input Berhasil",
          message: `${namaKomoditas} berhasil diupload ke server.`,
          data: { name_commodity: namaKomoditas, price: priceNumeric }
        });
      } else {
        // OFFLINE: Kirim Notif Offline (Orange)
        await pushNotification({
          type: "offline",
          title: "Disimpan Offline",
          message: `Internet mati. ${namaKomoditas} disimpan di local.`,
          data: { name_commodity: namaKomoditas, price: priceNumeric }
        });
      }

      // 4. Tampilkan Popup
      showPopup("success", `${namaKomoditas} tersimpan`);
      setPrice("");
      
    } catch (e) {
      console.error(e);
      showPopup("error", "Gagal menyimpan data");
      await pushNotification({
        type: "error",
        title: "Gagal Menyimpan",
        message: "Terjadi kesalahan sistem saat menyimpan harga.",
      });
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // RENDER UI
  // ===============================
  const filteredCommodities = commodities.filter((c) =>
    selectedCategories.some((cat) => c.category_id === cat.id_category)
  );

  const SERVER = "http://103.100.27.57:5000/";
  const safeImage = (img) =>
    img ? { uri: img.startsWith("http") ? img : SERVER + img } : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ✅ HEADER GRADASI (Tanpa mengubah layout lain) */}
      <LinearGradient
        colors={["#174A6A", "#0F172A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tambah Data Harga</Text>
      </LinearGradient>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.page}>
        {/* KATEGORI */}
        <Text style={styles.title}>Pilih Kategori</Text>
        <View style={styles.grid}>
          {categories.map((cat) => {
            const active = selectedCategories.some((c) => c.id_category === cat.id_category);
            return (
              <TouchableOpacity
                key={cat.id_category}
                style={[styles.gridBoxSmall, active && styles.activeGridBox]}
                onPress={() => toggleCategory(cat)}
              >
                {safeImage(cat.image) && (
                  <Image source={safeImage(cat.image)} style={{ width: 40, height: 40 }} />
                )}
                <Text style={[styles.boxLabel, { color: active ? "#fff" : "#174A6A" }]}>
                  {cat.name_category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* KOMODITAS */}
        {filteredCommodities.length > 0 && (
          <>
            <Text style={[styles.title, { marginTop: 15 }]}>Pilih Komoditas</Text>
            <View style={styles.grid}>
              {filteredCommodities.map((item) => {
                const active = selectedCommodity?.id_commodity === item.id_commodity;
                return (
                  <TouchableOpacity
                    key={item.id_commodity}
                    style={[styles.gridBoxSmall, active && styles.activeGridBox]}
                    onPress={() => handleSelectCommodity(item)}
                  >
                    {safeImage(item.image) && (
                      <Image source={safeImage(item.image)} style={{ width: 50, height: 40, borderRadius: 4 }} />
                    )}
                    <Text style={[styles.boxLabel, { color: active ? "#fff" : "#174A6A" }]}>
                      {item.name || item.name_commodity}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* INPUT FORM */}
        {selectedCommodity && (
          <View ref={priceRef} style={{ marginTop: 25 }}>
            <Text style={styles.title}>Harga & Satuan</Text>

            <View style={{ flexDirection: "row" }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.label}>Harga</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="Rp."
                  value={price}
                  onChangeText={(t) => setPrice(formatRupiah(t))}
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
              style={[styles.button, (!price || loading) && { opacity: 0.6 }]}
              disabled={!price || loading}
              onPress={handleSubmit}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {loading ? "Menyimpan..." : "Simpan"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* POPUP */}
      <Modal transparent visible={popup.visible} animationType="fade">
        <View style={styles.popupOverlay}>
          <Animated.View style={[styles.popupBox, { transform: [{ scale: popupAnim }] }]}>
            <Ionicons
              name={popup.type === "success" ? "checkmark-circle" : "close-circle"}
              size={46}
              color={popup.type === "success" ? "#2ecc71" : "#e74c3c"}
            />
            <Text style={styles.popupText}>{popup.message}</Text>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// STYLE ASLI ANDA (Hanya header disesuaikan agar transparan untuk gradasi)
const styles = StyleSheet.create({
  header: {
    // backgroundColor dihapus agar gradasi terlihat
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 10,
  },
  page: { padding: 20, paddingBottom: 100 },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#174A6A",
    marginBottom: 10,
  },
  label: { fontWeight: "600", marginBottom: 4 },
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
    padding: 6,
    backgroundColor: "#fff",
  },
  activeGridBox: { backgroundColor: "#174A6A" },
  boxLabel: { fontSize: 11, textAlign: "center", fontWeight: "600" },
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
  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupBox: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 18,
    alignItems: "center",
    width: "75%",
    elevation: 10,
  },
  popupText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
});