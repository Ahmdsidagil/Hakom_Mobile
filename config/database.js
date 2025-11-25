// ====================================
// 📦 config/database.js (versi lengkap & rapi + cache gambar fix kolom image)
// ====================================
import * as SQLite from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system/legacy";
import api from "./api";

let db;
let netListenerAdded = false;

// ====================================
// 🔹 Inisialisasi Database
// ====================================
export const initDatabase = async () => {
  if (!db) db = SQLite.openDatabaseSync("local_market.db");

  // =========================
  // Helper SQLite async
  // =========================
  if (!db.runAsync) {
    db.runAsync = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.transaction((tx) => {
          tx.executeSql(sql, params, (_, result) => resolve(result), (_, err) => reject(err));
        });
      });

    db.getAllAsync = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.transaction((tx) => {
          tx.executeSql(sql, params, (_, { rows }) => resolve(rows._array || []), (_, err) => reject(err));
        });
      });

    db.getFirstAsync = async (sql, params = []) => {
      const results = await db.getAllAsync(sql, params);
      return results[0] || null;
    };
  }

  // =========================
  // Periksa & buat tabel
  // =========================
  const tableQueries = [
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name_category TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS commodities (
      id INTEGER PRIMARY KEY,
      name_commodity TEXT,
      category_id INTEGER,
      unit TEXT,
      image TEXT,
      local_image TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );`,
    `CREATE TABLE IF NOT EXISTS markets (
      id INTEGER PRIMARY KEY,
      name_market TEXT,
      address TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS local_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commodity_id INTEGER,
      category_id INTEGER,
      market_id INTEGER,
      price REAL,
      unit TEXT,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (commodity_id) REFERENCES commodities(id),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (market_id) REFERENCES markets(id)
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
    `CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY,
      name TEXT
    );`,
  ];

  for (const query of tableQueries) {
    await db.runAsync(query);
  }

  console.log("✅ Database & tabel lokal siap digunakan");

  // 🔄 Sinkron otomatis saat online (hanya sekali)
  if (!netListenerAdded) {
    NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        console.log("🌐 Koneksi aktif — mulai sinkronisasi otomatis...");
        if (typeof syncPricesToServer === "function") {
          // panggil tanpa menunggu
          syncPricesToServer().catch((e) => console.warn("Auto syncPricesToServer error:", e));
        }
      }
    });
    netListenerAdded = true;
  }
};

// ====================================
// 🔸 Ambil instance database
// ====================================
export const getDatabase = async () => {
  if (!db) await initDatabase();
  return db;
};

// ====================================
// 🔹 Fungsi download gambar ke local
// ====================================
export const downloadImage = async (imageUrl, filename) => {
  try {
    if (!imageUrl) return null;
    const localUri = `${FileSystem.documentDirectory}${filename}`;
    try {
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (!fileInfo.exists) {
        // downloadAsync akan menimpa file jika ada, tapi kita cek dulu
        await FileSystem.downloadAsync(imageUrl, localUri);
      }
      return localUri;
    } catch (err) {
      console.warn("⚠️ Gagal download gambar:", err);
      return null;
    }
  } catch (err) {
    console.warn("⚠️ downloadImage error:", err);
    return null;
  }
};

// ====================================
// 🔹 Helper: dapatkan path lokal dari image URL (jika sudah didownload)
// ====================================
export const getLocalImagePath = async (imageUrl) => {
  try {
    if (!imageUrl) return null;
    // filename derive dari URL terakhir
    const parts = imageUrl.split("/");
    const filename = parts[parts.length - 1] || `img_${Buffer.from(imageUrl).toString("base64")}.jpg`;
    const localUri = `${FileSystem.documentDirectory}${filename}`;
    const info = await FileSystem.getInfoAsync(localUri);
    return info.exists ? localUri : null;
  } catch (err) {
    return null;
  }
};

// ====================================
// 🔹 Helper: cari commodity by name dan kembalikan kolom image/local_image
// ====================================
export const getImageForCommodityByName = async (name) => {
  try {
    if (!name) return null;
    const db = await getDatabase();
    const row = await db.getFirstAsync(`SELECT id, image, local_image FROM commodities WHERE name_commodity = ? LIMIT 1;`, [name]);
    return row || null;
  } catch (err) {
    return null;
  }
};

