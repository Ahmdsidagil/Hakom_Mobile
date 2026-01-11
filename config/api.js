// ========================================
// 📦 config/api.js
// ========================================

const BASE_URL = "http://103.100.27.57:5100/api";

export default {
  BASE_URL,

  // 🔐 Auth
  LOGIN: `${BASE_URL}/login-mobile`,
  UPDATE_PASSWORD: `${BASE_URL}/change-password`,
  USER_INFO: `${BASE_URL}/userinfo`,

  // 📦 Master Data
  CATEGORIES: `${BASE_URL}/categories`,
  COMMODITIES: `${BASE_URL}/commodities`,
  GET_MARKET: `${BASE_URL}/markets`,
  UNIT: `${BASE_URL}/units`,

  // 📊 Harga (Operations)
  ADD_PRICE: `${BASE_URL}/sync/price`,     // Input single
  SYNC_PRICES: `${BASE_URL}/sync`,         // Batch sync
  
  // ⬇️ Restore & History
  PRICE_ALL: `${BASE_URL}/price/all`,
  PRICE_DETAIL: `${BASE_URL}/prices/detail`,

  // 📡 Endpoint Lainnya
  PRICE: `${BASE_URL}/prices`,

  // ✅ TAMBAHAN SAJA (TIDAK MENGUBAH YANG LAIN)
  HISTORY_BY_USER: `${BASE_URL}/price/history`,
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

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    return await response.json();
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

    const text = await response.text();
    console.log("Response raw dari server:", text);

    return JSON.parse(text);
  } catch (error) {
    console.error("❌ API updatePassword error:", error);
    return { success: false, message: "Koneksi ke server gagal" };
  }
};
