// ===== BAGIAN 1 / 4 =====
// ====================================
// 📦 database.js (FINAL — Laravel sync-compatible, RESTORE dari server)
// ====================================

import * as SQLite from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system/legacy";
import api from "./api";

let db = null;
let netListenerAdded = false;
let syncInProgress = false; // to avoid concurrent syncs
let restoreInProgress = false;

const openDb = () => {
  if (db) return db;
  try {
    if (SQLite.openDatabase) {
      db = SQLite.openDatabase("local_market.db");
    } else if (SQLite.openDatabaseSync) {
      db = SQLite.openDatabaseSync("local_market.db");
    } else {
      throw new Error("No SQLite openDatabase available");
    }
  } catch (e) {
    // Try sync open as last resort
    try {
      db = SQLite.openDatabaseSync("local_market.db");
    } catch (err) {
      console.error("Unable to open DB:", err);
      throw err;
    }
  }
  return db;
};

// -----------------------------
// Helpers: Async wrappers for db
// -----------------------------
const attachAsyncHelpers = (dbInstance) => {
  if (!dbInstance.runAsync) {
    dbInstance.runAsync = (sql, params = []) =>
      new Promise((resolve, reject) => {
        dbInstance.transaction((tx) => {
          tx.executeSql(
            sql,
            params,
            (_, res) => resolve(res),
            (_, err) => reject(err)
          );
        });
      });
  }

  if (!dbInstance.getAllAsync) {
    dbInstance.getAllAsync = (sql, params = []) =>
      new Promise((resolve, reject) => {
        dbInstance.transaction((tx) => {
          tx.executeSql(
            sql,
            params,
            (_, { rows }) => resolve(rows._array || []),
            (_, err) => reject(err)
          );
        });
      });
  }

  if (!dbInstance.getFirstAsync) {
    dbInstance.getFirstAsync = async (sql, params = []) => {
      const rows = await dbInstance.getAllAsync(sql, params);
      return rows[0] || null;
    };
  }
};

// -----------------------------
// Init DB + migrations
// -----------------------------
export const initDatabase = async () => {
  const dbInst = openDb();
  attachAsyncHelpers(dbInst);

  // create tables if not exist
  const queries = [
    `CREATE TABLE IF NOT EXISTS categories (
       id_category INTEGER PRIMARY KEY,
       name_category TEXT,
       image TEXT,
       local_image TEXT
     );`,
    `CREATE TABLE IF NOT EXISTS commodities (
       id_commodity INTEGER PRIMARY KEY,
       name_commodity TEXT,
       category_id INTEGER,
       category_name TEXT,
       unit_id INTEGER,
       image TEXT,
       local_image TEXT
     );`,
    `CREATE TABLE IF NOT EXISTS markets (
       id_market INTEGER PRIMARY KEY,
       name_market TEXT,
       address TEXT,
       status TEXT,
       description TEXT,
       opening_hours TEXT,
       maps_link TEXT,
       image TEXT,
       created_at TEXT,
       updated_at TEXT
     );`,
    `CREATE TABLE IF NOT EXISTS units (
       id INTEGER PRIMARY KEY,
       name_unit TEXT
     );`,
    `CREATE TABLE IF NOT EXISTS commodity_markets (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       commodity_id INTEGER,
       market_id INTEGER,
       status TEXT,
       created_at TEXT,
       updated_at TEXT
     );`,
    `CREATE TABLE IF NOT EXISTS local_prices (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       commodity_id INTEGER,
       category_id INTEGER,
       user_id INTEGER,
       market_id INTEGER,
       price REAL,
       unit TEXT,
       date TEXT,
       synced INTEGER DEFAULT 0,
       created_at TEXT,
       updated_at TEXT
     );`,
    `CREATE TABLE IF NOT EXISTS riwayat_hapus (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name_commodity TEXT,
       price REAL,
       unit TEXT,
       name_category TEXT,
       tanggal TEXT
     );`,
    `CREATE TABLE IF NOT EXISTS riwayat_pendataan (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name_commodity TEXT,
       price REAL,
       unit TEXT,
       name_category TEXT,
       tanggal TEXT
     );`,
  ];

  for (const q of queries) {
    try {
      await dbInst.runAsync(q);
    } catch (e) {
      console.warn("create table failed:", e);
    }
  }

  console.log("✅ Database initialized");
  // add network listener once
  if (!netListenerAdded) {
    NetInfo.addEventListener((state) => {
      const online =
        typeof state.isInternetReachable === "boolean"
          ? state.isInternetReachable
          : state.isConnected;
      if (online === true) {
        // attempt background sync
        if (!syncInProgress) syncPricesToServer().catch((e) => console.warn("Auto sync error:", e));
      }
    });
    netListenerAdded = true;
  }
};