// ====================================
// 🔹 Safe JSON parse helper untuk respon server dengan wrapper { data: [...] }
// ====================================
const safeParseResponseData = async (response) => {
  try {
    const text = await response.text();
    // jika server kirim HTML (error), throw supaya caller tahu
    const trimmed = text.trim();
    if (trimmed.startsWith("<")) {
      throw new Error("Response looks like HTML (not JSON)");
    }

    const parsed = JSON.parse(trimmed);
    // jika ada wrapper data -> gunakan data, kalau tidak gunakan parsed langsung
    if (parsed && (parsed.data || parsed.results || parsed.latest_prices)) {
      // prefer 'data' then 'results' then 'latest_prices'
      return parsed.data || parsed.results || parsed.latest_prices;
    }
    return parsed;
  } catch (err) {
    // bubble error with message so caller can report
    throw err;
  }
};

// ====================================
// 🔹 Sinkronisasi Data dari Server (unit lengkap + cache gambar)
// ====================================
export const syncFromServer = async () => {
  try {
    console.log("📡 Sinkronisasi data kategori, komoditas, pasar, & unit...");
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Token tidak ditemukan");

    const endpoints = [
      { name: "categories", url: api.CATEGORIES },
      { name: "commodities", url: api.COMMODITIES },
      { name: "markets", url: api.GET_MARKET },
      { name: "units", url: api.UNIT },
    ];

    const results = {};

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep.url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          console.warn(`⚠️ Endpoint ${ep.name} return status ${res.status}`);
          results[ep.name] = null;
          continue;
        }
        // parse safely (meng-handle wrapper { data: [...] })
        const parsed = await safeParseResponseData(res);
        // parsed could be array or object -> normalize to array for our usage
        results[ep.name] = Array.isArray(parsed) ? parsed : parsed?.data ?? parsed;
      } catch (err) {
        console.error(`❌ Gagal fetch/parse ${ep.name}:`, err);
        results[ep.name] = null;
      }
    }

    const db = await getDatabase();

    // =========================
    // Simpan unit
    // =========================
    if (results.units) {
      await db.runAsync("DELETE FROM units;");
      for (const u of results.units) {
        await db.runAsync(
          `INSERT INTO units (id, name) VALUES (?, ?);`,
          [u.id, u.name || "-"]
        );
      }
      console.log("✅ Data units berhasil disimpan");
    }

    // =========================
    // Simpan kategori
    // =========================
    if (results.categories) {
      await db.runAsync("DELETE FROM categories;");
      for (const cat of results.categories) {
        await db.runAsync(
          `INSERT INTO categories (id, name_category) VALUES (?, ?);`,
          [cat.id, cat.name_category || "-"]
        );
      }
      console.log("✅ Data kategori berhasil disimpan");
    }

    // =========================
    // Simpan komoditas dengan mapping unit + download gambar
    // =========================
    if (results.commodities) {
      await db.runAsync("DELETE FROM commodities;");

      for (const com of results.commodities) {
        const categoryId = com.category_id || com.category?.id || null;
        let unitName = "kg"; // default

        if (com.unit_id && results.units) {
          const foundUnit = results.units.find((u) => u.id === com.unit_id);
          if (foundUnit) unitName = foundUnit.name;
        } else if (com.unit?.name) {
          unitName = com.unit.name;
        } else if (com.unit) {
          unitName = com.unit;
        }

        // simpan image url di kolom image
        await db.runAsync(
          `INSERT INTO commodities (id, name_commodity, category_id, unit, image, local_image) VALUES (?, ?, ?, ?, ?, ?);`,
          [com.id, com.name_commodity || "-", categoryId, unitName, com.image || null, null]
        );

        // 🔹 Download gambar dan simpan path lokal (jika ada)
        if (com.image) {
          const parts = com.image.split("/");
          const filename = parts[parts.length - 1] || `commodity_${com.id}.jpg`;
          const localPath = await downloadImage(com.image, filename);
          if (localPath) {
            await db.runAsync(
              `UPDATE commodities SET local_image = ? WHERE id = ?;`,
              [localPath, com.id]
            );
          }
        }
      }
      console.log("✅ Data komoditas berhasil disimpan dengan unit & gambar lokal");
    }

    // =========================
    // Simpan pasar/market
    // =========================
    if (results.markets) {
      await db.runAsync("DELETE FROM markets;");
      for (const market of results.markets) {
        await db.runAsync(
          `INSERT INTO markets (id, name_market, address) VALUES (?, ?, ?);`,
          [market.id, market.name_market || "-", market.location || "-"]
        );
      }
      console.log("✅ Data pasar berhasil disimpan");
    }

    console.log("📡 Sinkronisasi selesai");
  } catch (err) {
    console.error("❌ Gagal sync data:", err);
    throw err;
  }
};

