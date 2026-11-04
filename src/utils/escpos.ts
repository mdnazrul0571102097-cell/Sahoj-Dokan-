/**
 * ESC/POS Direct Thermal Printer Utility
 * Supports direct Bluetooth (BLE & Classic RFCOMM via native Android bridge) and USB Serial
 * Zero PDF or PrintManager dialogs required.
 */

import { Sale, ShopProfile } from '../types';

export class EscPosEncoder {
  private buffer: number[] = [];

  constructor() {
    this.init();
  }

  // Initialize printer
  init(): this {
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  // Set alignment: 0=Left, 1=Center, 2=Right
  align(align: 'left' | 'center' | 'right'): this {
    const val = align === 'center' ? 1 : align === 'right' ? 2 : 0;
    this.buffer.push(0x1b, 0x61, val);
    return this;
  }

  // Bold text
  bold(enable: boolean): this {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0);
    return this;
  }

  // Double height & width (for shop title)
  textSize(size: 'normal' | 'double' | 'large'): this {
    if (size === 'large') {
      this.buffer.push(0x1b, 0x21, 0x30); // Double height & width
    } else if (size === 'double') {
      this.buffer.push(0x1b, 0x21, 0x10); // Double height
    } else {
      this.buffer.push(0x1b, 0x21, 0x00); // Normal
    }
    return this;
  }

