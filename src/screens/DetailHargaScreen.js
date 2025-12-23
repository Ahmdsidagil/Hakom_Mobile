// ============================
// 📱 DetailHargaScreen.js (FIXED FOR HISTORY)
// ============================
import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import NetInfo from "@react-native-community/netinfo";

import {
  deleteLocalPrice,
  getDetailHargaForScreen,
  syncPriceHistoryFromServer,
  syncPricesToServer 
} from "../../config/database";

// ========================
// 🛠 CONFIG & HELPERS
// ========================
const BASE_URL = "http://103.100.27.57:5100"; 

// Helper Tanggal yang lebih aman
const getYMD = (date) => {
  if (!date) return new Date().toISOString().split("T")[0];
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60000;
  const localDate = new Date(d.getTime() - offset);
  return localDate.toISOString().split("T")[0];
};

const formatIndoDate = (date) =>
  new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  });

const resolveImageSource = (localImg, serverImgRaw) => {
  if (localImg && localImg.length > 5) return { uri: localImg };
  if (serverImgRaw && serverImgRaw.length > 2 && serverImgRaw !== "null") {
    if (serverImgRaw.startsWith("http")) return { uri: serverImgRaw };
    const cleanPath = serverImgRaw.startsWith("/") ? serverImgRaw.substring(1) : serverImgRaw;
    return { uri: `${BASE_URL.replace(/\/$/, "")}/${cleanPath}` };
  }
  return null;
};

