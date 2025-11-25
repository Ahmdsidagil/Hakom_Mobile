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
import BottomNav from "../components/BottomNav";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { userInfo } from "../../config/api";

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState({
    name: "",
    email: "",
    phone: "", // sementara hardcode
    image: "",
    
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        // sementara ambil dari getDashboard karena datanya juga ada di sana
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

  // ✅ Fungsi untuk pindah ke halaman ubah sandi
  const handleUbahKataSandi = () => {
    navigation.navigate("UbahKataSandi"); // Pastikan nama screen di Stack Navigator sama
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: user.image }} style={styles.avatar} />
            <TouchableOpacity style={styles.editIcon}>
              <Ionicons name="pencil" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.info}>
            {user.email} | {user.phone}
          </Text>
        </View>

        {/* ===== MENU ===== */}
        <View style={styles.menu}>
          {/* ✅ Ubah Kata Sandi */}
          <TouchableOpacity style={styles.menuItem} onPress={handleUbahKataSandi}>
            <View style={styles.menuLeft}>
              <Ionicons name="lock-closed-outline" size={20} color="#fff" />
              <Text style={styles.menuText}>Ubah Kata Sandi</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={20} color="#fff" />
          </TouchableOpacity>

          {/* 🚪 Logout */}
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={styles.menuLeft}>
              <Ionicons name="log-out-outline" size={20} color="#fff" />
              <Text style={styles.menuText}>Logout</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ===== BOTTOM NAVIGATION ===== */}
      <BottomNav navigation={navigation} active="Profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { paddingBottom: 90 },

  // ==== HEADER ====
  header: {
    backgroundColor: "#0c3b57",
    alignItems: "center",
    paddingBottom: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  avatarContainer: {
    marginTop: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#fff",
  },
  editIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#003366",
    borderRadius: 15,
    padding: 4,
  },
  name: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 10,
  },
  info: { color: "#fff", fontSize: 12, marginTop: 2 },

  // ==== MENU ====
  menu: { marginTop: 24, paddingHorizontal: 20 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0c3b57",
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    justifyContent: "space-between",
  },
  menuLeft: { flexDirection: "row", alignItems: "center" },
  menuText: { marginLeft: 10, color: "#fff", fontSize: 16 },
});