export const getDatabase = async () => {
  if (!db) await initDatabase();
  return db;
};

// =======================
// Helper: download image
// =======================
export const downloadImage = async (url, filename) => {
  if (!url || !filename) return null;
  try {
    const dir = `${FileSystem.cacheDirectory}images/`;
    // pastikan folder ada
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    const localUri = dir + filename;
    // jika sudah ada, return
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) return localUri;

    // download
    const { uri } = await FileSystem.downloadAsync(url, localUri);
    return uri;
  } catch (e) {
    console.warn("downloadImage failed:", e);
    return null;
  }
};

// -----------------------------
// Helper: get image path for commodity by name
// -----------------------------
export const getImageForCommodityByName = async (commodityName) => {
  if (!commodityName) return null;
  const dbInst = await getDatabase();
  const row = await dbInst.getFirstAsync(
    `SELECT local_image, image FROM commodities WHERE name_commodity = ? LIMIT 1;`,
    [commodityName]
  );
  return row?.local_image || row?.image || null;
};


export const ensureFullImageUrl = (maybeImage) => {
  if (!maybeImage) return null;
  if (maybeImage.startsWith("http")) return maybeImage;
  const base = api.BASE_URL ? api.BASE_URL.replace(/\/$/, "") : null;
  const path = api.IMAGE_PATH || (base ? `${base}/storage/commodity_images/` : null);
  if (path) return path + maybeImage;
  return maybeImage;
};



