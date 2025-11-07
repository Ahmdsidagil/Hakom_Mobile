// config/database.js
import * as SQLite from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import api from "./api";

let db;

// ====================================
// 🔹 Inisialisasi Database
// ====================================
export const initDatabase = async () => {
  if (!db) db = SQLite.openDatabaseAsync("local_market.db");

  // Tabel kategori
  await db.execAsync?.(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name_category TEXT
    );
  `);

  // Tabel komoditas
  await db.execAsync?.(`
    CREATE TABLE IF NOT EXISTS commodities (
      id INTEGER PRIMARY KEY,
      name_commodity TEXT,
      category_id INTEGER,
      unit TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);

  // Tabel pasar
  await db.execAsync?.(`
    CREATE TABLE IF NOT EXISTS markets (
      id INTEGER PRIMARY KEY,
      name_market TEXT,
      location TEXT
    );
  `);

  // Tabel harga lokal
  await db.execAsync?.(`
    CREATE TABLE IF NOT EXISTS local_prices (
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
    );
  `);

  // Tabel riwayat hapus
  await db.execAsync?.(`
    CREATE TABLE IF NOT EXISTS riwayat_hapus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_commodity TEXT,
      price REAL,
      unit TEXT,
      name_category TEXT,
      tanggal TEXT
    );
  `);

  // Tabel riwayat pendataan
  await db.execAsync?.(`
    CREATE TABLE IF NOT EXISTS riwayat_pendataan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_commodity TEXT,
      price REAL,
      unit TEXT,
      name_category TEXT,
      tanggal TEXT
    );
  `);

  console.log("✅ Database & tabel lokal siap digunakan");
};

// ====================================
// 🔸 Ambil database instance
// ====================================
export const getDatabase = async () => {
  if (!db) await initDatabase();
  return db;
};

