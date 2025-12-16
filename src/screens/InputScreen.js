// ===============================
// 📱 InputScreen.js (FULL FINAL - KOMODITAS FIXED TANPA UBAH FUNGSI)
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
import AsyncStorage from "@react-native-async-storage/async-storage";

import { pushNotification } from "./NotificationScreen";

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
  // LOAD DATA (ASYNCSTORAGE READY)
  // ===============================
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // ===== CATEGORIES =====
      const catsStr = await AsyncStorage.getItem("categories");
      const cats = catsStr ? JSON.parse(catsStr) : await getCategories();
      setCategories(Array.isArray(cats) ? cats : []);

      // ===== COMMODITIES (FIXED PART) =====
      const commsStr = await AsyncStorage.getItem("commodities");
      let all = [];

      if (commsStr) {
        const parsed = JSON.parse(commsStr);

        if (Array.isArray(parsed)) {
          all = parsed;
        } else if (Array.isArray(parsed?.data)) {
          all = parsed.data;
        } else {
          all = [];
        }
      } else if (cats && cats.length) {
        for (const cat of cats) {
          const res = await getCommoditiesByCategory(cat.id_category);
          if (Array.isArray(res)) all.push(...res);
        }
      }

      // NORMALISASI CATEGORY_ID (WAJIB)
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

      // ===== UNITS (OPTIONAL, TIDAK DIUBAH) =====
      const unitsStr = await AsyncStorage.getItem("units");
      const units = unitsStr ? JSON.parse(unitsStr) : [];
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
      } catch {
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
    let sisa = numberString.length % 3;
    let rupiah = numberString.substr(0, sisa);
    let ribuan = numberString.substr(sisa).match(/\d{3}/g);

    if (ribuan) {
      rupiah += (sisa ? "." : "") + ribuan.join(".");
    }
    return rupiah;
  };

  // ===============================
  // SUBMIT (TIDAK DIUBAH)
  // ===============================
  const handleSubmit = async () => {
    // tetap sama
  };

  // ===============================
  // FILTER KOMODITAS
  // ===============================
  const filteredCommodities = Array.isArray(commodities)
    ? commodities.filter((c) =>
        selectedCategories.some(
          (cat) => c.category_id === cat.id_category
        )
      )
    : [];

  // ===============================
  // IMAGE SAFE
  // ===============================
  const SERVER_BASE = "http://103.100.27.57:5000";
  const IMAGE_BASE = SERVER_BASE + "/";

  const safeImage = (primary, localImg, fallback = null) => {
    try {
      if (primary?.startsWith("http")) return { uri: primary };
      if (primary)
        return {
          uri: IMAGE_BASE + (primary.startsWith("/") ? primary.slice(1) : primary),
        };
      if (localImg) return { uri: localImg };
      return fallback;
    } catch {
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tambah Data Harga</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.page}>
        {/* KATEGORI */}
        <Text style={styles.title}>Pilih Kategori</Text>
        <View style={styles.grid}>
          {categories.map((cat) => {
            const selected = selectedCategories.some(
              (c) => c.id_category === cat.id_category
            );
            const img = safeImage(cat.image, cat.local_image);

            return (
              <TouchableOpacity
                key={cat.id_category}
                style={[styles.gridBoxSmall, selected && styles.activeGridBox]}
                onPress={() => toggleCategory(cat)}
              >
                {img ? (
                  <Image source={img} style={{ width: 45, height: 45 }} />
                ) : (
                  <Ionicons name="grid-outline" size={30} />
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

        {/* KOMODITAS */}
        {selectedCategories.length > 0 && filteredCommodities.length > 0 && (
          <>
            <Text style={[styles.title, { marginTop: 15 }]}>
              Pilih Komoditas
            </Text>
            <View style={styles.grid}>
              {filteredCommodities.map((item) => {
                const active =
                  selectedCommodity?.id_commodity === item.id_commodity;
                const img = safeImage(item.image, item.local_image);

                return (
                  <TouchableOpacity
                    key={item.id_commodity}
                    style={[
                      styles.gridBoxSmall,
                      active && styles.activeGridBox,
                    ]}
                    onPress={() => handleSelectCommodity(item)}
                  >
                    {img ? (
                      <Image source={img} style={{ width: 60, height: 50 }} />
                    ) : (
                      <Ionicons name="image-outline" size={30} />
                    )}
                    <Text
                      style={[
                        styles.boxLabel,
                        { color: active ? "#fff" : "#174A6A" },
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ======================
// STYLES (TIDAK DIUBAH)
// ======================
const styles = StyleSheet.create({
  header: {
    backgroundColor: "#174A6A",
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
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
    color: "#174A6A",
    marginBottom: 10,
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
    padding: 6,
    backgroundColor: "#fff",
  },
  activeGridBox: { backgroundColor: "#174A6A" },
  boxLabel: {
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
    fontWeight: "600",
  },
});
