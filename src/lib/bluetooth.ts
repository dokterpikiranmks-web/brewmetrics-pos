// Sesuaikan jika Anda menggunakan library ESC/POS lain
// Di project BrewMetrics POS, generator ESC/POS biner internal tersedia di "@/lib/escpos"
// import { EscPos } from "@seodi/escpos-encoder";

// Deklarasi tipe global untuk Web Bluetooth API agar kompatibel dengan TypeScript
declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice: (options: any) => Promise<any>;
      getDevices?: () => Promise<any[]>;
    };
  }
}

// 1. Daftar Service UUID standar pabrikan printer thermal China (BLE)
export const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Generik Paling Umum
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // VSC / XPrinter
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC
  '0000fee7-0000-1000-8000-00805f9b34fb'  // WeChat BLE standard
];

// Alias untuk kompatibilitas
export const THERMAL_PRINTER_SERVICES = PRINTER_SERVICE_UUIDS;

// Helper untuk memberikan jeda waktu (delay)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 2. Mekanisme Chunking (Anti Buffer-Overflow)
 * Memecah data struk menjadi paket-paket kecil 256 bytes.
 */
export async function sendDataToPrinter(characteristic: any, uint8Array: Uint8Array) {
  const CHUNK_SIZE = 256; 
  
  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    const chunk = uint8Array.slice(i, i + CHUNK_SIZE);
    try {
      if (characteristic.properties?.writeWithoutResponse) {
        if (typeof characteristic.writeValueWithoutResponse === "function") {
          await characteristic.writeValueWithoutResponse(chunk);
        } else {
          await characteristic.writeValue(chunk);
        }
      } else {
        if (typeof characteristic.writeValueWithResponse === "function") {
          await characteristic.writeValueWithResponse(chunk);
        } else {
          await characteristic.writeValue(chunk);
        }
      }
      await delay(50);
    } catch (error) {
      console.error(`Gagal mengirim chunk pada posisi ${i}:`, error);
      throw error;
    }
  }
}

// Alias fungsi chunking
export const sendTextToPrinter = sendDataToPrinter;

/**
 * 3. Fungsi Utama Pencetakan Struk Bluetooth
 */
export async function printReceiptBluetooth(receiptData: Uint8Array): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.bluetooth) {
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        alert("Browser ini tidak mendukung Web Bluetooth. Gunakan Google Chrome versi terbaru.");
      }
      return false;
    }

    const device = await navigator.bluetooth.requestDevice({
      filters: PRINTER_SERVICE_UUIDS.map(uuid => ({ services: [uuid] })),
      optionalServices: PRINTER_SERVICE_UUIDS
    });

    if (!device || !device.gatt) {
      throw new Error("Perangkat gagal merespons GATT server.");
    }

    const server = await device.gatt.connect();
    let printerCharacteristic = null;

    for (const uuid of PRINTER_SERVICE_UUIDS) {
      try {
        const service = await server.getPrimaryService(uuid);
        if (service) {
          const characteristics = await service.getCharacteristics();
          printerCharacteristic = characteristics.find((c: any) => 
            c.properties?.write || c.properties?.writeWithoutResponse
          );
          if (printerCharacteristic) break; 
        }
      } catch (e) {
        continue;
      }
    }

    if (!printerCharacteristic) {
      throw new Error("Printer terhubung, tapi port penulisan (characteristic) tidak ditemukan.");
    }

    await sendDataToPrinter(printerCharacteristic, receiptData);

    if (device.gatt.connected) {
      device.gatt.disconnect();
    }
    
    return true;

  } catch (error: any) {
    console.error("Bluetooth Error:", error);
    
    if (error.name === 'NotFoundError') {
       console.warn("Kasir membatalkan popup pemilihan printer.");
    } else if (error.message && error.message.includes("Must be handling a user gesture")) {
       if (typeof window !== "undefined" && typeof window.alert === "function") {
         alert("Sistem memblokir. Anda harus mengklik tombol secara langsung untuk mulai mencari printer.");
       }
    } else {
       if (typeof window !== "undefined" && typeof window.alert === "function") {
         alert(`Gagal konek ke printer.\nPastikan printer menyala, bukan Bluetooth Classic, dan belum terhubung ke perangkat lain.\nInfo: ${error.message}`);
       }
    }
    
    return false;
  }
}

// Alias printRaw untuk kompatibilitas
export const printRaw = async (data: Uint8Array | string): Promise<{ success: boolean; error?: string }> => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const ok = await printReceiptBluetooth(bytes);
  return { success: ok, error: ok ? undefined : "Gagal mencetak struk bluetooth." };
};