// -----------------------------
// Safe parse helpers
// -----------------------------
const safeParseJson = async (res) => {
  try {
    const text = await res.text();
    if (!text) return null;
    const trimmed = text.trim();
    if (trimmed.startsWith("<")) throw new Error("HTML response");
    return JSON.parse(trimmed);
  } catch (e) {
    throw e;
  }
};
// ===== BAGIAN 2 / 4 =====
// -----------------------------
// Sync from server (categories, commodities, markets, units)
// -----------------------------
export const syncFromServer = async () => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Token tidak ditemukan");

    const endpoints = {
      categories: api.CATEGORIES,
      commodities: api.COMMODITIES,
      markets: api.GET_MARKET,
      units: api.UNIT,
    };

    const dbInst = await getDatabase();

    for (const key of Object.keys(endpoints)) {
      const url = endpoints[key];
      if (!url) continue;
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          console.warn(`Endpoint ${key} returned ${res.status}`);
          continue;
        }
        const parsed = await safeParseJson(res);
        const data = Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed) ? parsed : [];
        if (!data.length) continue;

        if (key === "categories") {
          await dbInst.runAsync("DELETE FROM categories;");
          for (const c of data) {
            await dbInst.runAsync(
              `INSERT OR REPLACE INTO categories (id_category, name_category, image) VALUES (?, ?, ?);`,
              [c.id_category || c.id, c.name_category || c.name || "-", c.image || null]
            );
          }
        } else if (key === "units") {
          await dbInst.runAsync("DELETE FROM units;");
          for (const u of data) {
            await dbInst.runAsync(`INSERT OR REPLACE INTO units (id, name_unit) VALUES (?, ?);`, [u.id, u.name_unit || u.name || "-"]);
          }
        } else if (key === "commodities") {
          await dbInst.runAsync("DELETE FROM commodities;");
          for (const c of data) {
            try {
              const idCommodity = c.id_commodity || c.id || null;
              const nameCommodity = c.name_commodity || c.name || "-";
              const categoryId = c.category_id || c.category?.id || null;
              const categoryName = c.category_name || c.category?.name || null;
              const unitId = c.unit_id || c.unit?.id || c.unit || null;
              const rawImage = c.image || c.image_url || c.photo || null;
              const imageUrl = ensureFullImageUrl(rawImage);
              let localPath = null;
              if (imageUrl) {
                try {
                  const fname = imageUrl.split("/").pop();
                  localPath = await downloadImage(imageUrl, fname);
                } catch (e) {
                  console.warn("image download failed", e);
                }
              }
              await dbInst.runAsync(
                `INSERT OR REPLACE INTO commodities (id_commodity, name_commodity, category_id, category_name, unit_id, image, local_image) VALUES (?, ?, ?, ?, ?, ?, ?);`,
                [idCommodity, nameCommodity, categoryId, categoryName, unitId, imageUrl, localPath]
              );
            } catch (e) {
              console.warn("commodity insert error:", e);
            }
          }
        } else if (key === "markets") {
          await dbInst.runAsync("DELETE FROM markets;");
          for (const m of data) {
            await dbInst.runAsync(
              `INSERT OR REPLACE INTO markets (id_market, name_market, address, status, description, opening_hours, maps_link, image, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
              [
                m.id_market || m.id,
                m.name_market || m.name || "-",
                m.address || m.location || "-",
                m.status || null,
                m.description || m.desc || null,
                m.opening_hours || m.opening || null,
                m.maps_link || m.maps || null,
                m.image || null,
                m.created_at || null,
                m.updated_at || null,
              ]
            );
          }
        }
      } catch (err) {
        console.warn("syncFromServer endpoint error:", err);
      }
    }

    console.log("✅ syncFromServer finished");
  } catch (err) {
    console.error("syncFromServer failed:", err);
    throw err;
  }
};

// -----------------------------
// Add price (UI action) - local + optional online push
// -----------------------------
export const addPrice = async (commodityId, categoryId, price, opts = {}) => {
  // opts can include: forceSync (boolean)
  const dbInst = await getDatabase();
  const state = await NetInfo.fetch();
  const isOnline = typeof state.isInternetReachable === "boolean" ? state.isInternetReachable : state.isConnected;
  const token = await AsyncStorage.getItem("token");

  const userIdRaw = await AsyncStorage.getItem("user_id");
  const marketIdRaw = await AsyncStorage.getItem("market_id");
  const userId = userIdRaw ? Number(userIdRaw) : null;
  const marketId = marketIdRaw ? Number(marketIdRaw) : null;

  const commodity = await dbInst.getFirstAsync(`SELECT name_commodity, unit_id FROM commodities WHERE id_commodity = ?`, [commodityId]);
  const unitRow = await dbInst.getFirstAsync(`SELECT name_unit FROM units WHERE id = ?`, [commodity?.unit_id]);
  const unit = unitRow?.name_unit ?? "pcs";

  const now = new Date().toISOString();
  const dateOnly = now.split("T")[0];

  // If online and server endpoint available, attempt server insert first
  if ((isOnline || opts.forceSync) && token && api.ADD_PRICE) {
    try {
      const body = {
        commodity_id: commodityId,
        user_id: userId,
        market_id: marketId,
        price,
        date: dateOnly,
      };
      const res = await fetch(api.ADD_PRICE, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        // Insert locally marked synced
        await dbInst.runAsync(
          `INSERT INTO local_prices (commodity_id, category_id, user_id, market_id, price, unit, date, created_at, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1);`,
          [commodityId, categoryId, userId, marketId, price, unit, dateOnly, now]
        );
        await addRiwayatPendataan({
          name_commodity: commodity?.name_commodity || `Komoditas ${commodityId}`,
          price,
          unit,
          name_category: (await dbInst.getFirstAsync(`SELECT name_category FROM categories WHERE id_category = ?`, [categoryId]))?.name_category || "-",
          tanggal: now,
        });
        return { ok: true };
      } else {
        const txt = await res.text().catch(() => "");
        console.warn("Server add price failed:", res.status, txt);
      }
    } catch (e) {
      console.warn("Online addPrice error:", e);
    }
  }

  // Fallback: insert locally as unsynced
  await dbInst.runAsync(
    `INSERT INTO local_prices (commodity_id, category_id, user_id, market_id, price, unit, date, created_at, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0);`,
    [commodityId, categoryId, userId, marketId, price, unit, dateOnly, now]
  );
  return { ok: false };
};

// -----------------------------
// syncPricesToServer (batch then fallback) with lock
// -----------------------------
export const syncPricesToServer = async () => {
  if (syncInProgress) {
    console.log("sync in progress, skipping");
    return;
  }
  syncInProgress = true;
  console.log("syncPricesToServer started");
  try {
    const dbInst = await getDatabase();
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      console.warn("token not found, abort sync");
      syncInProgress = false;
      return;
    }

    // select unsynced = 0
    let unsynced = await dbInst.getAllAsync(`SELECT * FROM local_prices WHERE synced = 0;`);
    if (!unsynced.length) {
      console.log("No unsynced items");
      syncInProgress = false;
      return;
    }

    // mark as in-progress = 2
    const ids = unsynced.map((i) => i.id);
    const placeholders = ids.map(() => "?").join(",");
    if (ids.length) {
      await dbInst.runAsync(`UPDATE local_prices SET synced = 2 WHERE id IN (${placeholders});`, ids);
    }

    const inProgress = await dbInst.getAllAsync(`SELECT * FROM local_prices WHERE synced = 2;`);
    if (!inProgress.length) {
      await dbInst.runAsync(`UPDATE local_prices SET synced = 0 WHERE synced = 2;`);
      syncInProgress = false;
      return;
    }

    const userIdRaw = await AsyncStorage.getItem("user_id");
    const marketIdRaw = await AsyncStorage.getItem("market_id");
    const userId = userIdRaw ? Number(userIdRaw) : null;
    const marketId = marketIdRaw ? Number(marketIdRaw) : null;

    const payload = inProgress.map((it) => ({
      commodity_id: it.commodity_id,
      user_id: it.user_id ?? userId,
      market_id: it.market_id ?? marketId,
      price: it.price,
      date: it.date || (it.created_at ? it.created_at.split("T")[0] : null),
      local_id: it.id,
    }));

    // Try batch endpoint
    const batchEndpoint = api.SYNC_PRICES || `${api.BASE_URL.replace(/\/$/, "")}/sync`;
    let batchOk = false;
    if (batchEndpoint) {
      try {
        const res = await fetch(batchEndpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prices: payload }),
        });
        if (res.ok) {
          batchOk = true;
          // mark all as synced
          for (const it of inProgress) {
            await dbInst.runAsync(`UPDATE local_prices SET synced = 1 WHERE id = ?;`, [it.id]);
            try {
              await addRiwayatPendataan({
                name_commodity: (await dbInst.getFirstAsync(`SELECT name_commodity FROM commodities WHERE id_commodity = ?`, [it.commodity_id]))?.name_commodity || `Komoditas ${it.commodity_id}`,
                price: it.price,
                unit: it.unit || "-",
                name_category: (await dbInst.getFirstAsync(`SELECT name_category FROM categories WHERE id_category = ?`, [it.category_id]))?.name_category || "-",
                tanggal: it.created_at,
              });
            } catch (e) {}
          }
        } else {
          const txt = await res.text().catch(() => "");
          console.warn("Batch sync failed:", res.status, txt);
        }
      } catch (e) {
        console.warn("Batch endpoint error:", e);
      }
    }

    if (!batchOk) {
      // fallback to single items
      const singleEndpoint = api.ADD_PRICE || api.PRICE || `${api.BASE_URL.replace(/\/$/, "")}/sync/price`;
      if (!singleEndpoint) {
        console.warn("No single endpoint, resetting flags");
        await dbInst.runAsync(`UPDATE local_prices SET synced = 0 WHERE synced = 2;`);
        syncInProgress = false;
        return;
      }

      for (const it of inProgress) {
        try {
          const payloadItem = {
            commodity_id: it.commodity_id,
            user_id: it.user_id ?? userId,
            market_id: it.market_id ?? marketId,
            price: it.price,
            date: it.date || (it.created_at ? it.created_at.split("T")[0] : null),
          };
          const res = await fetch(singleEndpoint, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payloadItem),
          });

          if (res.ok) {
            await dbInst.runAsync(`UPDATE local_prices SET synced = 1 WHERE id = ?;`, [it.id]);
            try {
              await addRiwayatPendataan({
                name_commodity: (await dbInst.getFirstAsync(`SELECT name_commodity FROM commodities WHERE id_commodity = ?`, [it.commodity_id]))?.name_commodity || `Komoditas ${it.commodity_id}`,
                price: it.price,
                unit: it.unit || "-",
                name_category: (await dbInst.getFirstAsync(`SELECT name_category FROM categories WHERE id_category = ?`, [it.category_id]))?.name_category || "-",
                tanggal: it.created_at,
              });
            } catch (e) {}
          } else {
            console.warn("Single sync failed for", it.id);
          }
        } catch (e) {
          console.warn("Single item sync error:", e);
        }
      }
    }

    // reset any leftover flags
    try {
      await dbInst.runAsync(`UPDATE local_prices SET synced = 0 WHERE synced = 2;`);
    } catch (e) {
      console.warn("Failed to reset flags:", e);
    }
  } catch (err) {
    console.error("syncPricesToServer fatal:", err);
  } finally {
    syncInProgress = false;
    console.log("syncPricesToServer finished");
  }
};
// ===== BAGIAN 3 / 4 =====
// -----------------------------
// Riwayat helpers
// -----------------------------
export const addRiwayatHapus = async (item) => {
  const dbInst = await getDatabase();
  await dbInst.runAsync(`INSERT INTO riwayat_hapus (name_commodity, price, unit, name_category, tanggal) VALUES (?, ?, ?, ?, ?);`, [
    item.name_commodity,
    item.price,
    item.unit,
    item.name_category,
    item.tanggal,
  ]);
};

export const addRiwayatPendataan = async (item) => {
  const dbInst = await getDatabase();
  await dbInst.runAsync(`INSERT INTO riwayat_pendataan (name_commodity, price, unit, name_category, tanggal) VALUES (?, ?, ?, ?, ?);`, [
    item.name_commodity,
    item.price,
    item.unit,
    item.name_category,
    item.tanggal,
  ]);
};

export const getAllRiwayatPendataan = async () => {
  const dbInst = await getDatabase();
  return dbInst.getAllAsync(`SELECT * FROM riwayat_pendataan ORDER BY tanggal DESC;`);
};

// -----------------------------
// Dashboard / Screen helpers
// -----------------------------
export const getAllLocalPrices = async () => {
  const dbInst = await getDatabase();
  return dbInst.getAllAsync(`
    SELECT
      p.id,
      p.commodity_id,
      p.category_id,
      p.user_id,
      p.market_id,
      p.price,
      p.unit,
      p.synced,
      p.date AS tanggal,
      p.created_at,
      co.id_commodity,
      co.name_commodity,
      co.image,
      co.local_image,
      co.unit_id,
      c.name_category,
      u.name_unit,
      m.name_market
    FROM local_prices p
    LEFT JOIN commodities co ON p.commodity_id = co.id_commodity
    LEFT JOIN categories c ON p.category_id = c.id_category
    LEFT JOIN units u ON co.unit_id = u.id
    LEFT JOIN markets m ON p.market_id = m.id_market
    ORDER BY p.created_at DESC;
  `);
};

export const deleteLocalPrice = async (id, itemData = null) => {
  const dbInst = await getDatabase();
  if (itemData) {
    await addRiwayatHapus({
      name_commodity: itemData.name_commodity,
      price: itemData.price,
      unit: itemData.unit,
      name_category: itemData.name_category,
      tanggal: new Date().toISOString(),
    });
  }
  await dbInst.runAsync(`DELETE FROM local_prices WHERE id = ?;`, [id]);
};

export const getCategories = async () => {
  const dbInst = await getDatabase();
  return dbInst.getAllAsync(`SELECT * FROM categories;`);
};

export const getCommoditiesByCategory = async (categoryId) => {
  const dbInst = await getDatabase();
  return dbInst.getAllAsync(`SELECT id_commodity, name_commodity AS name, image, local_image, unit_id, category_id FROM commodities WHERE category_id = ?;`, [categoryId]);
};

export const getDashboardStats = async () => {
  const dbInst = await getDatabase();
  const total = await dbInst.getFirstAsync(`SELECT COUNT(*) AS total FROM local_prices;`);
  const offline = await dbInst.getFirstAsync(`SELECT COUNT(*) AS offline FROM local_prices WHERE synced = 0;`);
  const online = await dbInst.getFirstAsync(`SELECT COUNT(*) AS online FROM local_prices WHERE synced = 1;`);
  return { total: total?.total ?? 0, offline: offline?.offline ?? 0, online: online?.online ?? 0 };
};

export const getLatestPrices = async (limit = 20) => {
  const dbInst = await getDatabase();
  return dbInst.getAllAsync(`
    SELECT
      p.id,
      co.id_commodity,
      co.name_commodity,
      c.name_category,
      p.price,
      p.unit,
      p.date AS tanggal,
      p.created_at,
      co.local_image,
      co.image,
      u.name_unit,
      m.name_market
    FROM local_prices p
    LEFT JOIN commodities co ON p.commodity_id = co.id_commodity
    LEFT JOIN categories c ON p.category_id = c.id_category
    LEFT JOIN units u ON co.unit_id = u.id
    LEFT JOIN markets m ON p.market_id = m.id_market
    ORDER BY p.created_at DESC
    LIMIT ?;
  `, [limit]);
};

export const getLocalPricesForScreen = async (categoryId = null, commodityId = null) => {
  const dbInst = await getDatabase();
  let query = `
    SELECT
      p.id,
      co.id_commodity,
      co.name_commodity,
      c.name_category,
      p.price,
      p.unit,
      p.synced,
      p.date AS tanggal,
      p.created_at AS created_at,
      co.local_image,
      co.image,
      u.name_unit,
      m.name_market
    FROM local_prices p
    LEFT JOIN categories c ON p.category_id = c.id_category
    LEFT JOIN commodities co ON p.commodity_id = co.id_commodity
    LEFT JOIN units u ON co.unit_id = u.id
    LEFT JOIN markets m ON p.market_id = m.id_market
    WHERE 1=1
  `;
  const params = [];
  if (categoryId) { query += ` AND p.category_id = ?`; params.push(categoryId); }
  if (commodityId) { query += ` AND p.commodity_id = ?`; params.push(commodityId); }
  query += ` ORDER BY p.created_at DESC;`;
  return dbInst.getAllAsync(query, params);
};

export const countUniqueCommodities = async () => {
  const dbInst = await getDatabase();
  const result = await dbInst.getFirstAsync(`SELECT COUNT(DISTINCT commodity_id) AS total FROM local_prices;`);
  return result?.total ?? 0;
};

// -----------------------------
// Restore ALL prices from server into local_prices (full restore)
// - This function will fetch server endpoint (your /price/all) and write into local_prices.
// - It is intended to be used on app reinstall / first-run to populate local DB with server data.
// - It marks restored rows as synced=1.
// -----------------------------
export const restoreAllPricesFromServer = async (showProgressCb = null) => {
  if (restoreInProgress) {
    console.log("Restore already in progress");
    return;
  }
  restoreInProgress = true;
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Token tidak ditemukan");

    // Fetch all prices from server
    const url = `${api.BASE_URL.replace(/\/$/, "")}/price/all`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`restoreAllPricesFromServer: server returned ${res.status}`);
    const json = await safeParseJson(res);
    const items = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

    const dbInst = await getDatabase();
    // We'll do it in a transaction manner: delete existing server-synced rows for this market? Simpler: clear all local prices then insert restored as synced=1
    // But we must preserve user-local unsynced records (synced=0). Strategy: delete only rows marked synced=1 (server-origin), keep synced=0.
    try {
      await dbInst.runAsync(`DELETE FROM local_prices WHERE synced = 1;`);
    } catch (e) {
      console.warn("Failed to delete old synced rows:", e);
    }

    // Insert restored prices in chunks with optional progress callback
    const chunkSize = 200;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      await dbInst.runAsync("BEGIN TRANSACTION;");
      try {
        for (const it of chunk) {
          // map server fields to local schema (best-effort)
          const commodity_id = it.commodity_id || it.commodity_id;
          const category_id = it.category_id || it.category_id || null;
          const user_id = it.user_id || null;
          const market_id = it.market_id || it.market_id || null;
          const price = it.price ?? it.average_price ?? it.avg_price ?? 0;
          const unit = it.unit || it.unit_name || "-";
          const created_at = it.created_at || it.created_at_local || new Date().toISOString();
          const dateOnly = created_at.split("T")[0];

          await dbInst.runAsync(
            `INSERT INTO local_prices (commodity_id, category_id, user_id, market_id, price, unit, date, created_at, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1);`,
            [commodity_id, category_id, user_id, market_id, price, unit, dateOnly, created_at]
          );
        }
        await dbInst.runAsync("COMMIT;");
      } catch (e) {
        console.warn("Chunk insert failed, rolling back", e);
        try { await dbInst.runAsync("ROLLBACK;"); } catch {}
      }
      if (typeof showProgressCb === "function") {
        showProgressCb(Math.min(items.length, i + chunk.length), items.length);
      }
    }

    console.log(`✅ Restored ${items.length} server prices into local DB`);
    return { restored: items.length };
  } catch (e) {
    console.error("restoreAllPricesFromServer failed:", e);
    throw e;
  } finally {
    restoreInProgress = false;
  }
};
// ===== BAGIAN 4 / 4 =====
// -----------------------------
// Convenience default export
// -----------------------------
export default {
  initDatabase,
  getDatabase,
  syncFromServer,
  syncPricesToServer,
  syncDataToServer: syncPricesToServer,
  addPrice,
  addRiwayatHapus,
  addRiwayatPendataan,
  getAllRiwayatPendataan,
  getAllLocalPrices,
  getLocalPricesForScreen,
  deleteLocalPrice,
  getCategories,
  getCommoditiesByCategory,
  getDashboardStats,
  getLatestPrices,
  countUniqueCommodities,
  restoreAllPricesFromServer,
  getImageForCommodityByName, // <--- tambahkan
  ensureFullImageUrl, 
};
