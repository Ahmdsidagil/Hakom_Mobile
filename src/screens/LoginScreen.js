import React, { useState } from "react";
import api from "../../config/api";
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Peringatan", "Email dan kata sandi harus diisi!");
      return;
    }

    try {
      const response = await fetch(api.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert("Gagal", data.message || "Login gagal!");
        return;
      }

      // ✅ Simpan token ke AsyncStorage
      if (data.token) {
        await AsyncStorage.setItem('token', data.token);
        console.log('Token disimpan:', data.token);
      } else {
        console.warn('Token tidak ditemukan di respons');
      }

      Alert.alert("Sukses", data.message);
      navigation.replace("Dashboard");
    } catch (error) {
      console.error("Error:", error);
      Alert.alert("Error", "Tidak dapat terhubung ke server!");
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
            {/* LOGO + Teks MASUK */}
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

            {/* FORM LOGIN */}
            <View style={styles.form}>
              {/* Input Email */}
              <TextInput
                placeholder="Alamat Email"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              {/* Input Password */}
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

              {/* Tombol Masuk */}
              <TouchableOpacity activeOpacity={0.9} onPress={handleLogin}>
                <LinearGradient
                  colors={["#174A6A", "#0B3B53"]}
                  style={styles.button}
                  start={[0, 0]}
                  end={[1, 1]}
                >
                  <Text style={styles.buttonText}>Masuk</Text>
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
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
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
