import React from "react";
import { Text, StyleSheet, Image, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient"; 

export default function SplashScreen() {
  return (
    <LinearGradient
      // 🔥 UBAH DISINI: Gradasi dari Biru Brand ke Hitam Pekat
      colors={["#174A6A", "#020b14"]} 
      
      // Menggunakan 3 lokasi untuk transisi yang lebih halus (opsional, tapi lebih bagus)
      // Kalau mau 2 warna saja, cukup hapus locations={...}
      locations={[0.1, 0.9]}

      // Arah gradasi: Dari Atas (Top) ke Bawah (Bottom)
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      
      style={styles.container}
    >
      {/* StatusBar tetap putih ikonnya agar kontras dengan background gelap */}
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Logo */}
      <Image
        source={require("../assets/logo1.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Teks */}
      <Text style={styles.title}>HaKom</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: -5,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 1,
    // Shadow teks diperkuat sedikit agar tidak tenggelam di background gelap
    textShadowColor: 'rgba(0, 0, 0, 0.5)', 
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});