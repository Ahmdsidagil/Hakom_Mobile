// ====================================================
// 📱 DetailHargaScreen.js
// ====================================================
import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAllLocalPrices, deleteLocalPrice } from "../../config/database";

const CACHE_KEY = "server_prices_cache";

// Helper Tanggal agar format YYYY-MM-DD konsisten di seluruh aplikasi
const getLocalYMD = (dateInput) => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function DetailHargaScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  
  // Data dikirim dari DataLocalScreen
  const { 
    commodity_id, 
    nama_komoditas, 
    kategori, 
    satuan, 
    selectedDate: passedDate 
  } = route.params || {};

  const [localEntries, setLocalEntries] = useState([]); 
  const [serverData, setServerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(passedDate ? new Date(passedDate) : new Date());
  const [showPicker, setShowPicker] = useState(false);

  // State Fitur Hapus
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const targetDateStr = getLocalYMD(date);

      // 1. Ambil Data Lokal dari SQLite
      const allLocal = (await getAllLocalPrices()) || [];
      const filteredLocal = allLocal.filter(item => 
        String(item.commodity_id) === String(commodity_id) && 
        getLocalYMD(item.tanggal || item.created_at) === targetDateStr
      ).map(item => ({
        ...item,
        id: item.id || item.local_id,
        harga_angka: Number(item.price || item.harga || 0),
        is_synced: item.synced === 1 || item.synced === true 
      }));

      // 2. Ambil Data Server dari Cache AsyncStorage
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      const allServer = cached ? JSON.parse(cached) : [];
      const matchedServer = allServer.find(item => 
        String(item.commodity_id) === String(commodity_id) && 
        getLocalYMD(item.created_at) === targetDateStr
      );

      setLocalEntries(filteredLocal);
      setServerData(matchedServer);
    } catch (e) {
      console.error("Fetch Detail Error:", e);
    } finally {
      setLoading(false);
    }
  }, [commodity_id, date]);

  // Refresh data setiap kali layar difokuskan
  useFocusEffect(useCallback(() => { 
    setSelectionMode(false);
    setSelectedIds([]);
    fetchData(); 
  }, [fetchData]));

  // --- LOGIKA HEADER: RATA-RATA TOTAL (LOKAL + SERVER) ---
  const headerStats = useMemo(() => {
    let totalHargaInputan = 0;
    let totalCount = 0;

    // Tambah kontribusi dari data Lokal di HP ini
    localEntries.forEach(item => {
      totalHargaInputan += item.harga_angka;
      totalCount += 1;
    });

    // Tambah kontribusi dari data Server (Inputan orang lain)
    if (serverData) {
      const sCount = Number(serverData.total_input || 1);
      const sPrice = Number(serverData.raw_price || serverData.average_price || 0);
      totalHargaInputan += (sPrice * sCount);
      totalCount += sCount;
    }

    return {
      avg: totalCount > 0 ? Math.round(totalHargaInputan / totalCount) : 0,
      count: totalCount
    };
  }, [localEntries, serverData]);

  // --- LOGIKA SELEKSI HAPUS ---
  const toggleSelect = (item) => {
    if (item.is_synced) return; // Proteksi: Data tersinkron tidak bisa dipilih
    setSelectedIds(prev => 
      prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id]
    );
  };

  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    Alert.alert("Hapus Data", `Hapus ${selectedIds.length} data lokal terpilih?`, [
      { text: "Batal", style: "cancel" },
      { 
        text: "Hapus", 
        style: "destructive", 
        onPress: async () => {
          try {
            for (const id of selectedIds) { await deleteLocalPrice(id); }
            setSelectedIds([]);
            setSelectionMode(false);
            fetchData();
          } catch (err) {
            Alert.alert("Error", "Gagal menghapus data.");
          }
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      {/* HEADER DENGAN MODE SELEKSI */}
      <View style={[styles.header, selectionMode && styles.headerSelection]}>
        {selectionMode ? (
          <>
            <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedIds([]); }}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitleSelection}>{selectedIds.length} Terpilih</Text>
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Detail Harga</Text>
          </>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* INFO KOMODITAS & RINGKASAN */}
        <View style={styles.summaryBox}>
          <Text style={styles.commodityLabel}>{nama_komoditas}</Text>
          <Text style={styles.avgLabel}>RATA-RATA HARGA</Text>
          <Text style={styles.avgValue}>Rp {headerStats.avg.toLocaleString("id-ID")}</Text>
          <View style={styles.countBadge}>
            <Ionicons name="stats-chart" size={12} color="#174A6A" />
            <Text style={styles.countText}> {headerStats.count} Total Inputan (Gabungan)</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Butiran Input Lokal</Text>
          <Text style={styles.dateInfo}>{getLocalYMD(date)}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#174A6A" size="large" style={{ marginTop: 40 }} />
        ) : localEntries.length > 0 ? (
          localEntries.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const isSynced = item.is_synced;

            return (
              <TouchableOpacity 
                key={item.id} 
                activeOpacity={isSynced ? 1 : 0.7}
                onLongPress={() => !isSynced && (setSelectionMode(true), toggleSelect(item))}
                onPress={() => selectionMode ? toggleSelect(item) : null}
                style={[
                  styles.card,
                  isSelected && styles.cardSelected,
                  isSynced && styles.cardSynced // Visual untuk data terkunci
                ]}
              >
                <View style={styles.cardMain}>
                  {selectionMode && !isSynced && (
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  )}
                  
                  {isSynced && <Ionicons name="lock-closed" size={16} color="#94A3B8" style={{marginRight: 8}} />}

                  <Image 
                    source={item.local_image ? { uri: item.local_image } : null} 
                    style={styles.imgThumbnail} 
                  />
                  
                  <View>
                    <Text style={styles.priceText}>Rp {item.harga_angka.toLocaleString("id-ID")}</Text>
                    <Text style={styles.timeText}>
                      {new Date(item.waktu).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} WIB
                    </Text>
                  </View>
                </View>

                <View style={styles.cardRight}>
                  <View style={[styles.statusBadge, { backgroundColor: isSynced ? "#DCFCE7" : "#FEE2E2" }]}>
                    <Text style={[styles.statusText, { color: isSynced ? "#16A34A" : "#DC2626" }]}>
                      {isSynced ? "TERSINKRON" : "LOKAL"}
                    </Text>
                  </View>
                  
                  {!isSynced && !selectionMode && (
                    <TouchableOpacity 
                      onPress={() => navigation.navigate("EditData", { data: item })}
                      style={styles.editBtn}
                    >
                      <Ionicons name="pencil" size={12} color="#2563EB" />
                      <Text style={styles.editText}>Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="newspaper-outline" size={60} color="#D1D5DB" />
            <Text style={styles.emptyText}>Tidak ada history input lokal untuk tanggal ini.</Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB KALENDER */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowPicker(true)}>
        <Ionicons name="calendar" size={26} color="#fff" />
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(e, d) => { setShowPicker(false); if(d) setDate(d); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { backgroundColor: "#174A6A", paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  headerSelection: { backgroundColor: "#EF4444" },
  headerTitle: { color: "#fff", fontSize: 19, fontWeight: "800", marginLeft: 15 },
  headerTitleSelection: { color: "#fff", fontSize: 19, fontWeight: "800", flex: 1, marginLeft: 15 },
  content: { padding: 16 },
  summaryBox: { backgroundColor: "#fff", borderRadius: 20, padding: 20, alignItems: 'center', elevation: 5, marginBottom: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  commodityLabel: { fontSize: 14, color: "#64748B", fontWeight: '700', marginBottom: 10 },
  avgLabel: { color: "#94A3B8", fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  avgValue: { fontSize: 36, fontWeight: "900", color: "#174A6A", marginVertical: 4 },
  countBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 5 },
  countText: { color: "#174A6A", fontSize: 12, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#334155" },
  dateInfo: { fontSize: 12, color: "#94A3B8", fontWeight: '600' },
  card: { backgroundColor: "#fff", borderRadius: 15, padding: 14, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  cardSelected: { backgroundColor: "#FEF2F2", borderColor: "#EF4444", borderWidth: 1 },
  cardSynced: { backgroundColor: "#F1F5F9", opacity: 0.8 },
  cardMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  imgThumbnail: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#F1F5F9', marginRight: 12 },
  priceText: { fontSize: 17, fontWeight: "800", color: "#1E293B" },
  timeText: { fontSize: 12, color: "#64748B", marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  editBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  editText: { color: '#2563EB', fontSize: 11, fontWeight: '800', marginLeft: 4 },
  fab: { position: 'absolute', right: 25, bottom: 30, backgroundColor: '#174A6A', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: "#94A3B8", fontSize: 14, textAlign: 'center', marginTop: 15, width: '80%' }
});
