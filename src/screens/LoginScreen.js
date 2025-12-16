// ===============================
// 📱 LoginScreen.js (FULL FINAL + CATEGORY & UNIT FETCH FIX)
// ===============================
import React, { useState } from "react";
import api, { userInfo } from "../../config/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Peringatan", "Email dan kata sandi harus diisi!");
      return;
    }

    try {
      setLoading(true);

      // ===============================
      // 🔐 LOGIN
      // ===============================
      const response = await fetch(api.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.token) {
        Alert.alert("Gagal", data.message || "Login gagal!");
        setLoading(false);
        return;
      }

      // ===============================
      // 💾 SIMPAN TOKEN
      // ===============================
      await AsyncStorage.setItem("token", data.token);

      // ===============================
      // 👤 AMBIL USER INFO
      // ===============================
      const user = await userInfo(data.token);
      if (user) {
        await AsyncStorage.setItem("user", JSON.stringify(user));
      }

      // ===============================
      // 📦 AMBIL KOMODITAS
      // ===============================
      try {
        const resKomoditas = await fetch(api.COMMODITIES, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${data.token}`,
            "Content-Type": "application/json",
          },
        });

        if (resKomoditas.ok) {
          const komoditas = await resKomoditas.json();
          await AsyncStorage.setItem("commodities", JSON.stringify(komoditas));
        } else {
          console.warn("Fetch commodities gagal:", resKomoditas.status);
        }
      } catch (err) {
        console.warn("Fetch commodities error:", err);
      }

      // ===============================
      // 🔹 AMBIL KATEGORI
      // ===============================
      try {
        const resCategories = await fetch(api.CATEGORIES, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${data.token}`,
            "Content-Type": "application/json",
          },
        });
        if (resCategories.ok) {
          const categories = await resCategories.json();
          await AsyncStorage.setItem("categories", JSON.stringify(categories));
        } else {
          console.warn("Fetch categories gagal:", resCategories.status);
        }
      } catch (err) {
        console.warn("Fetch categories error:", err);
      }

      // ===============================
      // 🔹 AMBIL UNIT (FIXED)
      // ===============================
      try {
        const resUnits = await fetch(api.UNIT, { // <-- perbaikan di sini
          method: "GET",
          headers: {
            Authorization: `Bearer ${data.token}`,
            "Content-Type": "application/json",
          },
        });
        if (resUnits.ok) {
          const units = await resUnits.json();
          await AsyncStorage.setItem("units", JSON.stringify(units));
        } else {
          console.warn("Fetch units gagal:", resUnits.status);
        }
      } catch (err) {
        console.warn("Fetch units error:", err);
      }

      Alert.alert("Sukses", data.message || "Login berhasil");
      navigation.replace("Dashboard");
    } catch (error) {
      console.error("❌ Login error:", error);
      Alert.alert("Error", "Tidak dapat terhubung ke server!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#FFFFFF", "#F3F7FB"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.centerContent}>
            {/* LOGO */}
            <View style={styles.logoContainer}>
              <Image
                source={require("../assets/logo1.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>MASUK</Text>
              <Text style={styles.subtitle}>
                Masukkan email dan kata sandi Anda.
              </Text>
            </View>

            {/* FORM */}
            <View style={styles.form}>
              <TextInput
                placeholder="Alamat Email"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="Kata Sandi"
                  placeholderTextColor="#9CA3AF"
                  style={styles.passwordInput}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleLogin}
                disabled={loading}
              >
                <LinearGradient
                  colors={["#174A6A", "#0B3B53"]}
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>
                    {loading ? "Memproses..." : "Masuk"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  centerContent: {
    width: "85%",
    alignItems: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 35,
  },
  logo: {
    width: 130,
    height: 130,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },
  form: {
    width: "100%",
  },
  input: {
    backgroundColor: "#fff",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    fontSize: 14,
    color: "#111827",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  eyeButton: {
    paddingLeft: 6,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
