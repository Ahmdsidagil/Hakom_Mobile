// ====================================
// 📦 database.js (TOTAL FINAL - Expo 54)
// ====================================

import * as SQLite from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system/legacy";
import api from "./api";

let db = null;
let netListenerAdded = false;
let restoreInProgress = false;
let isSyncing = false;

const syncedHistoryCache = new Set();

// ==============================
// DB INIT
// ==============================

const openDb = () => {
  if (db) return db;
  db = SQLite.openDatabaseSync("local_market.db");
  return db;
};

export const initDatabase = async () => {
  const dbInst = openDb();
  await dbInst.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS categories (id_category INTEGER PRIMARY KEY, name_category TEXT, image TEXT, local_image TEXT);
    CREATE TABLE IF NOT EXISTS commodities (id_commodity INTEGER PRIMARY KEY, name_commodity TEXT, category_id INTEGER, category_name TEXT, unit_id INTEGER, image TEXT, local_image TEXT);
    CREATE TABLE IF NOT EXISTS markets (id_market INTEGER PRIMARY KEY, name_market TEXT, address TEXT, status TEXT, description TEXT, opening_hours TEXT, maps_link TEXT, image TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS units (id INTEGER PRIMARY KEY, name_unit TEXT);
    CREATE TABLE IF NOT EXISTS local_prices (id INTEGER PRIMARY KEY AUTOINCREMENT, server_id INTEGER, commodity_id INTEGER, category_id INTEGER, user_id INTEGER, market_id INTEGER, price REAL, unit TEXT, date TEXT, synced INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS riwayat_hapus (id INTEGER PRIMARY KEY AUTOINCREMENT, name_commodity TEXT, price REAL, unit TEXT, name_category TEXT, tanggal TEXT);
    CREATE TABLE IF NOT EXISTS riwayat_pendataan (id INTEGER PRIMARY KEY AUTOINCREMENT, name_commodity TEXT, price REAL, unit TEXT, name_category TEXT, tanggal TEXT, image TEXT);
  `);

  if (!netListenerAdded) {
    NetInfo.addEventListener(async (state) => {
      const online = state.isInternetReachable ?? state.isConnected;
      if (online && !isSyncing) await syncPricesToServer();
    });
    netListenerAdded = true;
  }
};

export const getDatabase = async () => {
  if (!db) await initDatabase();
  return db;
};

// ====================================
// 🛠️ HELPERS & IMAGES
// ====================================

const safeParseJson = async (res) => {
  try { const text = await res.text(); return text ? JSON.parse(text.trim()) : null; }
  catch (e) { throw e; }
};

export const ensureFullImageUrl = (maybeImage) => {
  if (!maybeImage || maybeImage.startsWith("http")) return maybeImage;
  const base = api.BASE_URL ? api.BASE_URL.replace(/\/$/, "") : "";
  return `${base}/storage/commodity_images/${maybeImage}`;
};

export const downloadImage = async (url, filename) => {
  if (!url || !filename) return null;
  try {
    const dir = `${FileSystem.cacheDirectory}images/`;
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const localUri = dir + filename;
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) return localUri;
    const { uri } = await FileSystem.downloadAsync(url, localUri);
    return uri;
  } catch (e) { return null; }
};

export const getImageForCommodityByName = async (commodityName) => {
  const dbInst = await getDatabase();
  const row = await dbInst.getFirstAsync(`SELECT local_image, image FROM commodities WHERE name_commodity = ? LIMIT 1;`, [commodityName]);
  return row?.local_image || row?.image || null;
};

// ====================================
// 🔄 SERVER SYNC ACTIONS
// ====================================

export const syncFromServer = async () => {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) return;
    const dbInst = await getDatabase();
    const endpoints = { categories: api.CATEGORIES, commodities: api.COMMODITIES, markets: api.GET_MARKET, units: api.UNIT };

    for (const [key, url] of Object.entries(endpoints)) {
      if (!url) continue;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) continue;
      const parsed = await safeParseJson(res);
      const data = Array.isArray(parsed?.data) ? parsed.data : (Array.isArray(parsed) ? parsed : []);
      if (!data.length) continue;

      await dbInst.runAsync(`DELETE FROM ${key === 'units' ? 'units' : key};`);
      for (const it of data) {
        if (key === "categories") {
          await dbInst.runAsync(`INSERT OR REPLACE INTO categories (id_category, name_category, image) VALUES (?, ?, ?);`, [it.id_category || it.id, it.name_category || it.name, it.image]);
        } else if (key === "units") {
          await dbInst.runAsync(`INSERT OR REPLACE INTO units (id, name_unit) VALUES (?, ?);`, [it.id, it.name_unit || it.name]);
        } else if (key === "commodities") {
          const img = ensureFullImageUrl(it.image || it.image_url || it.photo);
          const loc = img ? await downloadImage(img, img.split("/").pop()) : null;
          await dbInst.runAsync(`INSERT OR REPLACE INTO commodities (id_commodity, name_commodity, category_id, category_name, unit_id, image, local_image) VALUES (?, ?, ?, ?, ?, ?, ?);`, [it.id_commodity || it.id, it.name_commodity || it.name, it.category_id, it.category_name, it.unit_id, img, loc]);
        } else if (key === "markets") {
          await dbInst.runAsync(`INSERT OR REPLACE INTO markets (id_market, name_market, address, status, description, opening_hours, maps_link, image, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`, [it.id_market || it.id, it.name_market, it.address, it.status, it.description, it.opening_hours, it.maps_link, it.image, it.created_at, it.updated_at]);
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    isSyncing = false;
  }
};

// ====================================
// 📊 READ QUERIES (DIPAKAI DI SCREEN)
// ====================================

export const getAllLocalPrices = async () => {
  const dbInst = await getDatabase();
  return await dbInst.getAllAsync(`
    SELECT 
      p.*,
      co.name_commodity,
      co.image as commodity_static_image,
      co.local_image,
      c.name_category
    FROM local_prices p
    LEFT JOIN commodities co 
      ON p.commodity_id = co.id_commodity
    LEFT JOIN categories c 
      ON co.category_id = c.id_category
    ORDER BY p.created_at DESC
  `);
};

export const getLocalPricesForScreen = async (catId = null, comId = null) => {
  const dbInst = await getDatabase();

  let sql = `
    SELECT
      p.*,
      co.name_commodity,
      c.name_category,
      u.name_unit,
      m.name_market
    FROM local_prices p
    LEFT JOIN commodities co
      ON p.commodity_id = co.id_commodity
    LEFT JOIN categories c
      ON p.category_id = c.id_category
    LEFT JOIN units u
      ON co.unit_id = u.id
    LEFT JOIN markets m
      ON p.market_id = m.id_market
    WHERE 1=1
  `;

  const params = [];

  if (catId) {
    sql += ` AND p.category_id = ?`;
    params.push(catId);
  }

  if (comId) {
    sql += ` AND p.commodity_id = ?`;
    params.push(comId);
  }

  sql += ` ORDER BY p.created_at DESC`;

  return await dbInst.getAllAsync(sql, params);
};

export const getCategories = async () => {
  const dbInst = await getDatabase();
  return await dbInst.getAllAsync(`SELECT * FROM categories;`);
};

export const getCommoditiesByCategory = async (id) => {
  const dbInst = await getDatabase();
  return await dbInst.getAllAsync(`SELECT id_commodity, name_commodity AS name, image, local_image, unit_id, category_id FROM commodities WHERE category_id = ?;`, [id]);
};

export const getDashboardStats = async () => {
  const dbInst = await getDatabase();
  const res = await dbInst.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN synced=0 THEN 1 ELSE 0 END) as offline, SUM(CASE WHEN synced=1 THEN 1 ELSE 0 END) as online FROM local_prices;`);
  return { total: res?.total || 0, offline: res?.offline || 0, online: res?.online || 0 };
};

export const getLatestPrices = async (limit = 20) => {
  const dbInst = await getDatabase();
  return await dbInst.getAllAsync(`SELECT p.*, co.name_commodity, c.name_category, m.name_market FROM local_prices p LEFT JOIN commodities co ON p.commodity_id = co.id_commodity LEFT JOIN categories c ON p.category_id = c.id_category LEFT JOIN markets m ON p.market_id = m.id_market ORDER BY p.created_at DESC LIMIT ?;`, [limit]);
};

export const countUniqueCommodities = async () => {
  const dbInst = await getDatabase();
  const res = await dbInst.getFirstAsync(`SELECT COUNT(DISTINCT commodity_id) as total FROM local_prices;`);
  return res?.total || 0;
};

export const getDetailHargaForScreen = async (commodityId, dateStr) => {
  const dbInst = await getDatabase();
  return await dbInst.getAllAsync(
    `SELECT 
        p.*, 
        co.name_commodity,  
        co.image,
        co.local_image, 
        u.name_unit AS master_unit,
        c.name_category AS kategori_nama
     FROM local_prices p 
     LEFT JOIN commodities co ON p.commodity_id = co.id_commodity
     LEFT JOIN units u ON co.unit_id = u.id 
     LEFT JOIN categories c ON co.category_id = c.id_category
     WHERE p.commodity_id = ? AND p.date = ?
     ORDER BY p.synced ASC, p.created_at DESC`,
    [commodityId, dateStr]
  );
};

export const getDashboardHistoryLocal = async (limit = 10) => {
  const dbInst = await getDatabase();
  return await dbInst.getAllAsync(`
    SELECT 
      id_price,
      commodity_name,
      category_name,
      unit_name,
      price,
      created_at,
      image,
      synced
    FROM local_prices
    ORDER BY created_at DESC
    LIMIT ?
  `, [limit]);
};

export const syncPriceHistoryFromServer = async (commodityId, dateStr) => {
  const cacheKey = `${commodityId}_${dateStr}`;

  // 🚫 CEGAH SYNC ULANG (Race Condition Protection)
  if (syncedHistoryCache.has(cacheKey)) {
    console.log("⏭️ Skip sync, processing/already synced:", cacheKey);
    return;
  }

  // ✅ KUNCI LANGSUNG (Optimistic Locking)
  syncedHistoryCache.add(cacheKey);

  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      syncedHistoryCache.delete(cacheKey);
      return;
    }

    const baseUrl = api.BASE_URL.replace(/\/$/, "");
    const url = `${baseUrl}/price/commodity/${commodityId}?date=${dateStr}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    const items = json?.data || [];

    const dbInst = await getDatabase();

    await dbInst.withTransactionAsync(async () => {
      for (const it of items) {
        // ✅ PERBAIKAN: gunakan id_price || id
        const serverId = it.id_price || it.id;

        const existing = await dbInst.getFirstAsync(
          `SELECT id FROM local_prices WHERE server_id = ? LIMIT 1`,
          [serverId]
        );

        if (existing) {
          // ✅ UPDATE saja, tidak buat baris baru
          await dbInst.runAsync(
            `UPDATE local_prices 
             SET price = ?, unit = ?, date = ?, synced = 1, created_at = ?
             WHERE server_id = ?`,
            [
              it.price,
              it.unit_name || it.unit,
              dateStr,
              it.created_at || new Date().toISOString(),
              serverId
            ]
          );
        } else {
          // ✅ INSERT hanya kalau belum ada
          await dbInst.runAsync(
            `INSERT INTO local_prices
             (commodity_id, price, unit, date, created_at, synced, server_id)
             VALUES (?, ?, ?, ?, ?, 1, ?)`,
            [
              commodityId,
              it.price,
              it.unit_name || it.unit,
              dateStr,
              it.created_at || new Date().toISOString(),
              serverId
            ]
          );
        }
      }
    });

    console.log(`✅ Sync detail OK: ${cacheKey} (Items: ${items.length})`);
  } catch (e) {
    console.error("❌ Sync Riwayat Error:", e);
    // ⚠️ PENTING: Jika error, buka kunci supaya bisa dicoba lagi nanti
    syncedHistoryCache.delete(cacheKey);
  }
};

export const syncAllPricesByDate = async (dateStr) => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) return;

    const url = `${api.BASE_URL.replace(/\/$/, "")}/api/prices?date=${dateStr}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    const items = json.data || [];

    if (items.length > 0) {
      const dbInst = await getDatabase();

      await dbInst.withTransactionAsync(async () => {
        await dbInst.runAsync(
          `DELETE FROM local_prices WHERE date = ? AND synced = 1`,
          [dateStr]
        );

        for (const it of items) {
          await dbInst.runAsync(
            `INSERT INTO local_prices (commodity_id, price, unit, date, created_at, synced, server_id) 
             VALUES (?, ?, ?, ?, ?, 1, ?)`,
            [
              it.commodity_id,
              it.average_price,
              it.unit_name,
              it.date,
              it.created_at || new Date().toISOString(),
              it.id
            ]
          );
        }
      });

      console.log(`✅ Berhasil sinkron ${items.length} komoditas untuk tanggal ${dateStr}`);
    }
  } catch (e) {
    console.error("❌ Error syncAllPricesByDate:", e);
  }
};

