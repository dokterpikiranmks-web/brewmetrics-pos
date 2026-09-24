/**
 * Automated Test Suite for Web Bluetooth & ESC/POS Driver
 * Tests the exact implementation of src/lib/bluetooth.ts:
 * 1. PRINTER_SERVICE_UUIDS specification
 * 2. sendDataToPrinter chunking (256 bytes max, 50ms delay, error handling)
 * 3. printReceiptBluetooth full flow, alerts, GATT disconnect, and error fallbacks
 */

import {
  PRINTER_SERVICE_UUIDS,
  sendDataToPrinter,
  printReceiptBluetooth,
  printRaw,
} from "../src/lib/bluetooth";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    testsFailed++;
  }
}

async function runTestSuite() {
  console.log("=================================================");
  console.log("   TEST SUITE: Web Bluetooth ESC/POS Driver");
  console.log("=================================================\n");

  // -------------------------------------------------------------------------
  // TEST 1: Service UUIDs
  // -------------------------------------------------------------------------
  console.log("👉 [1] Testing PRINTER_SERVICE_UUIDS:");

  const expectedUuids = [
    '000018f0-0000-1000-8000-00805f9b34fb', // Generik Paling Umum
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // VSC / XPrinter
    '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC
    '0000fee7-0000-1000-8000-00805f9b34fb'  // WeChat BLE standard
  ];

  for (const uuid of expectedUuids) {
    assert(
      PRINTER_SERVICE_UUIDS.includes(uuid),
      `UUID '${uuid}' is present in PRINTER_SERVICE_UUIDS`
    );
  }
  assert(
    PRINTER_SERVICE_UUIDS.length === 4,
    `PRINTER_SERVICE_UUIDS contains exact 4 standard BLE services`
  );

  // -------------------------------------------------------------------------
  // TEST 2: sendDataToPrinter Chunking & Delay
  // -------------------------------------------------------------------------
  console.log("\n👉 [2] Testing sendDataToPrinter Chunking (256 bytes) & 50ms Delay:");

  const totalBytes = 700;
  const testData = new Uint8Array(totalBytes);
  for (let i = 0; i < totalBytes; i++) {
    testData[i] = i % 256;
  }

  const chunksReceived: Uint8Array[] = [];
  const mockCharWithoutResp = {
    properties: { writeWithoutResponse: true, write: false },
    writeValueWithoutResponse: async (chunk: Uint8Array) => {
      chunksReceived.push(new Uint8Array(chunk));
    },
  };

  const startTime = Date.now();
  await sendDataToPrinter(mockCharWithoutResp, testData);
  const elapsed = Date.now() - startTime;

  assert(
    chunksReceived.length === 3,
    `Payload 700 bytes sliced into 3 chunks (actual: ${chunksReceived.length})`
  );

  assert(
    chunksReceived[0].length === 256 &&
    chunksReceived[1].length === 256 &&
    chunksReceived[2].length === 188,
    `Chunk sizes adhere to 256 bytes: [${chunksReceived.map(c => c.length).join(", ")}]`
  );

  assert(
    elapsed >= 140,
    `50ms delay between chunks applied (elapsed time: ${elapsed}ms)`
  );

  // Check data integrity
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const c of chunksReceived) {
    combined.set(c, offset);
    offset += c.length;
  }
  let isIdentical = true;
  for (let i = 0; i < totalBytes; i++) {
    if (combined[i] !== testData[i]) {
      isIdentical = false;
      break;
    }
  }
  assert(isIdentical, "Data chunk reassembly matches original 100%");

  // Test writeValue fallback when writeWithoutResponse is false
  const standardChunks: Uint8Array[] = [];
  const mockCharWithResp = {
    properties: { writeWithoutResponse: false, write: true },
    writeValue: async (chunk: Uint8Array) => {
      standardChunks.push(new Uint8Array(chunk));
    },
  };
  await sendDataToPrinter(mockCharWithResp, new Uint8Array([10, 20, 30]));
  assert(
    standardChunks.length === 1 && standardChunks[0].length === 3,
    "sendDataToPrinter uses writeValue() when writeWithoutResponse is false"
  );

  // -------------------------------------------------------------------------
  // TEST 3: printReceiptBluetooth Full Flow & Fallbacks
  // -------------------------------------------------------------------------
  console.log("\n👉 [3] Testing printReceiptBluetooth & Error Fallbacks:");

  let alertMessage = "";
  (globalThis as any).window = {
    alert: (msg: string) => {
      alertMessage = msg;
    },
  };
  (globalThis as any).alert = (msg: string) => {
    alertMessage = msg;
  };

  const setMockBluetooth = (bt: any) => {
    try {
      Object.defineProperty(globalThis, "navigator", {
        value: { ...(globalThis.navigator || {}), bluetooth: bt },
        configurable: true,
        writable: true,
      });
    } catch {
      try {
        Object.defineProperty(navigator, "bluetooth", {
          value: bt,
          configurable: true,
          writable: true,
        });
      } catch {}
    }
  };

  // 3a. Navigator bluetooth missing
  setMockBluetooth(undefined);
  alertMessage = "";
  let ok = await printReceiptBluetooth(new Uint8Array([1, 2, 3]));
  assert(
    ok === false && alertMessage.includes("tidak mendukung Web Bluetooth"),
    "Alerts user when navigator.bluetooth is not available"
  );

  // 3b. Kasir cancels requestDevice popup
  setMockBluetooth({
    requestDevice: async () => {
      const err = new Error("User cancelled");
      err.name = "NotFoundError";
      throw err;
    },
  });
  alertMessage = "";
  ok = await printReceiptBluetooth(new Uint8Array([1, 2, 3]));
  assert(
    ok === false && alertMessage === "",
    "Cleanly ignores cancelation when user dismisses requestDevice (NotFoundError)"
  );

  // 3c. User gesture blocked
  setMockBluetooth({
    requestDevice: async () => {
      throw new Error("Must be handling a user gesture to show a permission request.");
    },
  });
  alertMessage = "";
  ok = await printReceiptBluetooth(new Uint8Array([1, 2, 3]));
  assert(
    ok === false && alertMessage.includes("Sistem memblokir"),
    "Alerts cashier when user gesture is required"
  );

  // 3d. Successful connection, characteristic finding, printing, and disconnect
  let disconnected: any = false;
  let printedBytes: Uint8Array[] = [];

  const mockService = {
    getCharacteristics: async () => [
      {
        properties: { write: true, writeWithoutResponse: false },
        writeValue: async (chunk: Uint8Array) => {
          printedBytes.push(new Uint8Array(chunk));
        },
      },
    ],
  };

  const mockDevice = {
    gatt: {
      connected: true,
      connect: async () => ({
        getPrimaryService: async (uuid: string) => {
          if (uuid === 'e7810a71-73ae-499d-8c15-faa9aef0c3f2') {
            return mockService;
          }
          throw new Error("Service not found");
        },
      }),
      disconnect: () => {
        disconnected = true;
      },
    },
  };

  let requestedOptions: any = null;
  setMockBluetooth({
    requestDevice: async (opts: any) => {
      requestedOptions = opts;
      return mockDevice;
    },
  });

  const receipt = new Uint8Array([0x1b, 0x40, 0x31, 0x32, 0x33, 0x0a]);
  ok = await printReceiptBluetooth(receipt);

  assert(
    ok === true,
    "printReceiptBluetooth completes successfully"
  );
  assert(
    requestedOptions &&
    requestedOptions.filters.length === 4 &&
    requestedOptions.optionalServices.length === 4,
    "requestDevice called with filters and optionalServices matching PRINTER_SERVICE_UUIDS"
  );
  assert(
    printedBytes.length > 0 && printedBytes[0].length === receipt.length,
    "Receipt binary buffer sent to printer characteristic"
  );
  assert(
    Boolean(disconnected),
    "device.gatt.disconnect() is called after print completes to free BLE connection"
  );

  // 3e. printRaw alias integration
  const rawRes = await printRaw(new Uint8Array([1, 2, 3]));
  assert(
    rawRes.success === true,
    "printRaw alias function works properly"
  );

  // Summary
  console.log("\n=================================================");
  console.log(`   TOTAL TESTS: ${testsPassed + testsFailed}`);
  console.log(`   PASSED:      ${testsPassed}`);
  console.log(`   FAILED:      ${testsFailed}`);
  console.log("=================================================");

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Status: PASS\n");
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