// ====================================
// 🔹 Sinkronisasi Data dari Server
// ====================================
export const syncFromServer = async () => {
  try {
    console.log("📡 Sinkronisasi data kategori, komoditas, & pasar...");
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Token tidak ditemukan");

    const [catRes, comRes, marketRes] = await Promise.all([
      fetch(api.CATEGORIES, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(api.COMMODITIES, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(api.GET_MARKET, { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (!catRes.ok || !comRes.ok || !marketRes.ok)
      throw new Error(`Server error: ${catRes.status}/${comRes.status}/${marketRes.status}`);

    const categories = await catRes.json();
    const commodities = await comRes.json();
    const markets = await marketRes.json();

    const db = await getDatabase();

    await db.execAsync?.("DELETE FROM categories;");
    await db.execAsync?.("DELETE FROM commodities;");
    await db.execAsync?.("DELETE FROM markets;");

    for (const cat of categories) {
      await db.runAsync?.(
        `INSERT INTO categories (id, name_category) VALUES (?, ?);`,
        [cat.id, cat.name_category]
      );
    }

    for (const com of commodities) {
      const categoryId = com.category_id || com.category?.id || null;
      await db.runAsync?.(
        `INSERT INTO commodities (id, name_commodity, category_id, unit) VALUES (?, ?, ?, ?);`,
        [com.id, com.name_commodity, categoryId, com.unit]
      );
    }

    for (const market of markets) {
      await db.runAsync?.(
        `INSERT INTO markets (id, name_market, location) VALUES (?, ?, ?);`,
        [market.id, market.name_market, market.location]
      );
    }

    console.log("✅ Data dari server berhasil disimpan ke lokal");
  } catch (err) {
    console.error("❌ Gagal sync data:", err);
  }
};

// ====================================
// 💾 Tambah Data Harga (Offline + Online)
// ====================================
export const addPrice = async (commodityId, categoryId, price, unit) => {
  try {
    const db = await getDatabase();
    const state = await NetInfo.fetch();
    const isOnline = state.isConnected;
    const token = await AsyncStorage.getItem("token");

    const now = new Date().toISOString();

    let serverSent = false;
    if (isOnline && token) {
      try {
        const res = await fetch(api.ADD_PRICE, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            commodity_id: commodityId,
            category_id: categoryId,
            price,
            unit,
            tanggal: now,
          }),
        });
        if (res.ok) serverSent = true;
      } catch (err) {
        console.warn("⚠️ Gagal kirim ke server:", err);
      }
    }

    if (!serverSent) {
      await db.runAsync?.(
        `INSERT INTO local_prices (commodity_id, category_id, price, unit, created_at)
         VALUES (?, ?, ?, ?, ?);`,
        [commodityId, categoryId, price, unit, now]
      );
    }

    const commodity = await db.getFirstAsync?.(
      `SELECT name_commodity FROM commodities WHERE id = ?;`,
      [commodityId]
    );
    const category = await db.getFirstAsync?.(
      `SELECT name_category FROM categories WHERE id = ?;`,
      [categoryId]
    );

    await addRiwayatPendataan({
      name_commodity: commodity?.name_commodity || `Komoditas ${commodityId}`,
      price,
      unit: unit || "-",
      name_category: category?.name_category || "-",
      tanggal: now,
    });
  } catch (error) {
    console.error("❌ Gagal menambahkan harga:", error);
  }
};

// ====================================
// 🔄 Sinkronisasi Harga Lokal ke Server
// ====================================
export const syncPricesToServer = async () => {
  try {
    const db = await getDatabase();
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Token tidak ditemukan");

    const unsynced = await db.getAllAsync?.(`SELECT * FROM local_prices WHERE synced = 0;`);

    for (const item of unsynced) {
      try {
        const res = await fetch(api.ADD_PRICE, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            commodity_id: item.commodity_id,
            category_id: item.category_id,
            price: item.price,
            unit: item.unit,
          }),
        });
        if (res.ok) {
          await db.runAsync?.(`UPDATE local_prices SET synced = 1 WHERE id = ?;`, [item.id]);
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
// 🧩 Query untuk UI
// ====================================
export const getCategories = async () => {
  const db = await getDatabase();
  return await db.getAllAsync?.(`SELECT * FROM categories;`);
};

export const getCommoditiesByCategory = async (categoryId) => {
  const db = await getDatabase();
  return await db.getAllAsync?.(`SELECT * FROM commodities WHERE category_id = ?;`, [categoryId]);
};

export const getAllLocalPrices = async () => {
  const db = await getDatabase();
  return await db.getAllAsync?.(`
    SELECT 
      p.id, 
      c.name_category, 
      co.name_commodity AS name_commodity, 
      p.price, 
      p.unit, 
      p.synced, 
      p.created_at AS tanggal
    FROM local_prices p
    JOIN categories c ON p.category_id = c.id
    JOIN commodities co ON p.commodity_id = co.id
    ORDER BY p.created_at DESC;
  `);
};

// ====================================
// 🗑️ Hapus Data Lokal + Riwayat
// ====================================
export const deleteLocalPrice = async (id, itemData = null) => {
  try {
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

    await db.runAsync?.(`DELETE FROM local_prices WHERE id = ?;`, [id]);
  } catch (error) {
    console.error("❌ Gagal hapus data lokal:", error);
  }
};

// ====================================
// 🧾 Riwayat Hapus
// ====================================
export const addRiwayatHapus = async (item) => {
  try {
    const db = await getDatabase();
    await db.runAsync?.(
      `INSERT INTO riwayat_hapus (name_commodity, price, unit, name_category, tanggal)
       VALUES (?, ?, ?, ?, ?);`,
      [item.name_commodity, item.price, item.unit, item.name_category, item.tanggal]
    );
  } catch (error) {
    console.error("❌ Gagal menyimpan riwayat hapus:", error);
  }
};

export const getRiwayatHapus = async () => {
  try {
    const db = await getDatabase();
    return await db.getAllAsync?.(`SELECT * FROM riwayat_hapus ORDER BY id DESC;`);
  } catch (error) {
    console.error("❌ Gagal mengambil riwayat hapus:", error);
    return [];
  }
};

// ====================================
// 🧾 Riwayat Pendataan
// ====================================
export const addRiwayatPendataan = async (item) => {
  try {
    const db = await getDatabase();
    await db.runAsync?.(
      `INSERT INTO riwayat_pendataan (name_commodity, price, unit, name_category, tanggal)
       VALUES (?, ?, ?, ?, ?);`,
      [item.name_commodity, item.price, item.unit, item.name_category, item.tanggal]
    );
  } catch (error) {
    console.error("❌ Gagal menyimpan riwayat pendataan:", error);
  }
};

export const getAllRiwayatPendataan = async () => {
  try {
    const db = await getDatabase();
    return await db.getAllAsync?.(`
      SELECT id, name_commodity, price, unit, name_category, tanggal
      FROM riwayat_pendataan
      ORDER BY tanggal DESC;
    `);
  } catch (error) {
    console.error("❌ Gagal mengambil riwayat pendataan:", error);
    return [];
  }
};
