// ===============================
// 📱 LoginScreen.js (FULL FINAL + MODERN NOTIFICATION)
// ===============================
import React, { useState, useRef, useEffect } from "react";
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
  Animated, // Import Animated
  Dimensions
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 🔔 STATE & REF UNTUK NOTIFIKASI MODERN
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success"); // success | error
  const slideAnim = useRef(new Animated.Value(-100)).current; // Posisi awal di atas layar (tersembunyi)

  // FUNGSI MENAMPILKAN NOTIFIKASI
  const showToast = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);

    // Animasi Masuk (Slide Down)
    Animated.spring(slideAnim, {
      toValue: 50, // Posisi Y saat muncul
      useNativeDriver: true,
      friction: 5,
    }).start();

    // Sembunyikan otomatis setelah 2.5 detik (kecuali sukses login akan dihandle manual)
    if (type !== "success") {
        setTimeout(() => hideToast(), 3500);
    }
  };

  const hideToast = () => {
    Animated.timing(slideAnim, {
      toValue: -100, // Kembali ke atas
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showToast("Email dan kata sandi harus diisi!", "error");
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
        showToast(data.message || "Login gagal!", "error");
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
        await AsyncStorage.setItem("user_name", user.user_name || "User"); // 🔥 pakai field user_name
      }

      // ===============================
      // 📦 DATA FETCHING (BACKGROUND)
      // ===============================
      try {
        const resKomoditas = await fetch(api.COMMODITIES, {
          method: "GET",
          headers: { Authorization: `Bearer ${data.token}`, "Content-Type": "application/json" },
        });
        if (resKomoditas.ok) {
          const komoditas = await resKomoditas.json();
          await AsyncStorage.setItem("commodities", JSON.stringify(komoditas));
        }
      } catch (err) { console.warn("Fetch comms err"); }

      try {
        const resCategories = await fetch(api.CATEGORIES, {
            method: "GET",
            headers: { Authorization: `Bearer ${data.token}`, "Content-Type": "application/json" },
        });
        if (resCategories.ok) {
            const categories = await resCategories.json();
            await AsyncStorage.setItem("categories", JSON.stringify(categories));
        }
      } catch (err) { console.warn("Fetch cat err"); }

      try {
        const resUnits = await fetch(api.UNIT, {
            method: "GET",
            headers: { Authorization: `Bearer ${data.token}`, "Content-Type": "application/json" },
        });
        if (resUnits.ok) {
            const units = await resUnits.json();
            await AsyncStorage.setItem("units", JSON.stringify(units));
        }
      } catch (err) { console.warn("Fetch unit err"); }

      // ✅ SUKSES LOGIN MODERN
      const userName = user.user_name || "User";
      showToast(`Selamat datang, ${userName}!`, "success");


      
      // Beri jeda sedikit agar notifikasi terlihat sebelum pindah layar
      setTimeout(() => {
        navigation.replace("Dashboard");
      }, 1500);

    } catch (error) {
      console.error("❌ Login error:", error);
      showToast("Tidak dapat terhubung ke server!", "error");
    } finally {
      // Loading dimatikan di setTimeout sukses atau langsung jika error
      if (toastType !== "success") setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#FFFFFF", "#F3F7FB"]} style={styles.container}>
      
      {/* 🔔 CUSTOM TOAST NOTIFICATION COMPONENT */}
      <Animated.View 
        style={[
            styles.toastContainer, 
            { transform: [{ translateY: slideAnim }] },
            toastType === "error" ? styles.toastError : styles.toastSuccess
        ]}
      >
        <Ionicons 
            name={toastType === "success" ? "checkmark-circle" : "alert-circle"} 
            size={24} 
            color="#fff" 
        />
        <View style={{marginLeft: 10, flex: 1}}>
            <Text style={styles.toastTitle}>
                {toastType === "success" ? "Berhasil Masuk" : "Gagal"}
            </Text>
            <Text style={styles.toastMessage}>{toastMessage}</Text>
        </View>
      </Animated.View>

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
  
  // TOAST STYLES
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 100,
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10,
  },
  toastSuccess: {
    backgroundColor: "#10B981", // Hijau Modern
  },
  toastError: {
    backgroundColor: "#EF4444", // Merah Modern
  },
  toastTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  toastMessage: {
    color: '#E5E7EB',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500'
  },

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