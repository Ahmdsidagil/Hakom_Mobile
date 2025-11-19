// config/api.js
const BASE_URL = "http://103.100.27.57:5100/api"; // ganti IP sesuai server kamu

export default {
  BASE_URL,
  LOGIN: `${BASE_URL}/login-mobile`,
  CATEGORIES: `${BASE_URL}/categories`,
  COMMODITIES: `${BASE_URL}/commodities`,
  ADD_PRICE: `${BASE_URL}/sync/price`,
  SYNC_PRICES: `${BASE_URL}/sync`,
  UPDATE_PASSWORD: `${BASE_URL}/change-password`,
  GET_MARKET: `${BASE_URL}/markets`,
};

// Ambil data dashboard
export const userInfo = async (token) => {
  try {
    const response = await fetch(`${BASE_URL}/userinfo`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("❌ Gagal ambil dashboard:", err);
    return null;
  }
};

// 🔐 Fungsi ubah kata sandi
export const updatePassword = async (token, oldPassword, newPassword) => {
  try {
    const response = await fetch(`${BASE_URL}/change-password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ oldPassword, newPassword }),
    });

    // sebelum parse, cek status
    const text = await response.text();
    console.log("Response raw dari server:", text);

    return JSON.parse(text);
  } catch (error) {
    console.error("❌ API updatePassword error:", error);
    return { success: false, message: "Koneksi ke server gagal" };
  }
};