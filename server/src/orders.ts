import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma, isDbOnCooldown, reportDbError, withDbTimeout } from "./db.js";
import { getCollectionStore } from "./cms.js";
import { phoneDigits } from "./utils.js";

export type OrderItemDTO = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

export type OrderDTO = {
  id: string;
  orderNumber: string;
  customerName: string;
  phoneNumber: string;
  shippingAddress: string;
  pinCode: string;
  totalAmount: number;
  status: "PENDING" | "PAID" | "PROCESSING" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
  paymentMethod: "COD" | "UPI";
  isPaid: boolean;
  createdAt: string;
  items: OrderItemDTO[];
};

const CACHE_FILE = path.resolve(process.cwd(), "uploads", "orders-cache.json");

let inMemoryOrders: OrderDTO[] = loadCache();

function loadCache(): OrderDTO[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("[orders] Could not read orders cache file:", err);
  }
  return [];
}

function persistCache(): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(inMemoryOrders, null, 2), "utf-8");
  } catch (err) {
    console.warn("[orders] Could not persist orders cache file:", err);
  }
}

export async function loadOrders(): Promise<OrderDTO[]> {
  if (!isDbOnCooldown()) {
    try {
      const rows = await withDbTimeout(
        prisma.order.findMany({
          orderBy: { createdAt: "desc" },
          take: 300,
          include: { items: true },
        }),
        2500
      );

      const dbMapped: OrderDTO[] = rows.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        phoneNumber: o.phoneNumber,
        shippingAddress: o.shippingAddress,
        pinCode: o.pinCode,
        totalAmount: o.totalAmount,
        status: o.status as OrderDTO["status"],
        paymentMethod: o.paymentMethod as OrderDTO["paymentMethod"],
        isPaid: o.isPaid,
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      }));

      // Merge newly fetched DB rows into memory
      for (const row of dbMapped) {
        const idx = inMemoryOrders.findIndex((x) => x.id === row.id || x.orderNumber === row.orderNumber);
        if (idx >= 0) {
          inMemoryOrders[idx] = row;
        } else {
          inMemoryOrders.push(row);
        }
      }
      persistCache();
      return inMemoryOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      reportDbError(err);
      console.warn("[orders] DB query failed, falling back to resilient in-memory store:", (err as Error)?.message || err);
    }
  }

  return inMemoryOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createOrder(data: {
  name: unknown;
  phone: unknown;
  address: unknown;
  pin: unknown;
  paymentMethod: unknown;
  items: Array<{ productId?: unknown; id?: unknown; quantity?: unknown; qty?: unknown }>;
}): Promise<{ orderNumber: string; total: number }> {
  const customerName = String(data.name ?? "").trim();
  const phoneNumber = String(data.phone ?? "").trim();
  const shippingAddress = String(data.address ?? "").trim();
  const pinCode = String(data.pin ?? "").trim();

  if (customerName.length < 2) throw new Error("Please enter your name");
  if (phoneDigits(phoneNumber).length < 10) throw new Error("Please enter a valid 10-digit phone number");
  if (shippingAddress.length < 8) throw new Error("Please enter your full delivery address");
  if (!/^\d{6}$/.test(pinCode)) throw new Error("Please enter a valid 6-digit PIN code");
  if (!Array.isArray(data.items) || !data.items.length) throw new Error("Your cart is empty");

  const method: "COD" | "UPI" = data.paymentMethod === "UPI" ? "UPI" : "COD";

  const productStore = getCollectionStore("products");
  let subtotal = 0;
  const lines: OrderItemDTO[] = [];

  for (const it of data.items) {
    const qty = Math.trunc(Number(it.quantity ?? it.qty ?? 1));
    if (!Number.isFinite(qty) || qty < 1 || qty > 20) throw new Error("Invalid quantity");
    const pid = String(it.productId ?? it.id ?? "");
    const prod = productStore.get(pid);
    if (!prod) throw new Error("A product in your cart is no longer available");
    const stockUnits = Number(prod.stockUnits ?? 0);
    if (stockUnits < qty) throw new Error(`Only ${stockUnits} unit(s) of ${prod.name} are available`);

    const unitPrice = Number(prod.price ?? 0);
    subtotal += unitPrice * qty;
    lines.push({
      id: crypto.randomUUID(),
      productId: prod.id,
      productName: prod.name,
      quantity: qty,
      unitPrice,
    });
  }

  // Decrement in-memory stock immediately
  for (const l of lines) {
    const prod = productStore.get(l.productId);
    if (prod) {
      prod.stockUnits = Math.max(0, Number(prod.stockUnits ?? 0) - l.quantity);
    }
  }

  const delivery = subtotal >= 500 ? 0 : 40;
  const total = subtotal + delivery;

  const orderId = crypto.randomUUID();
  const year = new Date().getFullYear();
  let orderNumber = `ORD-${year}-${String(inMemoryOrders.length + 1).padStart(4, "0")}`;
  if (inMemoryOrders.some((o) => o.orderNumber === orderNumber)) {
    orderNumber += `-${Math.floor(Math.random() * 900 + 100)}`;
  }

  const newOrder: OrderDTO = {
    id: orderId,
    orderNumber,
    customerName: customerName.slice(0, 200),
    phoneNumber: phoneNumber.slice(0, 30),
    shippingAddress: shippingAddress.slice(0, 1000),
    pinCode,
    totalAmount: total,
    status: "PENDING",
    paymentMethod: method,
    isPaid: false,
    createdAt: new Date().toISOString(),
    items: lines,
  };

  inMemoryOrders.unshift(newOrder);
  persistCache();

  // Background DB sync if available
  if (!isDbOnCooldown()) {
    withDbTimeout(
      prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            id: orderId,
            orderNumber,
            customerName: newOrder.customerName,
            phoneNumber: newOrder.phoneNumber,
            shippingAddress: newOrder.shippingAddress,
            pinCode: newOrder.pinCode,
            totalAmount: total,
            status: "PENDING",
            paymentMethod: method,
            isPaid: false,
          },
        });
        for (const l of lines) {
          await tx.orderItem.create({
            data: {
              id: l.id,
              orderId: order.id,
              productId: l.productId,
              productName: l.productName,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
            },
          });
          await tx.product.update({
            where: { id: l.productId },
            data: { stockUnits: { decrement: l.quantity } },
          }).catch(() => {});
        }
      }),
      4000
    ).catch((err) => {
      reportDbError(err);
      console.warn("[orders] Background DB sync failed, order safely saved to resilient memory cache:", err?.message || err);
    });
  }

  return { orderNumber, total };
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const o = inMemoryOrders.find((x) => x.id === id);
  if (!o) throw new Error("Order not found");
  if (o.status === "CANCELLED" && status !== "CANCELLED") {
    throw new Error("A cancelled order cannot be reopened");
  }

  const productStore = getCollectionStore("products");
  if (status === "CANCELLED" && o.status !== "CANCELLED") {
    for (const it of o.items) {
      const prod = productStore.get(it.productId);
      if (prod) {
        prod.stockUnits = Number(prod.stockUnits ?? 0) + it.quantity;
      }
    }
  }

  o.status = status as OrderDTO["status"];
  if (status !== "CANCELLED" && ["PAID", "PROCESSING", "DISPATCHED", "DELIVERED"].includes(status)) {
    o.isPaid = true;
  }
  persistCache();

  if (!isDbOnCooldown()) {
    withDbTimeout(
      prisma.$transaction(async (tx) => {
        if (status === "CANCELLED") {
          for (const it of o.items) {
            await tx.product.update({
              where: { id: it.productId },
              data: { stockUnits: { increment: it.quantity } },
            }).catch(() => {});
          }
        }
        await tx.order.update({
          where: { id },
          data: { status, isPaid: o.isPaid },
        });
      }),
      3000
    ).catch((err) => {
      reportDbError(err);
      console.warn("[orders] Background DB status update failed:", err?.message || err);
    });
  }
}

export async function deleteOrder(id: string): Promise<void> {
  const idx = inMemoryOrders.findIndex((x) => x.id === id);
  if (idx < 0) throw new Error("Order not found");
  inMemoryOrders.splice(idx, 1);
  persistCache();

  if (!isDbOnCooldown()) {
    withDbTimeout(
      prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.order.delete({ where: { id } });
      }),
      3000
    ).catch((err) => {
      reportDbError(err);
      console.warn("[orders] Background DB order delete failed:", err?.message || err);
    });
  }
}

