/**
 * Web Bluetooth Driver for ESC/POS Thermal Printers
 * Supports standard thermal printer UUID fallbacks, automatic reconnect via localStorage,
 * and chunked binary buffer printing.
 */

// Universal Bluetooth UUIDs for Thermal Receipt Printers & BLE Serial SPP
export const THERMAL_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Standard ESC/POS Thermal Service (0x18F0)
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Common Rongta/Xprinter POS Service
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC Transparent UART
  "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 / Common BLE POS UART (0xFFE0)
  "0000ff00-0000-1000-8000-00805f9b34fb", // Generic POS UART (0xFF00)
  "00001101-0000-1000-8000-00805f9b34fb", // Standard SPP Service (0x1101)
];

export const THERMAL_PRINTER_CHARACTERISTICS = [
  "00002af1-0000-1000-8000-00805f9b34fb", // Standard Printer Data Write
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f", // Rongta Write
  "49535343-8841-43f4-a8d4-ecbe34729bb3", // ISSC Write
  "0000ffe1-0000-1000-8000-00805f9b34fb", // HM-10 Write
  "0000ff01-0000-1000-8000-00805f9b34fb", // POS Write
  "0000ff02-0000-1000-8000-00805f9b34fb", // Secondary POS Write
];

const STORAGE_KEY = "bm_bt_printer_device";

// Type definitions for Web Bluetooth API compatibility without external typings
interface BluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: {
    connected: boolean;
    connect: () => Promise<BluetoothRemoteGATTServerLike>;
    disconnect: () => void;
  };
  addEventListener: (type: string, listener: (ev: Event) => void) => void;
  removeEventListener: (type: string, listener: (ev: Event) => void) => void;
}

interface BluetoothRemoteGATTServerLike {
  connected: boolean;
  device: BluetoothDeviceLike;
  getPrimaryService: (service: string | number) => Promise<BluetoothRemoteGATTServiceLike>;
  getPrimaryServices: () => Promise<BluetoothRemoteGATTServiceLike[]>;
  disconnect: () => void;
}

interface BluetoothRemoteGATTServiceLike {
  uuid: string;
  getCharacteristic: (characteristic: string | number) => Promise<BluetoothRemoteGATTCharacteristicLike>;
  getCharacteristics: () => Promise<BluetoothRemoteGATTCharacteristicLike[]>;
}

interface BluetoothRemoteGATTCharacteristicLike {
  uuid: string;
  properties: {
    write: boolean;
    writeWithoutResponse: boolean;
  };
  writeValue?: (value: BufferSource) => Promise<void>;
  writeValueWithResponse?: (value: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
}

// Module-level connection state
let connectedDevice: BluetoothDeviceLike | null = null;
let activeCharacteristic: BluetoothRemoteGATTCharacteristicLike | null = null;

function getBluetooth(): any {
  if (typeof window !== "undefined" && typeof navigator !== "undefined") {
    return (navigator as any).bluetooth;
  }
  return null;
}

/**
 * Cek apakah peramban saat ini mendukung Web Bluetooth API.
 */
export function isBluetoothSupported(): boolean {
  return Boolean(getBluetooth());
}

/**
 * Cek status koneksi aktif printer saat ini.
 */
export function isPrinterConnected(): boolean {
  return Boolean(
    connectedDevice &&
      connectedDevice.gatt?.connected &&
      activeCharacteristic
  );
}

/**
 * Mengambil nama perangkat printer yang sedang terhubung.
 */
export function getConnectedPrinterName(): string | null {
  return connectedDevice?.name || null;
}

/**
 * Membaca data perangkat printer tersimpan dari localStorage.
 */
export function getSavedPrinter(): { id: string; name?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Simpan ID/MAC perangkat printer ke localStorage untuk reconnect otomatis.
 */
export function savePrinterToStorage(device: BluetoothDeviceLike) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        id: device.id,
        name: device.name || "Bluetooth Thermal Printer",
        lastConnected: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.warn("Gagal menyimpan identitas printer ke localStorage:", err);
  }
}

/**
 * Hapus data printer tersimpan dari localStorage.
 */
export function clearSavedPrinter() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Cari karakteristik printer yang dapat ditulisi (writeable).
 */
async function findWriteCharacteristic(
  server: BluetoothRemoteGATTServerLike
): Promise<BluetoothRemoteGATTCharacteristicLike | null> {
  // Coba ambil seluruh service primer yang didukung
  let services: BluetoothRemoteGATTServiceLike[] = [];
  try {
    services = await server.getPrimaryServices();
  } catch {
    // Jika getPrimaryServices() gagal, coba per service UUID yang diketahui
    for (const serviceUuid of THERMAL_PRINTER_SERVICES) {
      try {
        const s = await server.getPrimaryService(serviceUuid);
        services.push(s);
      } catch {}
    }
  }

  for (const service of services) {
    try {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        // Prioritaskan karakteristik yang terdaftar di daftar standar atau yang memiliki properti write
        const isKnown = THERMAL_PRINTER_CHARACTERISTICS.includes(char.uuid.toLowerCase());
        const canWrite =
          char.properties.writeWithoutResponse || char.properties.write;
        if (isKnown || canWrite) {
          return char;
        }
      }
    } catch {}
  }

  return null;
}