// ====================================
// 💾 Tambah Data Harga
// ====================================
export const addPrice = async (commodityId, categoryId, price) => {
  const db = await getDatabase();
  const state = await NetInfo.fetch();
  const isOnline = state.isConnected;
  const token = await AsyncStorage.getItem("token");
  const now = new Date().toISOString();

  const commodity = await db.getFirstAsync(`SELECT name_commodity, unit FROM commodities WHERE id = ?;`, [commodityId]);
  const category = await db.getFirstAsync(`SELECT name_category FROM categories WHERE id = ?;`, [categoryId]);
  // fallback unit jika null
  const unit = commodity?.unit || "kg";

  if (isOnline && token) {
    try {
      const res = await fetch(api.ADD_PRICE, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ commodity_id: commodityId, price }),
      });

      if (res.ok) {
        await db.runAsync(
          `INSERT INTO local_prices (commodity_id, category_id, price, unit, created_at, synced)
           VALUES (?, ?, ?, ?, ?, 1);`,
          [commodityId, categoryId, price, unit, now]
        );

        await addRiwayatPendataan({
          name_commodity: commodity?.name_commodity || `Komoditas ${commodityId}`,
          price,
          unit,
          name_category: category?.name_category || "-",
          tanggal: now,
        });

        console.log("✅ Data online tersimpan & masuk riwayat");
        return;
      } else {
        console.warn("⚠️ Respon server addPrice bukan OK:", res.status);
      }
    } catch (err) {
      console.warn("⚠️ Gagal kirim ke server:", err);
    }
  }

  // Offline fallback
  await db.runAsync(
    `INSERT INTO local_prices (commodity_id, category_id, price, unit, created_at, synced)
     VALUES (?, ?, ?, ?, ?, 0);`,
    [commodityId, categoryId, price, unit, now]
  );
  console.log("📦 Data offline disimpan (belum tersinkron)");
};

// ====================================
// 🔄 Sinkronisasi Harga Lokal ke Server
// ====================================
export const syncPricesToServer = async () => {
  try {
    const db = await getDatabase();
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Token tidak ditemukan");

    const unsynced = await db.getAllAsync(`SELECT * FROM local_prices WHERE synced = 0;`);
    if (!unsynced?.length) return console.log("✅ Tidak ada data lokal yang perlu disinkron");

    for (const item of unsynced) {
      try {
        const res = await fetch(api.SYNC_PRICES, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ commodity_id: item.commodity_id, price: item.price }),
        });

        if (res.ok) {
          await db.runAsync(`UPDATE local_prices SET synced = 1 WHERE id = ?;`, [item.id]);

          const commodity = await db.getFirstAsync(`SELECT name_commodity FROM commodities WHERE id = ?;`, [item.commodity_id]);
          const category = await db.getFirstAsync(`SELECT name_category FROM categories WHERE id = ?;`, [item.category_id]);
          await addRiwayatPendataan({
            name_commodity: commodity?.name_commodity || `Komoditas ${item.commodity_id}`,
            price: item.price,
            unit: item.unit || "-",
            name_category: category?.name_category || "-",
            tanggal: item.created_at,
          });

          console.log(`✅ Data lokal ID ${item.id} tersinkron & masuk riwayat`);
        } else {
          console.warn("⚠️ syncPricesToServer: server returned", res.status);
        }
      } catch (err) {
        console.warn("⚠️ Gagal sinkron item ID", item.id, err);
      }
    }
  } catch (err) {
    console.error("❌ Gagal sync harga:", err);
  }
};

// ====================================
// 🔹 Wrapper untuk sinkronisasi
// ====================================
export const syncDataToServer = async () => {
  await syncPricesToServer();
};

// ====================================
// 🧾 Riwayat Hapus & Pendataan
// ====================================
export const addRiwayatHapus = async (item) => {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO riwayat_hapus (name_commodity, price, unit, name_category, tanggal)
     VALUES (?, ?, ?, ?, ?);`,
    [item.name_commodity, item.price, item.unit, item.name_category, item.tanggal]
  );
};

export const getRiwayatHapus = async () => {
  const db = await getDatabase();
  return await db.getAllAsync(`SELECT * FROM riwayat_hapus ORDER BY id DESC;`);
};

export const addRiwayatPendataan = async (item) => {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO riwayat_pendataan (name_commodity, price, unit, name_category, tanggal)
     VALUES (?, ?, ?, ?, ?);`,
    [item.name_commodity, item.price, item.unit, item.name_category, item.tanggal]
  );
};

