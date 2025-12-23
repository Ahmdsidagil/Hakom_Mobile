// ===============================
// 📱 EditDataScreen.js (FINAL: GRADIENT HEADER + NOTIF UNGU)
// ===============================
import React, { useState, useEffect } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient"; // ✅ Import Gradasi
import { updateLocalPrice } from "../../config/database";

// ✅ Import Helper Notifikasi
import { pushNotification } from "../../src/screens/NotificationScreen";

export default function EditDataScreen({ route, navigation }) {
  // ============================
  // AMAN AMBIL PARAM
  // ============================
  const params = route?.params || {};
  const item = params.data || params.item || null;
  const onGoBack = params.onGoBack;

  // ============================
  // VALIDASI DATA
  // ============================
  if (!item) {
    return (
      <View style={styles.center}>
        <Text>Data tidak tersedia</Text>
      </View>
    );
  }

  // ============================
  // BLOK EDIT DATA ONLINE (AMAN)
  // ============================
  useEffect(() => {
    if (item.synced === 1) {
      Alert.alert(
        "Tidak Diizinkan",
        "Data yang sudah tersinkron tidak bisa diedit.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    }
  }, []);

  // ============================
  // STATE
  // ============================
  const rawHarga =
    item.price ??
    item.harga ??
    item.raw_price ??
    "";

  const [harga, setHarga] = useState(
    String(rawHarga).replace(/[^0-9]/g, "")
  );

  const satuan =
    item.unit || item.satuan || item.name_unit || "kg";

  // Helper untuk mendapatkan nama (dipakai di UI dan Notif)
  const displayName = item.nama_komoditas || 
                      item.nama || 
                      item.local_nama || 
                      item.commodity_name || 
                      "Komoditas";

  const [saving, setSaving] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // ============================
  // FORMAT RUPIAH
  // ============================
  const formatRupiah = (value) => {
    if (!value) return "";
    let numberString = value.replace(/[^,\d]/g, "");
    let sisa = numberString.length % 3;
    let rupiah = numberString.substr(0, sisa);
    const ribuan = numberString.substr(sisa).match(/\d{3}/g);

    if (ribuan) {
      const separator = sisa ? "." : "";
      rupiah += separator + ribuan.join(".");
    }

    return rupiah;
  };

  // ============================
  // SIMPAN KE SQLITE
  // ============================
  const handleSave = async () => {
    if (!harga) {
      Alert.alert("Validasi", "Field harga wajib diisi!");
      return;
    }

    try {
      setSaving(true);

      const idKey = item.id || item.local_id;

      // 1. Update Database
      await updateLocalPrice(idKey, {
        price: Number(harga),
        unit: satuan,
        synced: 0, // 🔥 wajib → agar avg & list update
        updated_at: new Date().toISOString(),
      });

      // ✅ 2. TRIGGER NOTIFIKASI EDIT (UNGU)
      await pushNotification({
        type: "edit",
        title: "Data Diperbarui",
        message: `Harga ${displayName} berhasil diubah menjadi Rp ${formatRupiah(harga)}.`,
      });

      // 3. Tampilkan Popup Sukses
      setShowSuccessPopup(true);

      setTimeout(() => {
        setShowSuccessPopup(false);
        onGoBack?.(); // 🔥 trigger refresh Detail & DataLocal
        navigation.goBack();
      }, 900);
    } catch (err) {
      console.warn("❌ Gagal update local:", err);
      Alert.alert("Error", "Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ✅ HEADER GRADIENT */}
      <LinearGradient
        colors={["#174A6A", "#0F172A"]} // Warna Gradasi Biru Laut
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Data</Text>
        <View style={{ width: 22 }} />
      </LinearGradient>

      {/* FORM */}
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>Nama Komoditas</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={displayName}
          editable={false}
        />

        <Text style={styles.label}>Kategori</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={
            item.kategori || 
            item.category || 
            "-"
          }
          editable={false}
        />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Harga</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={formatRupiah(harga)}
              onChangeText={(text) =>
                setHarga(text.replace(/[^0-9]/g, ""))
              }
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Satuan</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={satuan}
              editable={false}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.buttonText}>
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.buttonText, { color: "#174A6A" }]}>
            Batal
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* POPUP SUKSES */}
      <Modal transparent visible={showSuccessPopup} animationType="fade">
        <View style={styles.popupOverlay}>
          <View style={styles.popupBox}>
            <Ionicons
              name="checkmark-circle"
              size={64}
              color="#16A34A"
              style={{ marginBottom: 10 }}
            />
            <Text style={styles.popupTitle}>Berhasil Diperbarui!</Text>
            <Text style={styles.popupText}>
              Data diperbarui secara lokal.
            </Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ============================
// STYLES
// ============================
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    // backgroundColor dihapus karena digantikan LinearGradient
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: { padding: 8, marginTop: 24, marginRight: 12 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 24 },
  container: { padding: 22, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: "600", marginTop: 10, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: "#174A6A",
    borderRadius: 10,
    padding: 10,
  },
  disabledInput: { backgroundColor: "#F3F4F6", color: "#6B7280" },
  row: { flexDirection: "row" },
  button: {
    backgroundColor: "#174A6A",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
  cancelButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#174A6A",
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 26,
    width: "80%",
    alignItems: "center",
  },
  popupTitle: { fontSize: 20, fontWeight: "700" },
  popupText: { textAlign: "center", marginTop: 6 },
});