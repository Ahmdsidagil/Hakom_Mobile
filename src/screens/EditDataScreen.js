import React, { useState } from "react";
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
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function EditDataScreen({ route, navigation }) {
  const { item } = route.params;

  const [harga, setHarga] = useState(item.harga.replace(/[^0-9]/g, ""));
  const [satuan] = useState(item.satuan || "kg");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const handleSave = () => {
    if (!harga) {
      alert("Field harga wajib diisi!");
      return;
    }

    const updatedData = {
      ...item,
      harga: `Rp. ${parseInt(harga).toLocaleString("id-ID")}/${satuan}`,
    };

    console.log("✅ Data berhasil diperbarui:", updatedData);

    // Tampilkan popup sukses
    setShowSuccessPopup(true);

    // Tutup popup dan kembali ke halaman utama setelah 2 detik
    setTimeout(() => {
      setShowSuccessPopup(false);
      navigation.goBack();
    }, 1500);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Data</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* FORM */}
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>Nama Komoditas</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={item.nama}
          editable={false}
        />

        <Text style={styles.label}>Kategori</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={item.kategori}
          editable={false}
        />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Harga</Text>
            <TextInput
              style={styles.input}
              placeholder="Masukkan harga baru"
              keyboardType="numeric"
              value={harga}
              onChangeText={setHarga}
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

        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Simpan Perubahan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.buttonText, { color: "#174A6A" }]}>Batal</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* POPUP SUKSES */}
      <Modal
        transparent
        visible={showSuccessPopup}
        animationType="fade"
        onRequestClose={() => setShowSuccessPopup(false)}
      >
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
              Data komoditas telah berhasil diperbarui.
            </Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
 header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#174A6A",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  backButton: {
    padding: 8,
    marginTop: 24,
    marginRight: 12,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 24,
  },
  container: {
    padding: 22,
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#174A6A",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
  },
  disabledInput: {
    backgroundColor: "#F3F4F6",
    color: "#6B7280",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    backgroundColor: "#174A6A",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#174A6A",
  },

  // --- Popup Styles ---
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
    elevation: 10,
  },
  popupTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  popupText: {
    color: "#4B5563",
    textAlign: "center",
    marginTop: 6,
  },
});