  // Add plain text
  text(str: string): this {
    const bytes = new TextEncoder().encode(str);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  // Add line
  line(str: string = ''): this {
    this.text(str);
    this.buffer.push(0x0a);
    return this;
  }

  // Add horizontal rule divider
  divider(char: string = '-', width: number = 32): this {
    this.line(char.repeat(width));
    return this;
  }

  // Left & Right aligned pair in single line (for 32/48 char thermal paper)
  tableRow(left: string, right: string, width: number = 32): this {
    const spaceNeeded = width - (left.length + right.length);
    if (spaceNeeded <= 0) {
      this.line(left);
      this.line(' '.repeat(Math.max(0, width - right.length)) + right);
    } else {
      this.line(left + ' '.repeat(spaceNeeded) + right);
    }
    return this;
  }

  // Feed lines
  feed(lines: number = 3): this {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  // Full paper cut
  cut(): this {
    this.buffer.push(0x1d, 0x56, 0x41, 0x03);
    return this;
  }

  // Get raw byte array
  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  // Get Base64 encoded string for native Android bridge
  toBase64(): string {
    const binary = String.fromCharCode.apply(null, Array.from(this.getBytes()));
    return btoa(binary);
  }
}

/**
 * Builds the complete ESC/POS binary receipt for a sale
 */
export function buildEscPosReceipt(sale: Sale, profile: ShopProfile, paperWidth: 32 | 48 = 32): EscPosEncoder {
  const enc = new EscPosEncoder();

  // 1. Header (Centered, bold title)
  enc.align('center');
  enc.textSize('large').bold(true);
  enc.line(profile.shopName || 'Sahoj Dokan POS');
  enc.textSize('normal').bold(false);

  if (profile.address) {
    enc.line(profile.address);
  }
  enc.line(`Mobile: ${profile.phone}`);
  enc.divider('=', paperWidth);

  // 2. Invoice Meta (Left aligned)
  enc.align('left');
  enc.tableRow(`Inv: #${sale.invoiceNo}`, new Date(sale.date).toLocaleDateString('en-GB'), paperWidth);
  enc.tableRow(`Customer:`, sale.customerName || 'Cash Buyer', paperWidth);
  enc.divider('-', paperWidth);

  // 3. Table Header
  enc.tableRow('Item / Qty x Rate', 'Total (Tk)', paperWidth);
  enc.divider('-', paperWidth);

  // 4. Items List
  sale.items.forEach((item, index) => {
    enc.line(`${index + 1}. ${item.productName}`);
    const qtyRate = `   ${item.quantity} ${item.unit} x Tk ${item.unitPrice}`;
    const total = `Tk ${item.totalPrice}`;
    enc.tableRow(qtyRate, total, paperWidth);
  });

  enc.divider('-', paperWidth);

  // 5. Financial Totals
  enc.tableRow('Subtotal:', `Tk ${sale.subTotal}`, paperWidth);
  if (sale.discount > 0) {
    enc.tableRow('Discount:', `-Tk ${sale.discount}`, paperWidth);
  }

  enc.bold(true);
  enc.tableRow('GRAND TOTAL:', `Tk ${sale.grandTotal}`, paperWidth);
  enc.bold(false);

  enc.tableRow('Paid Amount:', `Tk ${sale.paidAmount}`, paperWidth);
  if (sale.dueAmount > 0) {
    enc.bold(true);
    enc.tableRow('DUE (Baki):', `Tk ${sale.dueAmount}`, paperWidth);
    enc.bold(false);
  } else {
    enc.tableRow('Change Return:', `Tk ${sale.changeAmount}`, paperWidth);
  }

  enc.divider('=', paperWidth);

  // 6. Footer Note
  enc.align('center');
  enc.line('Thank you! Please visit again.');
  enc.line('Powered by Sahoj Dokan POS');
  enc.feed(3);
  enc.cut();

  return enc;
}

/**
 * Builds the complete ESC/POS binary receipt for Day Close closing slip
 */
export function buildEscPosDayCloseReceipt(
  data: {
    shopName: string;
    phone: string;
    address?: string;
    dateStr: string;
    timeStr: string;
    openingCash: number;
    cashSales: number;
    dueSales: number;
    totalSales: number;
    totalProfit: number;
    customerDueCollected: number;
    ownerDeposit: number;
    cashPurchases: number;
    shopExpenses: number;
    supplierDuePaid: number;
    ownerWithdrawal: number;
    expectedCash: number;
    actualCash?: number;
    difference?: number;
    note?: string;
  },
  paperWidth: 32 | 48 = 32
): EscPosEncoder {
  const enc = new EscPosEncoder();

  // Header
  enc.align('center');
  enc.textSize('large').bold(true);
  enc.line(data.shopName || 'Sahoj Dokan POS');
  enc.textSize('normal').bold(false);

  if (data.address) {
    enc.line(data.address);
  }
  enc.line(`Mobile: ${data.phone}`);
  enc.divider('=', paperWidth);

  enc.bold(true);
  enc.line('DAILY DAY CLOSE SLIP');
  enc.line('(দৈনিক দোকান ক্লোজিং স্লিপ)');
  enc.bold(false);
  enc.divider('-', paperWidth);

  enc.align('left');
  enc.tableRow('Date / Time:', `${data.dateStr} ${data.timeStr}`, paperWidth);
  enc.divider('-', paperWidth);

  // Financial summary
  enc.tableRow('Opening Cash:', `Tk ${data.openingCash}`, paperWidth);
  enc.tableRow('Total Sales:', `Tk ${data.totalSales}`, paperWidth);
  enc.tableRow(' - Cash Sales:', `Tk ${data.cashSales}`, paperWidth);
  if (data.dueSales > 0) {
    enc.tableRow(' - Due Sales:', `Tk ${data.dueSales}`, paperWidth);
  }
  enc.tableRow('Gross Profit:', `Tk ${data.totalProfit}`, paperWidth);
  enc.divider('-', paperWidth);

  if (data.customerDueCollected > 0) {
    enc.tableRow('Due Collected In:', `Tk ${data.customerDueCollected}`, paperWidth);
  }
  if (data.ownerDeposit > 0) {
    enc.tableRow('Owner Capital In:', `Tk ${data.ownerDeposit}`, paperWidth);
  }

  enc.tableRow('Cash Purchases:', `Tk ${data.cashPurchases}`, paperWidth);
  enc.tableRow('Shop Expenses:', `Tk ${data.shopExpenses}`, paperWidth);
  if (data.supplierDuePaid > 0) {
    enc.tableRow('Supplier Paid:', `Tk ${data.supplierDuePaid}`, paperWidth);
  }
  if (data.ownerWithdrawal > 0) {
    enc.tableRow('Owner Withdraw:', `Tk ${data.ownerWithdrawal}`, paperWidth);
  }
  enc.divider('=', paperWidth);

  enc.bold(true);
  enc.textSize('double');
  enc.tableRow('EXPECTED CASH:', `Tk ${data.expectedCash}`, paperWidth);
  enc.textSize('normal');

  if (typeof data.actualCash === 'number' && !isNaN(data.actualCash)) {
    enc.tableRow('Physical Drawer:', `Tk ${data.actualCash}`, paperWidth);
    const diff = data.difference || 0;
    const diffText =
      diff === 0
        ? 'MATCHED (Mil ache)'
        : diff > 0
        ? `+Tk ${diff} (Extra)`
        : `-Tk ${Math.abs(diff)} (Short)`;
    enc.tableRow('Status:', diffText, paperWidth);
  }
  enc.bold(false);

  if (data.note) {
    enc.divider('-', paperWidth);
    enc.line(`Note: ${data.note}`);
  }

  enc.divider('=', paperWidth);
  enc.align('center');
  enc.line('Shop Closed Successfully.');
  enc.line('Powered by Sahoj Dokan POS');
  enc.feed(3);
  enc.cut();

  return enc;
}

/**
 * Direct Bluetooth Thermal Printing via Web Bluetooth API
 */
export async function printDirectWebBluetooth(escPosBytes: Uint8Array): Promise<{ success: boolean; message: string }> {
  if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
    return {
      success: false,
      message: 'আপনার ব্রাউজারে Web Bluetooth সাপোর্ট করে না। দয়া করে Chrome ব্রাউজার ব্যবহার করুন।',
    };
  }

  try {
    // Standard Bluetooth thermal printer service UUIDs
    const PRINTER_SERVICES = [
      '000018f0-0000-1000-8000-00805f9b34fb',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
      '0000e0ff-3c17-d293-8e48-14fe2e4da212',
      '0000ff00-0000-1000-8000-00805f9b34fb',
    ];

    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICES,
    });