// ==============================
// ADD PRICE
// ==============================

export const addPrice = async (comId, catId, price) => {
  const dbInst = await getDatabase();
  const token = await AsyncStorage.getItem("token");
  const userId = Number(await AsyncStorage.getItem("user_id"));
  const marketId = Number(await AsyncStorage.getItem("market_id"));

  // 🔥 Ambil tanggal lokal device
  const nowObj = new Date();
  const year = nowObj.getFullYear();
  const month = String(nowObj.getMonth() + 1).padStart(2, '0');
  const day = String(nowObj.getDate()).padStart(2, '0');
  const dateOnly = `${year}-${month}-${day}`;
  const now = nowObj.toISOString();

  const comm = await dbInst.getFirstAsync(
    `SELECT name_commodity, unit_id FROM commodities WHERE id_commodity = ?`,
    [comId]
  );

  const unit =
    (await dbInst.getFirstAsync(
      `SELECT name_unit FROM units WHERE id = ?`,
      [comm?.unit_id]
    ))?.name_unit || "pcs";

  // ✅ HAPUS pengecekan existing — selalu INSERT baru
  // Karena market_id = 0 untuk semua, tidak bisa jadi pembeda
  // Duplikasi dicegah oleh syncPriceHistoryFromServer via server_id

  let synced = 0;

  try {
    const state = await NetInfo.fetch();
    if ((state.isInternetReachable ?? state.isConnected) && token) {
      const res = await fetch(api.ADD_PRICE, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          commodity_id: comId,
          user_id: userId,
          market_id: marketId,
          price,
          date: dateOnly,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const serverId = json?.data?.id_price || json?.data?.id || json?.id_price || json?.id || null;
        synced = 1;

        await dbInst.runAsync(
          `INSERT INTO local_prices 
            (commodity_id, category_id, user_id, market_id, price, unit, date, created_at, synced, server_id)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [comId, catId, userId, marketId, price, unit, dateOnly, now, synced, serverId]
        );

        await addRiwayatPendataan({
          name_commodity: comm?.name_commodity,
          price,
          unit,
          name_category: null,
          tanggal: now,
        });

      } else {
        // Online tapi server error → simpan offline
        await dbInst.runAsync(
          `INSERT INTO local_prices 
            (commodity_id, category_id, user_id, market_id, price, unit, date, created_at, synced)
            VALUES (?,?,?,?,?,?,?,?,?)`,
          [comId, catId, userId, marketId, price, unit, dateOnly, now, 0]
        );
      }
    } else {
      // Offline → simpan tanpa server_id
      await dbInst.runAsync(
        `INSERT INTO local_prices 
          (commodity_id, category_id, user_id, market_id, price, unit, date, created_at, synced)
          VALUES (?,?,?,?,?,?,?,?,?)`,
        [comId, catId, userId, marketId, price, unit, dateOnly, now, 0]
      );
    }
  } catch (e) {
    // Error jaringan → fallback insert offline
    await dbInst.runAsync(
      `INSERT INTO local_prices 
        (commodity_id, category_id, user_id, market_id, price, unit, date, created_at, synced)
        VALUES (?,?,?,?,?,?,?,?,?)`,
      [comId, catId, userId, marketId, price, unit, dateOnly, now, 0]
    );
  }

  return { ok: synced === 1 };
};

export const updateLocalPrice = async (id, data) => {
  const dbInst = await getDatabase();

  const fields = []; const params = [];
  if (data.price !== undefined) { fields.push("price = ?"); params.push(data.price); }
  if (data.unit !== undefined) { fields.push("unit = ?"); params.push(data.unit); }
  if (data.synced !== undefined) { fields.push("synced = ?"); params.push(data.synced); }
  if (data.server_id !== undefined) {
    fields.push("server_id = ?");
    params.push(data.server_id);
  }
  fields.push("updated_at = ?"); params.push(new Date().toISOString());
  params.push(id);

  // Hanya UPDATE, tidak INSERT riwayat di sini
  await dbInst.runAsync(`UPDATE local_prices SET ${fields.join(", ")} WHERE id = ?;`, params);
};

// deleteLocalPrice tetap seperti punya kamu (TIDAK DIUBAH)
export const deleteLocalPrice = async (id, itemData = null) => {
  const dbInst = await getDatabase();

  if (itemData) {
    await addRiwayatHapus({
      name_commodity: itemData.name_commodity,
      price: itemData.price,
      unit: itemData.unit,
      name_category: itemData.name_category,
      tanggal: new Date().toISOString()
    });
  }

  await dbInst.runAsync(`DELETE FROM local_prices WHERE id = ?;`, [id]);
};

// Edit Data Online
export const updatePriceOnline = async (id, price) => {
  const token = await AsyncStorage.getItem("token");

  const res = await fetch(`${api.BASE_URL}/price/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ price }),
  });

  const text = await res.text();
  console.log("🌐 RAW RESPONSE:", text);

  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    throw new Error("Response bukan JSON (kemungkinan error server)");
  }

  if (!res.ok) {
    throw new Error(json?.message || "Gagal update server");
  }

  return json;
};