function handleDisconnection() {
  console.log("Printer thermal bluetooth terputus.");
  activeCharacteristic = null;
}

/**
 * Hubungkan printer thermal via Web Bluetooth API.
 * Menampilkan dialog pemilihan perangkat bawaan browser jika belum terkoneksi.
 */
export async function connectPrinter(): Promise<{
  success: boolean;
  deviceName?: string;
  error?: string;
}> {
  const bt = getBluetooth();
  if (!bt) {
    return {
      success: false,
      error:
        "Web Bluetooth API tidak didukung di browser ini. Gunakan Google Chrome di Android/Windows/Mac.",
    };
  }

  try {
    // Jika sudah terhubung, langsung kembalikan status aktif
    if (isPrinterConnected()) {
      return {
        success: true,
        deviceName: connectedDevice?.name || "Bluetooth Printer",
      };
    }

    // Buka dialog Web Bluetooth dengan filter standar thermal printer
    const device: BluetoothDeviceLike = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: THERMAL_PRINTER_SERVICES,
    });

    if (!device.gatt) {
      throw new Error("Perangkat tidak memiliki antarmuka Bluetooth GATT.");
    }

    // Dengarkan event pemutusan koneksi
    device.removeEventListener("gattserverdisconnected", handleDisconnection);
    device.addEventListener("gattserverdisconnected", handleDisconnection);

    // Buka koneksi GATT Server
    const server = await device.gatt.connect();

    // Cari karakteristik write
    const char = await findWriteCharacteristic(server);
    if (!char) {
      throw new Error(
        "Karakteristik penulisan (write characteristic) printer thermal tidak ditemukan."
      );
    }

    connectedDevice = device;
    activeCharacteristic = char;

    // Simpan ke localStorage agar dapat disambungkan kembali secara otomatis
    savePrinterToStorage(device);

    return {
      success: true,
      deviceName: device.name || "Bluetooth Printer",
    };
  } catch (err: any) {
    console.error("connectPrinter error:", err);
    if (err.name === "NotFoundError") {
      return { success: false, error: "Pemilihan perangkat printer dibatalkan." };
    }
    return {
      success: false,
      error: err.message || "Gagal menghubungkan ke printer bluetooth.",
    };
  }
}

/**
 * Coba hubungkan ulang (auto-reconnect) secara otomatis saat aplikasi dibuka
 * menggunakan ID perangkat yang tersimpan di localStorage.
 */
export async function autoReconnectPrinter(): Promise<boolean> {
  const bt = getBluetooth();
  if (!bt || typeof bt.getDevices !== "function") return false;

  const saved = getSavedPrinter();
  if (!saved || !saved.id) return false;

  try {
    const devices: BluetoothDeviceLike[] = await bt.getDevices();
    const matched = devices.find((d) => d.id === saved.id);
    if (!matched || !matched.gatt) return false;

    matched.removeEventListener("gattserverdisconnected", handleDisconnection);
    matched.addEventListener("gattserverdisconnected", handleDisconnection);

    const server = await matched.gatt.connect();
    const char = await findWriteCharacteristic(server);
    if (!char) return false;

    connectedDevice = matched;
    activeCharacteristic = char;
    return true;
  } catch (err) {
    console.warn("Gagal auto-reconnect printer bluetooth:", err);
    return false;
  }
}

/**
 * Putuskan koneksi printer aktif.
 */
export async function disconnectPrinter(): Promise<void> {
  if (connectedDevice?.gatt?.connected) {
    try {
      connectedDevice.gatt.disconnect();
    } catch {}
  }
  connectedDevice = null;
  activeCharacteristic = null;
}

/**
 * Kirim buffer biner mentah (ESC/POS) ke printer bluetooth.
 * Mengirim dalam pecahan chunk (100 byte) dengan delay untuk mencegah buffer overrun.
 */
export async function printRaw(
  data: Uint8Array
): Promise<{ success: boolean; error?: string }> {
  // Jika belum terkoneksi, coba reconnect otomatis terlebih dahulu
  if (!isPrinterConnected()) {
    const reconnected = await autoReconnectPrinter();
    if (!reconnected) {
      return {
        success: false,
        error: "Printer bluetooth belum terhubung. Silakan hubungkan printer terlebih dahulu.",
      };
    }
  }

  if (!activeCharacteristic) {
    return {
      success: false,
      error: "Karakteristik printer bluetooth tidak aktif.",
    };
  }

  try {
    const CHUNK_SIZE = 100; // Ukuran chunk aman untuk buffer BLE thermal printer
    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      const chunk = data.slice(offset, offset + CHUNK_SIZE);

      if (activeCharacteristic.writeValueWithoutResponse) {
        await activeCharacteristic.writeValueWithoutResponse(chunk);
      } else if (activeCharacteristic.writeValue) {
        await activeCharacteristic.writeValue(chunk);
      } else {
        throw new Error("Karakteristik tidak mendukung perintah writeValue.");
      }

      // Berikan jeda kecil antar chunk
      if (offset + CHUNK_SIZE < data.length) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("printRaw error:", err);
    return {
      success: false,
      error: err.message || "Terjadi kesalahan saat mencetak ke printer bluetooth.",
    };
  }
}
