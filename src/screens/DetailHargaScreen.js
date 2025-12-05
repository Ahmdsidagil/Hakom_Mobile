// ===============================
// 📱 DetailHargaScreen.js (Final - Server + Lokal, Filter Tanggal, Edit/Delete Lokal)
// ===============================
import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image,
  TouchableOpacity, 
  Alert, 
  Platform 
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { getAllLocalPrices, deleteLocalPrice } from "../../config/database";
import api from "../../config/api"; // pastikan api.js sudah versi wrapper fetch

const formatTanggal = (tgl) => {
  if (!tgl) return "-";
  const d = new Date(tgl);
  if (isNaN(d.getTime())) return "-";
  const bulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const day = d.getDate();
  const month = bulan[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

export default function DetailHargaScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { commodity_id, nama_komoditas, kategori, satuan } = route.params;

  const [prices, setPrices] = useState([]);
  const [avgPrice, setAvgPrice] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  // -------------------
  // Fetch data server & fallback lokal
  // -------------------
  const fetchData = async () => {
    setLoading(true);
    let serverPrices = [];
    try {
      // ambil token dari AsyncStorage jika perlu
      const token = await AsyncStorage.getItem("token");

      const res = await api.get(`/prices?commodity_id=${commodity_id}`, token);
      if (res.ok) {
        serverPrices = await res.json();
      } else {
        console.warn("❌ Server error, fallback ke lokal");
      }
    } catch (err) {
      console.warn("❌ Gagal fetch server, pakai data lokal saja", err.message);
    }

    try {
      const localPrices = await getAllLocalPrices();
      const filteredLocal = localPrices.filter(x => String(x.commodity_id) === String(commodity_id));

      // gabungkan server + lokal (server dulu, lokal bisa overwrite jika id sama)
      const combined = [...serverPrices, ...filteredLocal];

      // filter berdasarkan tanggal
      const filteredByDate = combined.filter(x => {
        const tgl = new Date(x.created_at || x.tanggal);
        return tgl.toDateString() === date.toDateString();
      });

      setPrices(filteredByDate);

      if (filteredByDate.length) {
        const total = filteredByDate.reduce((sum, x) => sum + Number(x.price || x.raw_price || 0), 0);
        setAvgPrice(total / filteredByDate.length);
      } else setAvgPrice(0);
    } catch (err) {
      console.error("❌ Gagal ambil data lokal:", err);
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [date]);

  // -------------------
  // Pilih / unselect item
  // -------------------
  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x!==id) : [...prev,id]);
  };
  const handleLongPress = (item) => {
    if(!item.synced){
      if(!selectionMode) setSelectionMode(true);
      toggleSelect(item.id);
    }
  };

  // -------------------
  // Delete
  // -------------------
  const handleDelete = async () => {
    Alert.alert("Hapus data", "Apakah anda yakin ingin menghapus data terpilih?", [
      { text:"Batal", style:"cancel", onPress:()=>{ setSelectedIds([]); setSelectionMode(false); } },
      { text:"Hapus", style:"destructive", onPress: async ()=>{
          for(const id of selectedIds) await deleteLocalPrice(id);
          setSelectedIds([]); setSelectionMode(false);
          fetchData();
        }
      }
    ]);
  };

  // -------------------
  // Edit
  // -------------------
  const handleEdit = (item) => { 
    if(!item.synced) navigation.navigate("EditDataScreen",{data:item, onGoBack: fetchData});
  };

  // -------------------
  // Date picker
  // -------------------
  const onChangeDate = (event, selectedDate) => {
    setShowPicker(Platform.OS === "ios");
    if(selectedDate) setDate(selectedDate);
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        {selectionMode ? (
          <>
            <TouchableOpacity onPress={()=>{setSelectionMode(false); setSelectedIds([])}} style={styles.backBtn}>
              <Ionicons name="close" size={24} color="#fff"/>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{selectedIds.length} dipilih</Text>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtnHeader}>
              <Ionicons name="trash" size={24} color="#fff"/>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={()=>navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff"/>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Detail Harga</Text>
          </>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Info Header */}
        <View style={styles.infoHeader}>
          <Text style={styles.title}>{nama_komoditas}</Text>
          <Text style={styles.subtitle}>Kategori: {kategori} | Satuan: {satuan}</Text>

          <View style={styles.infoBoxRow}>
            <View style={styles.infoBox}>
              <Text style={styles.avg}>Rata-rata Harga: Rp {Math.round(avgPrice).toLocaleString("id-ID")}</Text>
              <Text style={styles.totalData}>Total Data: {prices.length}</Text>
            </View>

            <TouchableOpacity style={styles.dateBox} onPress={()=>setShowPicker(true)}>
              <Ionicons name="calendar-outline" size={16} color="#174A6A" />
              <Text style={styles.dateBoxText}>{formatTanggal(date)}</Text>
            </TouchableOpacity>
          </View>

          {showPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={onChangeDate}
            />
          )}
        </View>

        {/* List Harga */}
        {loading ? (
          <Text style={styles.empty}>Loading...</Text>
        ) : prices.length ? prices.map((item,index)=>(
          <TouchableOpacity 
            key={index} 
            style={styles.card} 
            onLongPress={()=>handleLongPress(item)}
            onPress={()=>selectionMode && !item.synced ? toggleSelect(item.id):null}
          >
            {selectionMode && !item.synced && (
              <View style={[styles.checkbox, selectedIds.includes(item.id) && styles.checked]}>
                {selectedIds.includes(item.id) && <Ionicons name="checkmark" size={16} color="#fff"/>}
              </View>
            )}

            {item.image || item.local_image ? (
              <Image source={item.image?{uri:item.image}:{uri:item.local_image}} style={styles.image}/>
            ):null}

            <View style={styles.info}>
              <Text style={styles.price}>Rp {Number(item.price || item.raw_price).toLocaleString("id-ID")} / {satuan}</Text>
              <Text style={styles.date}>Tanggal: {formatTanggal(item.created_at || item.tanggal)}</Text>
              <Text style={[styles.status,{color:item.synced?"#16A34A":"#DC2626"}]}>{item.synced?"Tersinkron":"Belum Tersinkron"}</Text>
            </View>

            {!selectionMode && !item.synced && (
              <TouchableOpacity onPress={()=>handleEdit(item)} style={styles.editBtnRight}>
                <Ionicons name="pencil" size={20} color="#2563EB"/>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )) : <Text style={styles.empty}>Belum ada data harga untuk komoditas ini</Text>}
      </ScrollView>
    </View>
  );
}

// ===============================
// 🎨 STYLES
// ===============================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: "#174A6A", paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff", flex: 1 },
  deleteBtnHeader: { marginLeft: "auto" },
  content: { flex: 1, padding: 16 },
  infoHeader: { marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  infoBoxRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 12 },
  infoBox: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, marginRight: 8 },
  avg: { fontSize: 16, fontWeight: "700", color: "#174A6A", marginBottom: 4 },
  totalData: { fontSize: 14, fontWeight: "600", color: "#111827" },
  dateBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#E0F2FE", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3 },
  dateBoxText: { marginLeft: 6, fontSize: 14, fontWeight: "600", color: "#174A6A" },
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, alignItems: "center", position: "relative" },
  checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 1, borderColor: "#6B7280", justifyContent: "center", alignItems: "center", marginRight: 8 },
  checked: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  image: { width: 64, height: 64, borderRadius: 10, marginRight: 12, backgroundColor: "#EEE" },
  info: { flex: 1 },
  price: { fontSize: 14, fontWeight: "700", color: "#174A6A" },
  date: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  status: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  editBtnRight: { marginLeft: 12 },
  empty: { textAlign: "center", marginTop: 40, color: "#6B7280" },
});
