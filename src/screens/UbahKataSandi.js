import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updatePassword } from "../../config/api"; // pastikan fungsi ini benar

export default function UbahKataSandiScreen({ navigation }) {
  const [sandiLama, setSandiLama] = useState("");
  const [sandiBaru, setSandiBaru] = useState("");
  const [konfirmasiSandi, setKonfirmasiSandi] = useState("");

  const [showLama, setShowLama] = useState(false);
  const [showBaru, setShowBaru] = useState(false);
  const [showKonfirmasi, setShowKonfirmasi] = useState(false);

  // 🔹 Saat user menekan tombol "Simpan"
  const handleSimpan = async () => {
    if (!sandiLama || !sandiBaru || !konfirmasiSandi) {
      Alert.alert("Peringatan", "Harap isi semua kolom sandi!");
      return;
    }

    if (sandiBaru !== konfirmasiSandi) {
      Alert.alert("Kesalahan", "Konfirmasi sandi tidak cocok!");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Gagal", "Token tidak ditemukan. Silakan login ulang.");
        return;
      }

      // 🔹 Panggil API ke server
      const res = await updatePassword(token, sandiLama, sandiBaru);

      if (res && res.success) {
        Alert.alert("Berhasil", "Kata sandi berhasil diubah!", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert("Gagal", res.message || "Gagal mengubah kata sandi.");
      }
    } catch (err) {
      console.error("❌ Error ubah sandi:", err);
      Alert.alert("Error", "Terjadi kesalahan saat mengubah sandi.");
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#174A6A", "#0B3B53"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ubah Kata Sandi</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      {/* Body */}
      <View style={styles.body}>
        {/* Sandi lama */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Masukkan Sandi Lama</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showLama}
              value={sandiLama}
              onChangeText={setSandiLama}
            />
            <TouchableOpacity onPress={() => setShowLama(!showLama)}>
              <Ionicons
                name={showLama ? "eye-off-outline" : "eye-outline"}
                size={22}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sandi baru */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Masukkan Sandi Baru</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showBaru}
              value={sandiBaru}
              onChangeText={setSandiBaru}
            />
            <TouchableOpacity onPress={() => setShowBaru(!showBaru)}>
              <Ionicons
                name={showBaru ? "eye-off-outline" : "eye-outline"}
                size={22}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Konfirmasi sandi baru */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Konfirmasi Sandi Baru</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showKonfirmasi}
              value={konfirmasiSandi}
              onChangeText={setKonfirmasiSandi}
            />
            <TouchableOpacity
              onPress={() => setShowKonfirmasi(!showKonfirmasi)}
            >
              <Ionicons
                name={showKonfirmasi ? "eye-off-outline" : "eye-outline"}
                size={22}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tombol Simpan */}
        <TouchableOpacity style={styles.btnSimpan} onPress={handleSimpan}>
          <Text style={styles.btnText}>Simpan</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: { paddingTop: 40, paddingBottom: 20, paddingHorizontal: 20 },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 25 },
  inputContainer: { marginBottom: 18 },
  label: {
    fontSize: 14,
    color: "#111827",
    marginBottom: 6,
    fontWeight: "500",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 10,
  },
  input: { flex: 1, height: 42, color: "#111827" },
  btnSimpan: {
    backgroundColor: "#174A6A",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});