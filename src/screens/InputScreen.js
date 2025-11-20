// src/screens/InputScreen.js (Full Version With Perfect 6-Column Grid + Auto Format Rp)
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";

import {
  getCategories,
  getCommoditiesByCategory,
  addPrice,
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);

      const all = [];
      for (const cat of cats) {
        const res = await getCommoditiesByCategory(cat.id);
        all.push(...res);
      }
      setCommodities(all);
    } catch (err) {
      console.log("Load error:", err);
    }
  };

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

  const toggleCategory = (cat) => {
    const exists = selectedCategories.some((c) => c.id === cat.id);
    let updated;

    if (exists) {
      updated = selectedCategories.filter((c) => c.id !== cat.id);
    } else {
      updated = [...selectedCategories, cat];
    }

    setSelectedCategories(updated);

    if (
      selectedCommodity &&
      !updated.some((c) => c.id === selectedCommodity.category_id)
    ) {
      setSelectedCommodity(null);
      setUnit("");
    }
  };

  const handleSelectCommodity = (item) => {
    setSelectedCommodity(item);
    setUnit(item.unit);
  };

  // ============================
  // 🔥 Format harga otomatis
  // ============================
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

  const handleSubmit = async () => {
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
      const related = selectedCategories.filter(
        (c) => c.id === selectedCommodity.category_id
      );

      if (related.length === 0) {
        Alert.alert(
          "Peringatan",
          "Komoditas tidak sesuai dengan kategori yang dipilih."
        );
        return;
      }

      for (const cat of related) {
        await addPrice(selectedCommodity.id, cat.id, priceNum, unit);
      }

      const net = await NetInfo.fetch();
      showSnackbar(
        net.isConnected
          ? "✅ Berhasil disimpan & tersinkron"
          : "📦 Disimpan offline, menunggu sinkron"
      );

      setPrice("");
      setSelectedCommodity(null);
      setUnit("");

      if (route?.params?.onAddPrice) route.params.onAddPrice();
    } catch (err) {
      console.error(err);
      showSnackbar("❌ Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const filteredCommodities = commodities.filter((c) =>
    selectedCategories.some((cat) => cat.id === c.category_id)
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tambah Data Harga</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.page}>
        <Text style={styles.title}>Pilih Kategori</Text>

        <View style={styles.grid}>
          {categories.map((cat) => {
            const selected = selectedCategories.some((c) => c.id === cat.id);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.gridBoxSmall, selected && styles.activeGridBox]}
                onPress={() => toggleCategory(cat)}
              >
                <Ionicons
                  name="apps-outline"
                  size={24}
                  color={selected ? "#fff" : "#174A6A"}
                />
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

        {selectedCategories.length > 0 && (
          <>
            <Text style={[styles.title, { marginTop: 15 }]}>Pilih Komoditas</Text>

            <View style={styles.grid}>
              {filteredCommodities.map((item) => {
                const active = selectedCommodity?.id === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.gridBoxSmall, active && styles.activeGridBox]}
                    onPress={() => handleSelectCommodity(item)}
                  >
                    <Ionicons
                      name="leaf-outline"
                      size={24}
                      color={active ? "#fff" : "#0F5132"}
                    />
                    <Text
                      style={[
                        styles.boxLabel,
                        { color: active ? "#fff" : "#0F5132" },
                      ]}
                      numberOfLines={2}
                    >
                      {item.name_commodity}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

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
                  onFocus={() => {
                    setTimeout(() => {
                      scrollRef.current?.scrollTo({ y: 650, animated: true });
                    }, 200);
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

        <View style={{ height: 120 }} />
      </ScrollView>

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
    width: "15.5%",
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: "#174A6A",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    backgroundColor: "#fff",
  },

  activeGridBox: {
    backgroundColor: "#174A6A",
  },

  boxLabel: {
    fontSize: 9,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "600",
  },

  row: { flexDirection: "row" },

  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 5,
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
