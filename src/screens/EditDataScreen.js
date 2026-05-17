// ===============================
// 📱 EditDataScreen.js (FINAL FULL ONLINE + OFFLINE)
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
import { LinearGradient } from "expo-linear-gradient";

import { updateLocalPrice, updatePriceOnline } from "../../config/database";
import { pushNotification } from "../../src/screens/NotificationScreen";

export default function EditDataScreen({ route, navigation }) {
  const params = route?.params || {};
  const item = params.data || params.item || null;
  const onGoBack = params.onGoBack;

  if (!item) {
    return (
      <View style={styles.center}>
        <Text>Data tidak tersedia</Text>
      </View>
    );
  }

useEffect(() => {
  if (item.synced === 1) {
    console.log("ℹ️ Editing server data mode (online update enabled)");
  }
}, []);

  const rawHarga = item.price ?? item.harga ?? item.raw_price ?? "";

  const [harga, setHarga] = useState(
    String(rawHarga).replace(/[^0-9]/g, "")
  );

  const satuan =
    item.unit || item.satuan || item.name_unit || "kg";

  const displayName =
    item.nama_komoditas ||
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
  // HANDLE SAVE (ONLINE + OFFLINE)
  // ============================
  const handleSave = async () => {
    if (!harga) {
      Alert.alert("Validasi", "Field harga wajib diisi!");
      return;
    }

    try {
      setSaving(true);

      const localId = item.id; // ✅ ID SQLite
      const serverId = item.server_id;

      console.log("SERVER ID FINAL:", serverId);

      let isOnlineSuccess = false;

    // ============================
    // 1. ONLINE (kalau ada server_id)
    // ============================
    if (serverId) {
      try {
        await updatePriceOnline(serverId, Number(harga));
        isOnlineSuccess = true;
      } catch (err) {
        console.log("⚠️ Online gagal, fallback ke local:", err.message);
      }
    }

    // ============================
    // 2. UPDATE LOCAL
    // ============================
    await updateLocalPrice(localId, {
      price: Number(harga),
      unit: satuan,
      synced: isOnlineSuccess ? 1 : 0,
      server_id: serverId,
      updated_at: new Date().toISOString(),
    });

    // ============================
    // 3. NOTIF
    // ============================
    await pushNotification({
      type: "edit",
      title: "Data Diperbarui",
      message: `Harga ${displayName} berhasil diubah menjadi Rp ${formatRupiah(harga)}.`,
    });

    setShowSuccessPopup(true);

    setTimeout(() => {
      setShowSuccessPopup(false);
      onGoBack?.();
      navigation.goBack();
    }, 900);

  } catch (err) {
    console.warn("❌ Gagal update:", err);
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
      {/* HEADER */}
      <LinearGradient
        colors={["#174A6A", "#0F172A"]}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
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
          item.finalCategory ||
          item.name_category ||
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
      </ScrollView>

      {/* POPUP SUCCESS */}
      <Modal transparent visible={showSuccessPopup}>
        <View style={styles.popupOverlay}>
          <View style={styles.popupBox}>
            <Ionicons name="checkmark-circle" size={60} color="#16A34A" />
            <Text style={styles.popupTitle}>Berhasil!</Text>
            <Text style={styles.popupText}>
              Data berhasil diperbarui
            </Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ============================
// STYLE (TETAP PUNYAMU)
// ============================
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
   header: {
    // backgroundColor dihapus agar gradasi terlihat
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
  container: { padding: 22, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: "600", marginTop: 10, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: "#174A6A",
    borderRadius: 10,
    padding: 10,
  },
  disabledInput: { backgroundColor: "#F3F4F6" },
  row: { flexDirection: "row" },
  button: {
    backgroundColor: "#174A6A",
    padding: 14,
    borderRadius: 10,
    marginTop: 20,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold" },

  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupBox: {
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 16,
    alignItems: "center",
  },
  popupTitle: { fontSize: 18, fontWeight: "700" },
  popupText: { marginTop: 5 },
});