// ====================================================
// 📱 DetailHargaScreen.js (FINAL & ROBUST VERSION)
// Tampilan detail harga harian per komoditas.
// Memuat dan memfilter data 30 hari lokal.
// ====================================================

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import {
  getAllLocalPrices,
  deleteLocalPrice,
} from "../../config/database";

// ==============================
// 📌 HELPERS
// ==============================

// Format tanggal untuk tampilan header
const formatTanggalHeader = (tgl) => {
  if (!tgl) return "-";
  const dateObj = tgl instanceof Date ? tgl : new Date(tgl);
  if (isNaN(dateObj.getTime())) return "Tanggal Invalid";

  return dateObj.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Menghitung tanggal 30 hari yang lalu
const get30DaysAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Convert nilai ke number aman
const safeNumber = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

// Ambil tanggal item (prioritas: updated_at > created_at > tanggal)
const getItemDate = (item) => item.updated_at || item.created_at || item.tanggal;

// Ambil harga item (price atau raw_price)
const getItemPrice = (item) => safeNumber(item.price ?? item.raw_price);

// ==============================
// 📌 COMPONENT
// ==============================

export default function DetailHargaScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { commodity_id, nama_komoditas, kategori, satuan, selectedDate } =
    route.params || {};

  // ==========================
  // State
  // ==========================
  const [allPrices, setAllPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(selectedDate ? new Date(selectedDate) : new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // ==========================
  // 1️⃣ Fetch Data Local 30 Hari
  // ==========================
  const fetchData = useCallback(async () => {
    if (!commodity_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const local = await getAllLocalPrices();
      const thirtyDaysAgo = get30DaysAgo();

      const filtered = local.filter((item) => {
        if (String(item.commodity_id) !== String(commodity_id)) return false;
        const d = new Date(getItemDate(item));
        return !isNaN(d.getTime()) && d >= thirtyDaysAgo;
      });

      setAllPrices(filtered);
    } catch (e) {
      console.error("fetchData error:", e);
      Alert.alert("Error", "Gagal memuat data harga.");
    } finally {
      setLoading(false);
    }
  }, [commodity_id]);

  // ==========================
  // 2️⃣ Fokus Layar -> Fetch
  // ==========================
  useFocusEffect(
    useCallback(() => {
      setSelectionMode(false);
      setSelectedIds([]);
      fetchData();
    }, [fetchData])
  );

  // ==========================
  // 3️⃣ Filter Berdasarkan Tanggal
  // ==========================
  const filteredItems = useMemo(() => {
    const selected = new Date(date);
    selected.setHours(0, 0, 0, 0);

    return allPrices
      .filter((item) => {
        const d = new Date(getItemDate(item));
        if (isNaN(d.getTime())) return false;
        d.setHours(0, 0, 0, 0);
        return d.getTime() === selected.getTime();
      })
      .sort((a, b) => new Date(getItemDate(b)) - new Date(getItemDate(a)));
  }, [allPrices, date]);

  // ==========================
  // 4️⃣ Hitung Rata-Rata
  // ==========================
  const headerAvg = useMemo(() => {
    if (!filteredItems.length) return 0;
    const total = filteredItems.reduce((sum, it) => sum + getItemPrice(it), 0);
    return Math.round(total / filteredItems.length);
  }, [filteredItems]);

  // ==========================
  // 5️⃣ Handler Date Picker
  // ==========================
  const handleDateChange = (event, selectedDate) => {
    const newDate = selectedDate || date;
    setShowPicker(Platform.OS === "ios");
    setDate(newDate);
    setSelectionMode(false);
    setSelectedIds([]);
  };

  // ==========================
  // 6️⃣ Selection Mode & Toggle
  // ==========================
  const toggleSelect = (idKey) =>
    setSelectedIds((prevIds) =>
      prevIds.includes(idKey) ? prevIds.filter((x) => x !== idKey) : [...prevIds, idKey]
    );

  const handleLongPressItem = (item) => {
    if (!item.synced) {
      const idKey = item.id || item.local_id;
      setSelectionMode(true);
      toggleSelect(idKey);
    }
  };

  const handlePressItem = (item) => {
    if (selectionMode && !item.synced) {
      const idKey = item.id || item.local_id;
      toggleSelect(idKey);
    }
  };

  // ==========================
  // 7️⃣ Edit Item (Offline Only)
  // ==========================
  const handleEdit = (item) => {
    if (!item.synced) {
      setSelectionMode(false);
      setSelectedIds([]);
      navigation.navigate("EditData", {
        data: item,
        onGoBack: fetchData,
        selectedDate: date.toISOString(),
      });
    } else {
      Alert.alert("Gagal Edit", "Data yang sudah tersinkron tidak dapat diedit.");
    }
  };

  // ==========================
  // 8️⃣ Delete Selected Items
  // ==========================
  const handleDeleteSelected = () => {
    if (!selectedIds.length) return;

    Alert.alert(
      "Hapus Data",
      `Anda yakin ingin menghapus ${selectedIds.length} data harga yang belum tersinkron ini?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              for (const id of selectedIds) {
                await deleteLocalPrice(id);
              }
              setSelectionMode(false);
              setSelectedIds([]);
              fetchData();
            } catch (error) {
              console.error("Delete failed:", error);
              Alert.alert("Error Hapus", "Gagal menghapus data.");
            }
          },
        },
      ]
    );
  };

  // ==========================
  // 9️⃣ Render Helpers
  // ==========================
  const renderImage = (item) => {
    const uri = item.local_image || item.image;
    if (uri) return <Image source={{ uri }} style={styles.image} />;
    return (
      <View style={styles.image}>
        <Ionicons name="image-outline" size={30} color="#9CA3AF" />
      </View>
    );
  };

  const handleGoBack = () => {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedIds([]);
    } else navigation.goBack();
  };

  // ==========================
  // 🔹 RENDER JSX
  // ==========================
  return (
    <View style={styles.container}>
      {/* HEADER BAR */}
      <View style={styles.header}>
        {selectionMode ? (
          <>
            <TouchableOpacity onPress={handleGoBack}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>{selectedIds.length} dipilih</Text>

            <TouchableOpacity onPress={handleDeleteSelected} disabled={!selectedIds.length}>
              <Ionicons
                name="trash"
                size={22}
                color={selectedIds.length ? "#fff" : "#9CA3AF"}
              />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={handleGoBack}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{nama_komoditas}</Text>
          </>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* INFO KOMODITAS & DATE PICKER */}
        <View style={styles.infoHeader}>
          <Text style={styles.title}>{nama_komoditas || "Komoditas Tidak Dikenal"}</Text>
          <Text style={styles.subtitle}>
            {kategori || "-"} | {satuan || "-"}
          </Text>

          <View style={styles.infoBoxRow}>
            <View style={styles.infoBox}>
              <Text style={styles.avg}>Rata-rata: Rp {headerAvg.toLocaleString("id-ID")}</Text>
              <Text style={styles.totalData}>Total data: {filteredItems.length}</Text>
            </View>

            <TouchableOpacity
              style={styles.dateBox}
              onPress={() => setShowPicker(true)}
              disabled={loading}
            >
              <Ionicons name="calendar-outline" size={16} color="#174A6A" />
              <Text style={styles.dateBoxText}>{formatTanggalHeader(date)}</Text>
            </TouchableOpacity>
          </View>

          {showPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={new Date()}
              minimumDate={get30DaysAgo()}
              onChange={handleDateChange}
            />
          )}
        </View>

        {/* LIST DATA */}
        {loading ? (
          <ActivityIndicator size="large" color="#174A6A" style={{ marginTop: 40 }} />
        ) : filteredItems.length ? (
          filteredItems.map((item) => {
            const idKey = item.id || item.local_id;
            const selected = selectedIds.includes(idKey);
            const displayDate = new Date(getItemDate(item));
            const isSynced = !!item.synced;

            return (
              <TouchableOpacity
                key={idKey}
                style={[
                  styles.card,
                  selected && { borderWidth: 2, borderColor: "#2563EB" },
                  selectionMode && isSynced && { opacity: 0.6 },
                ]}
                onLongPress={() => handleLongPressItem(item)}
                onPress={() => handlePressItem(item)}
                disabled={selectionMode && isSynced}
              >
                {selectionMode && !isSynced && (
                  <View style={[styles.checkbox, selected && styles.checked]}>
                    {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                )}

                <View style={{ marginRight: 12 }}>{renderImage(item)}</View>

                <View style={styles.info}>
                  <Text style={styles.price}>
                    Rp {getItemPrice(item).toLocaleString("id-ID")} / {satuan}
                  </Text>

                  <Text style={styles.date}>
                    {displayDate.toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    -{" "}
                    {displayDate.toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>

                  {item.updated_at && (
                    <Text style={{ fontSize: 11, color: "#9CA3AF" }}>(Diperbarui)</Text>
                  )}
                </View>

                {!selectionMode && (
                  <>
                    <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
                      <Text
                        style={[styles.status, { color: isSynced ? "#16A34A" : "#DC2626" }]}
                      >
                        {isSynced ? "Tersinkron" : "Belum Tersinkron"}
                      </Text>
                    </View>

                    {!isSynced && (
                      <TouchableOpacity onPress={() => handleEdit(item)} style={{ marginLeft: 12 }}>
                        <Ionicons name="pencil" size={20} color="#2563EB" />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={styles.empty}>Belum ada data di tanggal ini.</Text>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ==============================
// 📌 STYLES
// ==============================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#174A6A",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
    marginLeft: 12,
  },
  content: { flex: 1, padding: 16 },
  infoHeader: { marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  infoBoxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  infoBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginRight: 8,
  },
  avg: { fontSize: 16, fontWeight: "700", color: "#174A6A" },
  totalData: { fontSize: 14, fontWeight: "600", color: "#111827" },
  dateBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  dateBoxText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#174A6A",
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#6B7280",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  checked: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  image: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#EEE",
    justifyContent: "center",
    alignItems: "center",
  },
  info: { flex: 1 },
  price: { fontSize: 14, fontWeight: "700", color: "#174A6A" },
  date: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  status: { fontSize: 12, fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 40, color: "#6B7280" },
});