// ====================================
// 📥 RESTORE & RIWAYAT
// ====================================
export const restoreAllPricesFromServer = async (selectedDate) => {
  if (restoreInProgress) return;
  restoreInProgress = true;

  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) return;

    const dbInst = await getDatabase();

    const res = await fetch(
      `${api.BASE_URL.replace(/\/$/, "")}/price/all?date=${selectedDate}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) throw new Error("Gagal mengambil data dari server");

    const json = await res.json();
    const items = json?.data || [];

    await dbInst.withTransactionAsync(async () => {
      await dbInst.runAsync(
        `DELETE FROM local_prices WHERE date = ? AND synced = 1`,
        [selectedDate]
      );

      for (const it of items) {
        await dbInst.runAsync(
          `INSERT INTO local_prices
           (commodity_id, price, unit, date, created_at, synced, server_id)
           VALUES (?, ?, ?, ?, ?, 1, ?)`,
          [
            it.commodity_id,
            it.price || it.average_price,
            it.unit_name || it.unit,
            selectedDate,
            it.created_at || new Date().toISOString(),
            it.id
          ]
        );
      }
    });

    return { restored: items.length };
  } catch (e) {
    console.error("❌ Restore Error:", e);
  } finally {
    restoreInProgress = false;
  }
};

export const syncPricesToServer = async () => {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const dbInst = await getDatabase();
    const token = await AsyncStorage.getItem("token");

    const unsynced = await dbInst.getAllAsync(`
      SELECT 
        p.*,
        co.name_commodity,
        c.name_category
      FROM local_prices p
      LEFT JOIN commodities co 
        ON p.commodity_id = co.id_commodity
      LEFT JOIN categories c 
        ON co.category_id = c.id_category
      WHERE p.synced = 0
    `);

    if (!token || unsynced.length === 0) return;

    for (const item of unsynced) {
      let res;
      let json = null;

      // ====================================
      // UPDATE DATA YANG SUDAH ADA DI SERVER
      // ====================================
      if (item.server_id) {
        console.log("✏️ UPDATE SERVER:", item.server_id);

        res = await fetch(
          `${api.BASE_URL}/price/${item.server_id}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ price: item.price }),
          }
        );
      } else {
        // ====================================
        // INSERT DATA BARU KE SERVER
        // ====================================
        console.log("➕ INSERT SERVER");

        res = await fetch(api.ADD_PRICE, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            commodity_id: item.commodity_id,
            user_id: item.user_id,
            market_id: item.market_id,
            price: item.price,
            date: item.date,
          }),
        });
      }

      // ====================================
      // HANDLE RESPONSE
      // ====================================
      const text = await res.text();
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        console.log("⚠️ Response bukan JSON:", text);
      }

      if (res.ok) {
        // ✅ PERBAIKAN: ambil server_id dari response
        const newServerId =
          item.server_id ||
          json?.data?.id_price ||
          json?.data?.id ||
          json?.id_price ||
          json?.id ||
          null;

        console.log("🔥 SERVER ID FINAL:", newServerId);

        // 1️⃣ CATAT RIWAYAT
        await addRiwayatPendataan({
          name_commodity: item.name_commodity,
          price: item.price,
          unit: item.unit,
          name_category: item.name_category,
          tanggal: item.date,
        });

        // 2️⃣ TANDAI SYNCED + SIMPAN SERVER_ID ✅
        await dbInst.runAsync(
          `UPDATE local_prices
           SET synced = 1,
               server_id = ?,
               updated_at = ?
           WHERE id = ?`,
          [newServerId, new Date().toISOString(), item.id]
        );

        console.log("✅ Sync sukses:", item.id);
      } else {
        console.log("❌ Sync gagal:", res.status, json);
      }
    }
  } catch (e) {
    console.error("❌ Sync Error:", e);
  } finally {
    isSyncing = false;
  }
};

