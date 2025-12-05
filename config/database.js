// ====================================
// 📦 database.js (FULL — Laravel sync-compatible)
// ====================================

import * as SQLite from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system/legacy";
import api from "./api";

let db;
let netListenerAdded = false;

const openDb = () => {
  if (!db) db = SQLite.openDatabaseSync("local_market.db");
  return db;
};

// -----------------------------
// Init DB + async helpers
// -----------------------------
export const initDatabase = async () => {
  openDb();

  if (!db.runAsync) {
    db.runAsync = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.transaction((tx) => {
          tx.executeSql(sql, params, (_, res) => resolve(res), (_, err) => reject(err));
        });
      });

    db.getAllAsync = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.transaction((tx) => {
          tx.executeSql(sql, params, (_, { rows }) => resolve(rows._array || []), (_, err) => reject(err));
        });
      });

    db.getFirstAsync = async (sql, params = []) => {
      const rows = await db.getAllAsync(sql, params);
      return rows[0] || null;
    };
  }

  try {
    await runMigrationsIfNeeded();
  } catch (e) {
    console.warn("⚠ runMigrationsIfNeeded error:", e);
  }

  const tableQueries = [
    `CREATE TABLE IF NOT EXISTS categories (
       id_category INTEGER PRIMARY KEY,
       name_category TEXT
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

  for (const q of tableQueries) {
    await db.runAsync(q);
  }

  console.log("✅ Database initialized with backend-compatible schema");

  if (!netListenerAdded) {
    NetInfo.addEventListener((state) => {
      if (state.isInternetReachable === true) {
        console.log("🌐 Internet reachable — starting auto-sync");
        // don't await here — function manages its own errors/logging
        syncPricesToServer().catch((e) => console.warn("Auto sync error:", e));
      }
    });
    netListenerAdded = true;
  }
};

const runMigrationsIfNeeded = async () => {
  const dbInst = openDb();

  // ensure helper functions exist on the synchronous db instance
  if (!dbInst.getAllAsync) {
    dbInst.getAllAsync = (sql, params = []) =>
      new Promise((resolve, reject) => {
        dbInst.transaction((tx) => {
          tx.executeSql(sql, params, (_, { rows }) => resolve(rows._array || []), (_, err) => reject(err));
        });
      });
    dbInst.runAsync = (sql, params = []) =>
      new Promise((resolve, reject) => {
        dbInst.transaction((tx) => {
          tx.executeSql(sql, params, (_, res) => resolve(res), (_, err) => reject(err));
        });
      });
  }

  const tables = await dbInst.getAllAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='commodities'`);
  if (!tables || tables.length === 0) return;

  const cols = await dbInst.getAllAsync(`PRAGMA table_info(commodities);`);
  const columnNames = cols.map((c) => c.name);
  if (columnNames.includes("id_commodity")) return;

  console.log("🔁 Detected old commodities schema, running migration...");

  try {
    await dbInst.runAsync(
      `CREATE TABLE IF NOT EXISTS _commodities_new (
         id_commodity INTEGER PRIMARY KEY,
         name_commodity TEXT,
         category_id INTEGER,
         category_name TEXT,
         unit_id INTEGER,
         image TEXT,
         local_image TEXT
       );`
    );

    const map = {
      id_commodity: columnNames.includes("id") ? "id" : columnNames.includes("id_commodity") ? "id_commodity" : null,
      name_commodity: columnNames.includes("name") ? "name" : columnNames.includes("name_commodity") ? "name_commodity" : null,
      category_id: columnNames.includes("category_id") ? "category_id" : null,
      category_name: columnNames.includes("category_name") ? "category_name" : null,
      unit_id: columnNames.includes("unit_id") ? "unit_id" : columnNames.includes("id_unit") ? "id_unit" : null,
      image: columnNames.includes("image") ? "image" : null,
      local_image: columnNames.includes("local_image") ? "local_image" : null,
    };

    const selectExpr = [
      map.id_commodity ? map.id_commodity : "NULL",
      map.name_commodity ? map.name_commodity : "NULL",
      map.category_id ? map.category_id : "NULL",
      map.category_name ? map.category_name : "NULL",
      map.unit_id ? map.unit_id : "NULL",
      map.image ? map.image : "NULL",
      map.local_image ? map.local_image : "NULL",
    ].join(", ");

    await dbInst.runAsync(
      `INSERT INTO _commodities_new
         (id_commodity, name_commodity, category_id, category_name, unit_id, image, local_image)
       SELECT ${selectExpr} FROM commodities;`
    );

    await dbInst.runAsync(`ALTER TABLE commodities RENAME TO _commodities_old;`);
    await dbInst.runAsync(`ALTER TABLE _commodities_new RENAME TO commodities;`);

    console.log("✅ Migration completed: commodities table migrated to new schema.");
  } catch (e) {
    console.warn("⚠ Migration failed for commodities:", e);
  }
};

