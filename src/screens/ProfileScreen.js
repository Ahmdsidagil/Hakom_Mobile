// ============================
// 👤 ProfileScreen.js
// ============================
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient"; // ✅ Import Gradasi
import AsyncStorage from "@react-native-async-storage/async-storage";
import { userInfo } from "../../config/api";
import BottomNav from "../components/BottomNav";

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState({
    name: "",
    email: "",
    phone: "", 
    image: "",
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        const data = await userInfo(token);

        if (data && data.success) {
          setUser((prev) => ({
            ...prev,
            name: data.user_name || "Petugas Pasar",
            email: data.user_email || "email@tidakdiketahui.com",
            phone: data.user_phone || "081234567890",
            image: data.user_image || "https://cdn-icons-png.flaticon.com/512/4140/4140037.png",
          }));
        }
      } catch (err) {
        console.error("❌ Gagal ambil data user:", err);
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = () => {
    Alert.alert("Konfirmasi Logout", "Apakah Anda yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("token");
          navigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
          });
        },
      },
    ]);
  };

  const handleUbahKataSandi = () => {
    navigation.navigate("UbahKataSandi");
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HEADER GRADIENT ===== */}
        <LinearGradient
          colors={["#174A6A", "#0F172A"]} // ✅ Warna Gradasi sesuai tema
          style={styles.header}
        >
          <View style={styles.avatarContainer}>
            <Image source={{ uri: user.image }} style={styles.avatar} />
            {/* ❌ Ikon Pensil Dihapus di sini */}
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.info}>
            {user.email} | {user.phone}
          </Text>
        </LinearGradient>

        {/* ===== MENU ===== */}
        <View style={styles.menu}>
          {/* ✅ Ubah Kata Sandi (Gradient Button) */}
          <TouchableOpacity onPress={handleUbahKataSandi} activeOpacity={0.8}>
            <LinearGradient
              colors={["#2C6E91", "#174A6A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.menuItem}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="lock-closed-outline" size={20} color="#fff" />
                <Text style={styles.menuText}>Ubah Kata Sandi</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          {/* 🚪 Logout (Gradient Button) */}
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.8}>
            <LinearGradient
              colors={["#ef4444", "#991b1b"]} // Merah gradasi untuk Logout
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.menuItem}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="log-out-outline" size={20} color="#fff" />
                <Text style={styles.menuText}>Logout</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ===== BOTTOM NAVIGATION ===== */}
      <BottomNav navigation={navigation} active="Profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { paddingBottom: 90 },

  // ==== HEADER ====
  header: {
    paddingTop: 60, // Tambah padding atas agar tidak nabrak status bar
    alignItems: "center",
    paddingBottom: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  avatarContainer: {
    marginBottom: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.3)", // Efek border transparan
  },
  name: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 5,
  },
  info: { 
    color: "#cbd5e1", 
    fontSize: 13, 
    marginTop: 4,
    fontWeight: "500" 
  },

  // ==== MENU ====
  menu: { marginTop: 30, paddingHorizontal: 20 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuLeft: { flexDirection: "row", alignItems: "center" },
  menuText: { marginLeft: 12, color: "#fff", fontSize: 16, fontWeight: "600" },
});