// ====================================
// 📋 FUNGSI RIWAYAT
// ====================================

export const getAllRiwayatPendataan = async () => {
  const dbInst = await getDatabase();
  return await dbInst.getAllAsync(`SELECT * FROM riwayat_pendataan ORDER BY id DESC`);
};

export const addRiwayatPendataan = async (data) => {
  const dbInst = await getDatabase();
  try {
    await dbInst.runAsync(
      `INSERT INTO riwayat_pendataan (name_commodity, price, unit, name_category, tanggal) VALUES (?, ?, ?, ?, ?);`,
      [data.name_commodity, data.price, data.unit, data.name_category, data.tanggal]
    );
  } catch (e) { console.error("Gagal tambah riwayat pendataan:", e); }
};

export const addRiwayatHapus = async (data) => {
  const dbInst = await getDatabase();
  try {
    await dbInst.runAsync(
      `INSERT INTO riwayat_hapus (name_commodity, price, unit, name_category, tanggal) VALUES (?, ?, ?, ?, ?);`,
      [data.name_commodity, data.price, data.unit, data.name_category, data.tanggal]
    );
  } catch (e) { console.error("Gagal tambah riwayat hapus:", e); }
};

export const getAllRiwayatHapus = async () => {
  const dbInst = await getDatabase();
  return await dbInst.getAllAsync(`SELECT * FROM riwayat_hapus ORDER BY id DESC`);
};

// -----------------------------
// EXPORT DEFAULT
// -----------------------------
export default {
  initDatabase,
  getDatabase,
  syncFromServer,
  syncPricesToServer,
  addPrice,
  updateLocalPrice,
  deleteLocalPrice,
  getAllLocalPrices,
  getLocalPricesForScreen,
  getCategories,
  getCommoditiesByCategory,
  getDashboardStats,
  getLatestPrices,
  getDashboardHistoryLocal,
  countUniqueCommodities,
  restoreAllPricesFromServer,
  getImageForCommodityByName,
  ensureFullImageUrl,
  getAllRiwayatPendataan,
  addRiwayatHapus,
  addRiwayatPendataan
};