export const getDatabase = async () => {
  if (!db) await initDatabase();
  return db;
};

// -----------------------------
// Image helpers
// -----------------------------
export const downloadImage = async (imageUrl, filename) => {
  try {
    if (!imageUrl) return null;
    const localUri = `${FileSystem.documentDirectory}${filename}`;
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) {
      await FileSystem.downloadAsync(imageUrl, localUri);
    }
    return localUri;
  } catch (e) {
    console.warn("⚠ downloadImage error:", e);
    return null;
  }
};

export const getLocalImagePath = async (imageUrl) => {
  try {
    if (!imageUrl) return null;
    const parts = imageUrl.split("/");
    const filename = parts[parts.length - 1] || `img_${Date.now()}.jpg`;
    const localUri = `${FileSystem.documentDirectory}${filename}`;
    const info = await FileSystem.getInfoAsync(localUri);
    return info.exists ? localUri : null;
  } catch (e) {
    return null;
  }
};

export const getImageForCommodityByName = async (name) => {
  try {
    if (!name) return null;
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      `SELECT id_commodity, name_commodity, image, local_image, unit_id FROM commodities WHERE name_commodity = ? LIMIT 1;`,
      [name]
    );
    if (row) return row;
    const alt = await db.getFirstAsync(
      `SELECT id AS id_commodity, name AS name_commodity, image, local_image, id_unit as unit_id FROM commodities WHERE name = ? LIMIT 1;`,
      [name]
    );
    return alt || null;
  } catch (err) {
    return null;
  }
};

// -----------------------------
// Helpers: parse response + ensure full URL
// -----------------------------
const safeParseResponseData = async (response) => {
  try {
    const text = await response.text();
    const trimmed = text.trim();
    if (trimmed.startsWith("<")) throw new Error("Response looks like HTML (not JSON)");
    const parsed = JSON.parse(trimmed);
    // support several possible envelopes
    if (parsed && (parsed.data || parsed.results || parsed.latest_prices)) {
      return parsed.data || parsed.results || parsed.latest_prices;
    }
    return parsed;
  } catch (err) {
    throw err;
  }
};

const ensureFullImageUrl = (maybeImage) => {
  if (!maybeImage) return null;
  if (typeof maybeImage !== "string") return null;
  const trimmed = maybeImage.trim();
  if (trimmed === "") return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;

  // prefer api.IMAGE_PATH if present; else build from BASE_URL + storage path
  const base = api.BASE_URL ? api.BASE_URL.replace(/\/$/, "") : null;
  const pathFromApi = api.IMAGE_PATH || (base ? `${base}/storage/commodity_images/` : null);
  if (pathFromApi) return pathFromApi + trimmed;
  return trimmed;
};

const downloadMissingLocalImages = async () => {
  try {
    const dbInst = await getDatabase();
    const needs = await dbInst.getAllAsync(`SELECT id_commodity, image, local_image FROM commodities WHERE image IS NOT NULL AND (local_image IS NULL OR local_image = '')`);
    for (const row of needs) {
      try {
        const fullUrl = ensureFullImageUrl(row.image);
        if (!fullUrl) continue;
        const filename = fullUrl.split("/").pop();
        const local = await downloadImage(fullUrl, filename);
        if (local) {
          await dbInst.runAsync(`UPDATE commodities SET local_image = ? WHERE id_commodity = ?;`, [local, row.id_commodity]);
        }
      } catch (e) {
        console.warn("⚠ downloadMissingLocalImages item failed", row.id_commodity, e);
      }
    }
  } catch (e) {
    console.warn("⚠ downloadMissingLocalImages failed:", e);
  }
};