    if (!device || !device.gatt) {
      return { success: false, message: 'প্রিন্টার নির্বাচন করা হয়নি।' };
    }

    const server = await device.gatt.connect();
    let writeChar: any = null;

    // Search services for a writable characteristic
    for (const serviceUuid of PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const chars = await service.getCharacteristics();
        for (const ch of chars) {
          if (ch.properties.write || ch.properties.writeWithoutResponse) {
            writeChar = ch;
            break;
          }
        }
      } catch (_) {}
      if (writeChar) break;
    }

    if (!writeChar) {
      // Fallback: enumerate all primary services
      try {
        const services = await server.getPrimaryServices();
        for (const s of services) {
          const chars = await s.getCharacteristics();
          for (const ch of chars) {
            if (ch.properties.write || ch.properties.writeWithoutResponse) {
              writeChar = ch;
              break;
            }
          }
          if (writeChar) break;
        }
      } catch (_) {}
    }

    if (!writeChar) {
      device.gatt.disconnect();
      return { success: false, message: 'প্রিন্টারের সাথে ডাটা পোর্ট সংযুক্ত করা যায়নি।' };
    }

    // Send chunks (max 100 bytes per chunk to avoid printer buffer overflow)
    const chunkSize = 100;
    for (let i = 0; i < escPosBytes.length; i += chunkSize) {
      const chunk = escPosBytes.slice(i, i + chunkSize);
      if (writeChar.writeValueWithoutResponse) {
        await writeChar.writeValueWithoutResponse(chunk);
      } else {
        await writeChar.writeValue(chunk);
      }
      // Small throttle delay between packets
      await new Promise((r) => setTimeout(r, 20));
    }

    setTimeout(() => {
      try {
        device.gatt.disconnect();
      } catch (_) {}
    }, 1500);

    return { success: true, message: 'সরাসরি ব্লুটুথ থার্মাল প্রিন্টারে পাঠানো হয়েছে!' };
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      return { success: false, message: 'কোনো প্রিন্টার নির্বাচন করা হয়নি।' };
    }
    return { success: false, message: 'ব্লুটুথ সংযোগ ত্রুটি: ' + (err.message || 'ব্যর্থ হয়েছে') };
  }
}

/**
 * Direct USB OTG Thermal Printing via Web Serial API
 */
export async function printDirectWebSerial(escPosBytes: Uint8Array): Promise<{ success: boolean; message: string }> {
  if (typeof navigator === 'undefined' || !(navigator as any).serial) {
    return {
      success: false,
      message: 'আপনার ব্রাউজারে USB Serial সাপোর্ট করে না।',
    };
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600 });
    const writer = port.writable.getWriter();
    await writer.write(escPosBytes);
    writer.releaseLock();
    await port.close();
    return { success: true, message: 'সরাসরি USB প্রিন্টারে পাঠানো হয়েছে!' };
  } catch (err: any) {
    return { success: false, message: 'USB প্রিন্টার ত্রুটি: ' + err.message };
  }
}

/**
 * Native Android APK Direct Bluetooth Printer Bridge
 */
export function printDirectAndroidBridge(b64Data: string): boolean {
  if (typeof window !== 'undefined' && (window as any).AndroidApp?.printEscPosBluetooth) {
    try {
      (window as any).AndroidApp.printEscPosBluetooth(b64Data);
      return true;
    } catch (_) {}
  }
  return false;
}