export default function DetailHargaScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  // Ambil params. nama_komoditas sangat penting untuk Riwayat Hapus
  const { commodity_id, nama_komoditas, selectedDate, satuan } = route.params || {};

  const [currentDate, setCurrentDate] = useState(selectedDate ? new Date(selectedDate) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [displayItems, setDisplayItems] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const targetDateStr = useMemo(() => getYMD(currentDate), [currentDate]);

  // ========================
  // 🔥 FETCH DATA LOGIC
  // ========================
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    
    console.log(`🔍 Fetching: ID=${commodity_id}, Date=${targetDateStr}`);

    try {
      const rows = await getDetailHargaForScreen(commodity_id, targetDateStr);
      
      if (!rows || rows.length === 0) {
        setDisplayItems([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const parsedData = rows.map(r => {
          const isSynced = (r.synced == 1); 
          return {
              ...r,
              uiId: r.id, 
              isSynced: isSynced,
              priceNum: Number(r.price || 0),
              timeMs: new Date(r.created_at).getTime(),
              imageSource: resolveImageSource(r.local_image, r.image || r.server_image),
              finalUnit: r.unit_input || r.unit || r.master_unit || satuan || "Kg",
              finalCategory: r.kategori_nama || r.name_category || "-"
          };
      });

      // LOGIKA MERGE
      const syncedItems = parsedData.filter(d => d.isSynced);
      const localItems = parsedData.filter(d => !d.isSynced);
      let finalData = [...syncedItems];

      localItems.forEach(localItem => {
          const isDuplicate = syncedItems.some(serverItem => {
              const samePrice = serverItem.priceNum === localItem.priceNum;
              const timeDiff = Math.abs(serverItem.timeMs - localItem.timeMs);
              return samePrice && timeDiff < 300000;
          });

          if (!isDuplicate) {
              finalData.push(localItem);
          }
      });

      finalData.sort((a, b) => b.timeMs - a.timeMs);
      setDisplayItems(finalData);

    } catch (e) {
      console.error("❌ Error Fetch:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [commodity_id, targetDateStr, satuan]);

  // ========================
  // 🔄 SYNC & REFRESH
  // ========================
  useFocusEffect(
    useCallback(() => {
      fetchData(false);
      NetInfo.fetch().then(state => {
        if (state.isConnected) {
            syncPricesToServer()
              .then(() => syncPriceHistoryFromServer(commodity_id, targetDateStr))
              .then(() => fetchData(true))
              .catch(err => console.log("⚠️ Sync background error:", err));
        }
      });
    }, [fetchData, targetDateStr]) 
  );

  const onRefresh = () => {
    setRefreshing(true);
    NetInfo.fetch().then(state => {
        if (state.isConnected) {
            syncPricesToServer()
            .then(() => syncPriceHistoryFromServer(commodity_id, targetDateStr))
            .finally(() => fetchData(true));
        } else {
            fetchData(true);
        }
    });
  };

  const stats = useMemo(() => {
    const total = displayItems.reduce((a, b) => a + b.priceNum, 0);
    const unitToDisplay = displayItems.length > 0 ? displayItems[0].finalUnit : (satuan || "Kg");
    return {
      count: displayItems.length,
      avg: displayItems.length ? Math.round(total / displayItems.length) : 0,
      unit: unitToDisplay
    };
  }, [displayItems, satuan]);

  const handleItemPress = (item) => {
    if (selectionMode) {
      if (item.isSynced) return; 
      const isSelected = selectedIds.includes(item.uiId);
      const newSelected = isSelected ? selectedIds.filter(id => id !== item.uiId) : [...selectedIds, item.uiId];
      setSelectedIds(newSelected);
      if (newSelected.length === 0) setSelectionMode(false);
    } else if (!item.isSynced) {
      navigation.navigate("EditData", {
        item: {
          ...item,
          id: item.uiId, 
          nama_komoditas: nama_komoditas, 
          kategori: item.finalCategory, 
          satuan: item.finalUnit,
          local_image: item.imageSource?.uri,
          price: item.priceNum
        },
        onGoBack: () => fetchData(true),  
      });
    } else {
        Alert.alert("Tersinkron", "Data server tidak dapat diedit.");
    }
  };

  // ========================
  // 🗑️ HANDLE DELETE (FIXED)
  // ========================
  const handleBulkDelete = () => {
    Alert.alert("Hapus Data", `Hapus ${selectedIds.length} item? Data akan masuk ke Riwayat Hapus.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus", style: "destructive",
        onPress: async () => {
            // Loop item yang akan dihapus
            for (const item of displayItems) {
                if (selectedIds.includes(item.uiId) && !item.isSynced) {
                    
                    // 1. SIAPKAN DATA LENGKAP UNTUK RIWAYAT
                    // Kita kirim object ini ke fungsi delete di database agar dicatat dulu sebelum dihapus
                    const dataForHistory = {
                        ...item,
                        id: item.uiId, // Pastikan ID terbawa
                        name_commodity: nama_komoditas, // PENTING: Nama dari params
                        name_category: item.finalCategory || "Umum",
                        price: item.priceNum,
                        unit: item.finalUnit,
                        image: item.image || item.server_image,
                        local_image: item.local_image,
                        // Gunakan tanggal yang sedang dibuka agar muncul di filter tanggal yang benar
                        tanggal: targetDateStr 
                    };

                    console.log("🗑️ Deleting & Archiving:", dataForHistory.name_commodity);
                    
                    // 2. PANGGIL FUNGSI DELETE DENGAN DATA LENGKAP
                    // Pastikan fungsi deleteLocalPrice di database.js menerima parameter ke-2 (itemData)
                    await deleteLocalPrice(item.uiId, dataForHistory);
                }
            }
            setSelectionMode(false);
            setSelectedIds([]);
            fetchData(true);
        }
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, selectionMode && styles.headerSelection]}>
        <TouchableOpacity onPress={() => selectionMode ? (setSelectionMode(false), setSelectedIds([])) : navigation.goBack()}>
          <Ionicons name={selectionMode ? "close" : "arrow-back"} size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{selectionMode ? `${selectedIds.length} Dipilih` : "Detail & Edit Harga"}</Text>
        {selectionMode ? (
          <TouchableOpacity onPress={handleBulkDelete}><Ionicons name="trash" size={26} color="#fff" /></TouchableOpacity>
        ) : <View style={{ width: 26 }} />}
      </View>

      <View style={styles.dateBar}>
        <Text style={styles.dateText}>Tanggal: <Text style={{ fontWeight: "800", color:'#334155' }}>{formatIndoDate(currentDate)}</Text></Text>
        <TouchableOpacity style={styles.changeBtn} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.changeBtnTxt}>UBAH</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#174A6A"]} />}
      >
        <View style={styles.summaryBox}>
          <Text style={styles.commodityLabel}>{nama_komoditas}</Text>
          <Text style={styles.avgLabel}>RATA-RATA HARGA</Text>
          <View style={styles.priceRow}>
            <Text style={styles.avgValue}>Rp {stats.avg.toLocaleString("id-ID")}</Text>
            <Text style={styles.summaryUnit}> / {stats.unit}</Text>
          </View>
          <Text style={styles.countText}>{stats.count} Data Terkumpul</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#174A6A" style={{ marginTop: 20 }} />
        ) : (
          displayItems.map((item) => {
            const isSelected = selectedIds.includes(item.uiId);
            return (
              <TouchableOpacity
                key={`row-${item.uiId}-${item.isSynced}`}
                activeOpacity={0.7}
                onLongPress={() => !item.isSynced && (setSelectionMode(true), setSelectedIds([item.uiId]))}
                onPress={() => handleItemPress(item)}
                style={[styles.card, isSelected && styles.cardSelected]}
              >
                <View style={styles.row}>
                  {selectionMode && !item.isSynced && (
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  )}
                  
                  <View style={styles.imageWrapper}>
                    {item.imageSource ? (
                      <Image source={item.imageSource} style={styles.image} resizeMode="cover"/>
                    ) : (
                      <Ionicons name="image-outline" size={24} color="#CBD5E1" />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.price}>
                      Rp {item.priceNum.toLocaleString("id-ID")}
                      <Text style={styles.itemUnit}> / {item.finalUnit}</Text>
                    </Text>
                    <View style={styles.metaRow}>
                        <Ionicons name="time-outline" size={12} color="#64748B" />
                        <Text style={styles.time}>
                        {new Date(item.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                        </Text>
                    </View>
                    
                    <View style={styles.statusBadge}>
                        <View style={[styles.dot, { backgroundColor: item.isSynced ? "#22c55e" : "#f97316" }]} />
                        <Text style={[styles.statusTxt, { color: item.isSynced ? "#166534" : "#c2410c" }]}>
                            {item.isSynced ? "Tersinkron" : "Belum Tersinkron"}
                        </Text>
                    </View>
                  </View>

                  {!item.isSynced && !selectionMode && (
                    <Ionicons name="create-outline" size={20} color="#94A3B8" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
        
        {!loading && displayItems.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTxt}>Belum ada data di tanggal ini.</Text>
            <Text style={styles.subTxt}>Pastikan tanggal input sesuai.</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker value={currentDate} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(false); if (d) setCurrentDate(d); }} />
      )}
    </View>
  );
}

// Styles Tetap Sama
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    backgroundColor: "#174A6A",
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  headerSelection: { backgroundColor: "#EF4444" },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  dateBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: { color: "#64748B", fontSize: 13, fontWeight: "500" },
  changeBtn: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  changeBtnTxt: { fontSize: 11, fontWeight: "800", color: "#174A6A" },
  content: { padding: 16 },
  summaryBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F1F5F9"
  },
  commodityLabel: { color: "#64748B", fontWeight: "700", fontSize: 14, textTransform: 'uppercase', marginBottom: 4 },
  avgLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "800", letterSpacing: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  avgValue: { fontSize: 32, fontWeight: "900", color: "#174A6A", letterSpacing: -1 },
  summaryUnit: { fontSize: 16, color: "#94A3B8", fontWeight: "600", marginLeft: 4 }, 
  countText: { fontSize: 11, color: "#94A3B8", marginTop: 8, backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 1,
  },
  cardSelected: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActive: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  imageWrapper: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  image: {
    width: "100%",
    height: "100%",
  },
  price: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  itemUnit: { fontSize: 12, color: "#64748B", fontWeight: "500" },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  time: { fontSize: 11, color: "#64748B" },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 6, backgroundColor: '#F8FAFC', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusTxt: { fontSize: 10, fontWeight: "600" },
  emptyContainer: { alignItems: "center", marginTop: 60, opacity: 0.8 },
  emptyTxt: { color: "#334155", marginTop: 16, fontWeight: "700", fontSize: 16 },
  subTxt: { color: "#94A3B8", marginTop: 4, fontSize: 13 },
});