// -----------------------------
// Sync from server (with image download)
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

    const results = {};

    for (const key in endpoints) {
      const url = endpoints[key];
      if (!url) {
        results[key] = null;
        continue;
      }
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          console.warn(`⚠️ Endpoint ${key} returned ${res.status}`);
          results[key] = null;
          continue;
        }
        const parsed = await safeParseResponseData(res);
        results[key] = Array.isArray(parsed) ? parsed : parsed?.data ?? parsed;
      } catch (err) {
        console.error(`❌ Gagal fetch/parse ${key}:`, err);
        results[key] = null;
      }
    }

    const db = await getDatabase();

    // Categories
    if (results.categories) {
      await db.runAsync("DELETE FROM categories;");
      for (const cat of results.categories) {
        await db.runAsync(`INSERT OR REPLACE INTO categories (id_category, name_category) VALUES (?, ?);`, [cat.id_category || cat.id, cat.name_category || cat.name || "-"]);
      }
      console.log("✅ Data categories saved");
    }

    // Units
    if (results.units) {
      await db.runAsync("DELETE FROM units;");
      for (const u of results.units) {
        await db.runAsync(`INSERT OR REPLACE INTO units (id, name_unit) VALUES (?, ?);`, [u.id, u.name_unit || u.name || "-"]);
      }
      console.log("✅ Data units saved");
    }

    // Commodities (image URL normalized + local download)
    if (results.commodities) {
      await db.runAsync("DELETE FROM commodities;");
      for (const c of results.commodities) {
        try {
          const categoryId = c.category_id || c.category?.id || null;
          const categoryName = c.category_name || c.category?.name_category || c.category?.name || null;
          const nameCommodity = c.name_commodity || c.name || "-";
          const idCommodity = c.id_commodity || c.id || null;
          const unitId = c.unit_id || c.unit?.id || c.unit || null;
          const rawImage = c.image || c.image_url || c.photo || null;

          const imageUrl = ensureFullImageUrl(rawImage);
          let localPath = null;
          if (imageUrl) {
            try {
              const filename = imageUrl.split("/").pop();
              localPath = await downloadImage(imageUrl, filename);
            } catch (e) {
              console.warn("⚠ image download failed for", imageUrl, e);
            }
          }

          await db.runAsync(
            `INSERT OR REPLACE INTO commodities
              (id_commodity, name_commodity, category_id, category_name, unit_id, image, local_image)
             VALUES (?, ?, ?, ?, ?, ?, ?);`,
            [idCommodity, nameCommodity, categoryId, categoryName, unitId, imageUrl, localPath]
          );
        } catch (e) {
          console.warn("⚠ commodity insert error:", e);
        }
      }

      await downloadMissingLocalImages();
      console.log("✅ Data commodities saved (images downloaded where possible)");
    }

    // Markets
    if (results.markets) {
      await db.runAsync("DELETE FROM markets;");
      for (const m of results.markets) {
        await db.runAsync(
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
      console.log("✅ Data markets saved");
    }

    console.log("📡 Sync from server finished");
  } catch (err) {
    console.error("❌ Sync from server error:", err);
    throw err;
  }
};

