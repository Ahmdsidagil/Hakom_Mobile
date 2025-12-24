// src/screens/WelcomeScreen.js
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");
const GAP = 8;
const SIDE_PADDING = 24;
const COL_WIDTH = (width - SIDE_PADDING * 2 - GAP * 2) / 3;

// ✅ Path baru sesuai folder assets di dalam src/
const sampleImages = [
  require("../assets/strawberry.jpg"),
  require("../assets/bawang.jpg"),
  require("../assets/ikan.jpg"),
  require("../assets/sayuran.jpg"),
  require("../assets/jagung.jpeg"),
  require("../assets/daging.jpg"),
  require("../assets/beras.jpg"),
  require("../assets/ikan_tongkol.jpg"),
  require("../assets/telur.jpeg"),
  require("../assets/buah.jpg"),
  require("../assets/gula.jpeg"),
  require("../assets/tahutempe.jpg"),
];

export default function WelcomeScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start();
  }, []);

  const columns = [[], [], []];
  sampleImages.forEach((img, i) => {
    columns[i % 3].push(img);
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* 🖼 Grid gambar */}
      <Animated.View
        style={[
          styles.gridRow,
          {
            opacity: fadeAnim,
            marginTop: 52,
          },
        ]}
      >
        {columns.map((col, colIndex) => (
          <View key={colIndex} style={styles.column}>
            {col.map((imgSource, idx) => {
              const isSpecial =
                imgSource === sampleImages[9] ||
                imgSource === sampleImages[10] ||
                imgSource === sampleImages[11]; // buah, gula, tahu-tempe

              return (
                <View
                  key={idx}
                  style={[
                    styles.imageWrapper,
                    {
                      height: isSpecial
                        ? COL_WIDTH * 1.15
                        : COL_WIDTH * (1 + ((idx + colIndex) % 3) * 0.18),
                    },
                  ]}
                >
                  <Image source={imgSource} style={styles.image} resizeMode="cover" />
                </View>
              );
            })}
          </View>
        ))}
      </Animated.View>

      {/* 🌈 Gradient bawah */}
      <LinearGradient
        colors={[
          "rgba(255,255,255,0)",
          "rgba(245,247,250,0.9)",
          "rgba(245,247,250,1)",
        ]}
        locations={[0.1, 0.65, 1]}
        style={styles.bottomGradient}
      />

      {/* 🧾 Teks dan tombol */}
      <Animated.View style={[styles.textContainer, { opacity: fadeAnim }]}>
        <Text style={styles.title}>Pantau dan Catat Harga Komoditas Pasar</Text>
        <Text style={styles.subtitle}>
          Membantu petugas pasar mencatat harga dengan cepat dan akurat setiap hari.
        </Text>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation?.replace("Login")}
          style={styles.buttonWrapper}
        >
          <LinearGradient
            colors={["#174A6A", "#0B3B53"]}
            start={[0, 0]}
            end={[1, 1]}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Mulai Sekarang</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SIDE_PADDING, // kanan–kiri 24
    width: "100%",
    height: height * 0.56,
  },
  column: {
    width: COL_WIDTH,
  },
  imageWrapper: {
    width: "100%",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
    marginBottom: GAP,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.42,
  },
  textContainer: {
    position: "absolute",
    bottom: 55,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: SIDE_PADDING,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 48,
  },
  buttonWrapper: {
    width: "100%",
  },
  button: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});