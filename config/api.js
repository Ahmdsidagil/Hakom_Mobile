// ========================================
// 📦 config/api.js (FINAL FIXED – lengkap)
// ========================================

const BASE_URL = "http://103.100.27.57:5100/api"; // ganti sesuai server kamu

export default {
  BASE_URL,

  // 🔐 Auth
  LOGIN: `${BASE_URL}/login-mobile`,
  UPDATE_PASSWORD: `${BASE_URL}/change-password`,

  // 📦 Master Data
  CATEGORIES: `${BASE_URL}/categories`,
  COMMODITIES: `${BASE_URL}/commodities`,
  GET_MARKET: `${BASE_URL}/markets`,
  UNIT: `${BASE_URL}/units`,

  // 📊 Harga (single input)
  ADD_PRICE: `${BASE_URL}/sync/price`, // ini endpoint single harga

  // 📡 Batch sync offline → server
  SYNC_PRICES: `${BASE_URL}/sync`,

  // ⬇ Restore semua harga (server → lokal)
  // --- INI YANG PENTING ---
  PRICE_ALL: `${BASE_URL}/price/all`,

  // 📡 Endpoin lama (dipakai DetailHargaScreen & DataLocal)
  PRICE: `${BASE_URL}/prices`,
};

// ==============================
// 🔐 Ambil info dashboard
// ==============================
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

// ==============================
// 🔐 Ubah password
// ==============================
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

    // sebelum parse, cek raw text
    const text = await response.text();
    console.log("Response raw dari server:", text);

    return JSON.parse(text);
  } catch (error) {
    console.error("❌ API updatePassword error:", error);
    return { success: false, message: "Koneksi ke server gagal" };
  }
};