export const getAllRiwayatPendataan = async () => {
  const db = await getDatabase();
  return await db.getAllAsync(`
    SELECT id, name_commodity, price, unit, name_category, tanggal
    FROM riwayat_pendataan
    ORDER BY tanggal DESC;
  `);
};

// ====================================
// 💾 Ambil Data Lokal / Dashboard / Helper
// ====================================
export const getAllLocalPrices = async () => {
  const db = await getDatabase();
  return await db.getAllAsync(`
    SELECT 
      p.id, 
      c.name_category, 
      co.id AS commodity_id,
      co.name_commodity AS name_commodity, 
      p.price, 
      p.unit, 
      p.synced, 
      p.created_at AS tanggal,
      co.local_image AS local_image,
      co.image AS image
    FROM local_prices p
    JOIN categories c ON p.category_id = c.id
    JOIN commodities co ON p.commodity_id = co.id
    ORDER BY p.created_at DESC;
  `);
};

export const deleteLocalPrice = async (id, itemData = null) => {
  const db = await getDatabase();
  if (itemData) {
    await addRiwayatHapus({
      name_commodity: itemData.name_commodity || "Tidak diketahui",
      price: itemData.price || 0,
      unit: itemData.unit || "-",
      name_category: itemData.name_category || "-",
      tanggal: new Date().toISOString(),
    });
  }
  await db.runAsync(`DELETE FROM local_prices WHERE id = ?;`, [id]);
};

export const getCategories = async () => {
  const db = await getDatabase();
  return await db.getAllAsync(`SELECT * FROM categories;`);
};

export const getCommoditiesByCategory = async (categoryId) => {
  const db = await getDatabase();
  return await db.getAllAsync(`SELECT * FROM commodities WHERE category_id = ?;`, [categoryId]);
};

export const getDashboardStats = async () => {
  const db = await getDatabase();
  const totalPrices = await db.getFirstAsync(`SELECT COUNT(*) AS total FROM local_prices;`);
  const offlineCount = await db.getFirstAsync(`SELECT COUNT(*) AS offline FROM local_prices WHERE synced = 0;`);
  const onlineCount = await db.getFirstAsync(`SELECT COUNT(*) AS online FROM local_prices WHERE synced = 1;`);

  return {
    total: totalPrices?.total || 0,
    offline: offlineCount?.offline || 0,
    online: onlineCount?.online || 0,
  };
};

export const getLatestPrices = async (limit = 20) => {
  const db = await getDatabase();
  return await db.getAllAsync(`
    SELECT 
      co.id AS commodity_id,
      co.name_commodity, 
      c.name_category, 
      p.price, 
      p.unit, 
      p.created_at AS tanggal,
      co.local_image AS local_image,
      co.image AS image
    FROM local_prices p
    JOIN commodities co ON p.commodity_id = co.id
    JOIN categories c ON p.category_id = c.id
    ORDER BY p.created_at DESC
    LIMIT ?;
  `, [limit]);
};

export const getLocalPricesForScreen = async (categoryId = null, commodityId = null) => {
  const db = await getDatabase();
  let query = `
    SELECT 
      p.id,
      co.id AS commodity_id,
      co.name_commodity,
      c.name_category,
      p.price,
      p.unit,
      p.synced,
      p.created_at AS tanggal,
      co.local_image AS local_image,
      co.image AS image
    FROM local_prices p
    JOIN categories c ON p.category_id = c.id
    JOIN commodities co ON p.commodity_id = co.id
    WHERE 1=1
  `;
  const params = [];

  if (categoryId) {
    query += ` AND p.category_id = ?`;
    params.push(categoryId);
  }

  if (commodityId) {
    query += ` AND p.commodity_id = ?`;
    params.push(commodityId);
  }

  query += ` ORDER BY p.created_at DESC;`;
  return await db.getAllAsync(query, params);
};

// Hitung komoditas unik
export const countUniqueCommodities = async () => {
  const db = await getDatabase();
  const result = await db.getFirstAsync(`
    SELECT COUNT(DISTINCT commodity_id) AS total FROM local_prices;
  `);
  return result?.total ?? 0;
};
