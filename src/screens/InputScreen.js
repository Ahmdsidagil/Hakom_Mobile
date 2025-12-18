// ===============================
// 📱 InputScreen.js (FULL FINAL — LOCAL DASHBOARD FIX)
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getCategories,
  getCommoditiesByCategory,
  getDatabase,
  addPrice,
} from "../../config/database";

export default function InputScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [units, setUnits] = useState([]);

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedCommodity, setSelectedCommodity] = useState(null);

  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef(null);
  const priceRef = useRef(null);

  // ===============================
  // UTIL WAKTU LOKAL (REALTIME)
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
        category_id:
          Number(
            c.category_id ??
              c.id_category ??
              c.category?.id_category
          ) || null,
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

  const rupiahToNumber = (val) =>
    Number(val.replace(/\./g, "")) || 0;

  // ===============================
  // CATEGORY
  // ===============================
  const toggleCategory = (cat) => {
    const exists = selectedCategories.some(
      (c) => c.id_category === cat.id_category
    );

    const updated = exists
      ? selectedCategories.filter(
          (c) => c.id_category !== cat.id_category
        )
      : [...selectedCategories, cat];

    setSelectedCategories(updated);

    if (
      selectedCommodity &&
      !updated.some(
        (c) => c.id_category === selectedCommodity.category_id
      )
    ) {
      setSelectedCommodity(null);
      setUnit("");
      setPrice("");
    }
  };

  // ===============================
  // SELECT COMMODITY
  // ===============================
  const handleSelectCommodity = async (item) => {
    setSelectedCommodity(item);
    setPrice("");

    if (item.unit || item.name_unit) {
      setUnit(item.unit || item.name_unit);
    } else if (item.unit_id) {
      const local = units.find(
        (u) => Number(u.id) === Number(item.unit_id)
      );
      if (local) {
        setUnit(local.name_unit);
      } else {
        const db = await getDatabase();
        const row = await db.getFirstAsync(
          "SELECT name_unit FROM units WHERE id = ?",
          [item.unit_id]
        );
        setUnit(row?.name_unit || "");
      }
    } else {
      setUnit("");
    }

    setTimeout(() => {
      priceRef.current?.measureLayout(
        scrollRef.current,
        (_, y) => {
          scrollRef.current.scrollTo({
            y: y - 20,
            animated: true,
          });
        }
      );
    }, 300);
  };

  // ===============================
  // SUBMIT (FIX UTAMA)
  // ===============================
  const handleSubmit = async () => {
    if (!selectedCommodity || !price) return;

    setLoading(true);
    try {
      const priceNumeric = rupiahToNumber(price);

      // 1️⃣ SIMPAN KE SQLITE (SYNC SERVER)
      await addPrice(
        selectedCommodity.id_commodity,
        selectedCommodity.category_id,
        priceNumeric
      );

      // 2️⃣ WAKTU LOKAL REALTIME
      const waktu = getLocalDateTime();

      // 3️⃣ CEK & RESET DASHBOARD JIKA GANTI HARI
      const lastDate = await AsyncStorage.getItem("dashboard_date");
      if (lastDate !== waktu.tanggal) {
        await AsyncStorage.removeItem("dashboard_log");
        await AsyncStorage.setItem("dashboard_date", waktu.tanggal);
      }

      // 4️⃣ CARI NAMA KATEGORI
      const catAktif = categories.find(
        (c) => Number(c.id_category) === Number(selectedCommodity.category_id)
      );

      // 5️⃣ LOG LOKAL (TIDAK TERPENGARUH DELETE)
      const aktivitasBaru = {
        id_temp: Date.now().toString(),
        source: "LOCAL_INPUT", // 🔒 PENTING
        name_commodity:
          selectedCommodity.name || selectedCommodity.name_commodity,
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

      const logBaru = [aktivitasBaru, ...logs].slice(0, 20);
      await AsyncStorage.setItem(
        "dashboard_log",
        JSON.stringify(logBaru)
      );

      navigation.goBack();
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan data");
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // FILTER
  // ===============================
  const filteredCommodities = commodities.filter((c) =>
    selectedCategories.some(
      (cat) => c.category_id === cat.id_category
    )
  );

  // ===============================
  // IMAGE SAFE
  // ===============================
  const SERVER = "http://103.100.27.57:5000/";
  const safeImage = (img) =>
    img
      ? { uri: img.startsWith("http") ? img : SERVER + img }
      : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tambah Data Harga</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.page}>
        {/* KATEGORI */}
        <Text style={styles.title}>Pilih Kategori</Text>
        <View style={styles.grid}>
          {categories.map((cat) => {
            const active = selectedCategories.some(
              (c) => c.id_category === cat.id_category
            );
            return (
              <TouchableOpacity
                key={cat.id_category}
                style={[
                  styles.gridBoxSmall,
                  active && styles.activeGridBox,
                ]}
                onPress={() => toggleCategory(cat)}
              >
                {safeImage(cat.image) && (
                  <Image
                    source={safeImage(cat.image)}
                    style={{ width: 40, height: 40 }}
                  />
                )}
                <Text
                  style={[
                    styles.boxLabel,
                    { color: active ? "#fff" : "#174A6A" },
                  ]}
                >
                  {cat.name_category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* KOMODITAS */}
        {filteredCommodities.length > 0 && (
          <>
            <Text style={[styles.title, { marginTop: 15 }]}>
              Pilih Komoditas
            </Text>
            <View style={styles.grid}>
              {filteredCommodities.map((item) => {
                const active =
                  selectedCommodity?.id_commodity ===
                  item.id_commodity;
                return (
                  <TouchableOpacity
                    key={item.id_commodity}
                    style={[
                      styles.gridBoxSmall,
                      active && styles.activeGridBox,
                    ]}
                    onPress={() => handleSelectCommodity(item)}
                  >
                    {safeImage(item.image) && (
                      <Image
                        source={safeImage(item.image)}
                        style={{ width: 50, height: 40 }}
                      />
                    )}
                    <Text
                      style={[
                        styles.boxLabel,
                        {
                          color: active
                            ? "#fff"
                            : "#174A6A",
                        },
                      ]}
                    >
                      {item.name || item.name_commodity}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* INPUT */}
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
                  onChangeText={(t) =>
                    setPrice(formatRupiah(t))
                  }
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Satuan</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: "#f3f3f3" },
                  ]}
                  value={unit}
                  editable={false}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                (!price || loading) && { opacity: 0.6 },
              ]}
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
    </KeyboardAvoidingView>
  );
}

// ===============================
// STYLES (ASLI)
// ===============================
const styles = StyleSheet.create({
  header: {
    backgroundColor: "#174A6A",
    paddingTop: 40,
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
  boxLabel: {
    fontSize: 11,
    textAlign: "center",
    fontWeight: "600",
  },
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
});