// -----------------------------
// Add Price (used when UI adds a price directly)
// -----------------------------
export const addPrice = async (commodityId, categoryId, price) => {
  const db = await getDatabase();
  const state = await NetInfo.fetch();
  const isOnline = state.isInternetReachable === true;
  const token = await AsyncStorage.getItem("token");

  // get user and market info from AsyncStorage (set these on login)
  const userIdRaw = await AsyncStorage.getItem("user_id");
  const marketIdRaw = await AsyncStorage.getItem("market_id");
  const userId = userIdRaw ? Number(userIdRaw) : null;
  const marketId = marketIdRaw ? Number(marketIdRaw) : null;

  const commodity = await db.getFirstAsync(`SELECT name_commodity, unit_id FROM commodities WHERE id_commodity = ?`, [commodityId]);
  const category = await db.getFirstAsync(`SELECT name_category FROM categories WHERE id_category = ?`, [categoryId]);
  const unitRow = await db.getFirstAsync(`SELECT name_unit FROM units WHERE id = ?`, [commodity?.unit_id]);
  const unit = unitRow?.name_unit ?? "pcs";
  const now = new Date().toISOString();
  const dateOnly = now.split("T")[0];

  if (isOnline && token && api.ADD_PRICE) {
    try {
      // Use the single add price endpoint from your config
      const endpoint = api.ADD_PRICE;
      const bodyPayload = {
        commodity_id: commodityId,
        user_id: userId,
        market_id: marketId,
        price,
        date: dateOnly,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (res.ok) {
        await db.runAsync(
          `INSERT INTO local_prices (commodity_id, category_id, user_id, market_id, price, unit, date, created_at, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1);`,
          [commodityId, categoryId, userId, marketId, price, unit, dateOnly, now]
        );
        await addRiwayatPendataan({ name_commodity: commodity?.name_commodity || `Komoditas ${commodityId}`, price, unit, name_category: category?.name_category || "-", tanggal: now });
        return;
      } else {
        const txt = await res.text().catch(() => "");
        console.warn("⚠ addPrice: server returned", res.status, txt);
      }
    } catch (err) {
      console.warn("⚠ Online addPrice error:", err);
    }
  }

  // Offline fallback or if ADD_PRICE not available
  await db.runAsync(
    `INSERT INTO local_prices (commodity_id, category_id, user_id, market_id, price, unit, date, created_at, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0);`,
    [commodityId, categoryId, userId, marketId, price, unit, dateOnly, now]
  );
};

// -----------------------------
// Sync local prices to server
// - try batch endpoint (api.SYNC_PRICES)
// - if batch fails, fallback to single-item endpoint (api.ADD_PRICE)
// -----------------------------
export const syncPricesToServer = async () => {
  try {
    const db = await getDatabase();
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      console.warn("⚠ syncPricesToServer: token not found");
      return;
    }

    const unsynced = await db.getAllAsync(`SELECT * FROM local_prices WHERE synced = 0;`);
    if (!unsynced?.length) return console.log("✅ No unsynced local prices");

    // Get user/market from AsyncStorage for payload (if available)
    const userIdRaw = await AsyncStorage.getItem("user_id");
    const marketIdRaw = await AsyncStorage.getItem("market_id");
    const userId = userIdRaw ? Number(userIdRaw) : null;
    const marketId = marketIdRaw ? Number(marketIdRaw) : null;

    // Build payload for batch sync (map to server expected shape)
    const batchPayload = unsynced.map((it) => ({
      commodity_id: it.commodity_id,
      user_id: it.user_id ?? userId,
      market_id: it.market_id ?? marketId,
      price: it.price,
      date: it.date || (it.created_at ? it.created_at.split("T")[0] : null),
      local_id: it.id, // include local id for server ack if needed
      created_at: it.created_at,
    }));

    // Try batch endpoint first (api.SYNC_PRICES)
    const batchEndpoint = api.SYNC_PRICES || `${api.BASE_URL.replace(/\/$/, "")}/sync`;
    let batchSucceeded = false;

    if (batchEndpoint) {
      try {
        const res = await fetch(batchEndpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prices: batchPayload }),
        });

        if (res.ok) {
          // mark all as synced
          for (const it of unsynced) {
            await db.runAsync(`UPDATE local_prices SET synced = 1 WHERE id = ?;`, [it.id]);

            const commodity = await db.getFirstAsync(`SELECT name_commodity FROM commodities WHERE id_commodity = ?`, [it.commodity_id]);
            const category = await db.getFirstAsync(`SELECT name_category FROM categories WHERE id_category = ?`, [it.category_id]);

            await addRiwayatPendataan({
              name_commodity: commodity?.name_commodity || `Komoditas ${it.commodity_id}`,
              price: it.price,
              unit: it.unit || "-",
              name_category: category?.name_category || "-",
              tanggal: it.created_at,
            });
          }
          console.log("✅ Batch sync succeeded for", unsynced.length, "items");
          batchSucceeded = true;
        } else {
          const txt = await res.text().catch(() => "");
          console.warn("⚠ Batch sync failed:", res.status, txt);
        }
      } catch (err) {
        console.warn("⚠ Batch sync endpoint error:", err);
      }
    }

    if (batchSucceeded) return;

    // ---------- single-item fallback ----------
    const singleEndpoint = api.ADD_PRICE || api.PRICE || `${api.BASE_URL.replace(/\/$/, "")}/sync/price`;
    if (!singleEndpoint) {
      console.warn("⚠ No single-item endpoint configured; cannot fallback.");
      return;
    }

    for (const it of unsynced) {
      try {
        const payload = {
          commodity_id: it.commodity_id,
          user_id: it.user_id ?? userId,
          market_id: it.market_id ?? marketId,
          price: it.price,
          date: it.date || (it.created_at ? it.created_at.split("T")[0] : null),
        };

        const res = await fetch(singleEndpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          await db.runAsync(`UPDATE local_prices SET synced = 1 WHERE id = ?;`, [it.id]);

          const commodity = await db.getFirstAsync(`SELECT name_commodity FROM commodities WHERE id_commodity = ?`, [it.commodity_id]);
          const category = await db.getFirstAsync(`SELECT name_category FROM categories WHERE id_category = ?`, [it.category_id]);

          await addRiwayatPendataan({
            name_commodity: commodity?.name_commodity || `Komoditas ${it.commodity_id}`,
            price: it.price,
            unit: it.unit || "-",
            name_category: category?.name_category || "-",
            tanggal: it.created_at,
          });

          console.log(`✅ Synced item local id ${it.id}`);
        } else {
          const txt = await res.text().catch(() => "");
          console.warn(`⚠ Single sync failed for id ${it.id}:`, res.status, txt);
        }
      } catch (err) {
        console.warn("⚠ Single sync error for id", it.id, err);
      }
    }
  } catch (err) {
    console.error("❌ syncPricesToServer fatal:", err);
  }
};

export const syncDataToServer = async () => {
  return syncPricesToServer();
};

// -----------------------------
// Riwayat helpers
// -----------------------------
export const addRiwayatHapus = async (item) => {
  const db = await getDatabase();
  await db.runAsync(`INSERT INTO riwayat_hapus (name_commodity, price, unit, name_category, tanggal) VALUES (?, ?, ?, ?, ?);`, [item.name_commodity, item.price, item.unit, item.name_category, item.tanggal]);
};

export const addRiwayatPendataan = async (item) => {
  const db = await getDatabase();
  await db.runAsync(`INSERT INTO riwayat_pendataan (name_commodity, price, unit, name_category, tanggal) VALUES (?, ?, ?, ?, ?);`, [item.name_commodity, item.price, item.unit, item.name_category, item.tanggal]);
};

export const getAllRiwayatPendataan = async () => {
  const db = await getDatabase();
  return db.getAllAsync(`SELECT * FROM riwayat_pendataan ORDER BY tanggal DESC;`);
};

// -----------------------------
// Dashboard / screen helpers
// -----------------------------
export const getAllLocalPrices = async () => {
  const db = await getDatabase();
  return db.getAllAsync(`
    SELECT
      p.id,
      p.commodity_id,
      p.category_id,
      p.user_id,
      p.market_id,
      p.price,
      p.unit,
      p.synced,
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
  const db = await getDatabase();
  if (itemData) {
    await addRiwayatHapus({ name_commodity: itemData.name_commodity, price: itemData.price, unit: itemData.unit, name_category: itemData.name_category, tanggal: new Date().toISOString() });
  }
  await db.runAsync(`DELETE FROM local_prices WHERE id = ?;`, [id]);
};

export const getCategories = async () => {
  const db = await getDatabase();
  return db.getAllAsync(`SELECT * FROM categories;`);
};

export const getCommoditiesByCategory = async (categoryId) => {
  const db = await getDatabase();
  return db.getAllAsync(`SELECT id_commodity, name_commodity AS name, image, local_image, unit_id, category_id FROM commodities WHERE category_id = ?;`, [categoryId]);
};

export const getDashboardStats = async () => {
  const db = await getDatabase();
  const total = await db.getFirstAsync(`SELECT COUNT(*) AS total FROM local_prices;`);
  const offline = await db.getFirstAsync(`SELECT COUNT(*) AS offline FROM local_prices WHERE synced = 0;`);
  const online = await db.getFirstAsync(`SELECT COUNT(*) AS online FROM local_prices WHERE synced = 1;`);
  return { total: total?.total ?? 0, offline: offline?.offline ?? 0, online: online?.online ?? 0 };
};

export const getLatestPrices = async (limit = 20) => {
  const db = await getDatabase();
  return db.getAllAsync(`
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
  const db = await getDatabase();
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
  return db.getAllAsync(query, params);
};

export const countUniqueCommodities = async () => {
  const db = await getDatabase();
  const result = await db.getFirstAsync(`SELECT COUNT(DISTINCT commodity_id) AS total FROM local_prices;`);
  return result?.total ?? 0;
};