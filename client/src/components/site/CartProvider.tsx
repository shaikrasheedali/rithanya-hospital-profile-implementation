"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/utils";

export type CartItem = { id: string; name: string; price: number; image?: string; stock: number; quantity: number };

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (p: Omit<CartItem, "quantity">, qty?: number) => void;
  update: (id: string, delta: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
};

export const DELIVERY_FREE_ABOVE = 500;
export const DELIVERY_FEE = 40;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("rh_cart");
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem("rh_cart", JSON.stringify(items));
  }, [items, ready]);

  const add = useCallback((p: Omit<CartItem, "quantity">, qty = 1) => {
    if (p.stock <= 0) {
      toast.error(`${p.name} is currently out of stock.`);
      return;
    }
    let capped = false;
    setItems((cur) => {
      const hit = cur.find((i) => i.id === p.id);
      if (hit) {
        const next = Math.min(p.stock, hit.quantity + qty);
        if (next === hit.quantity || next < hit.quantity + qty) capped = true;
        return cur.map((i) => (i.id === p.id ? { ...i, stock: p.stock, quantity: next } : i));
      }
      const nextQty = Math.min(p.stock, qty);
      if (nextQty < qty) capped = true;
      return [...cur, { ...p, quantity: nextQty }];
    });
    if (capped) toast.error(`Only ${p.stock} unit(s) of ${p.name} available.`);
    else toast.success(`${p.name} added to cart.`);
    setOpen(true);
  }, []);
  const update = useCallback(
    (id: string, delta: number) =>
      setItems((cur) =>
        cur.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, Math.min(i.stock, i.quantity + delta)) } : i)),
      ),
    [],
  );
  const remove = useCallback((id: string) => setItems((cur) => cur.filter((i) => i.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartCtx>(
    () => ({
      items,
      count: items.reduce((a, i) => a + i.quantity, 0),
      subtotal: items.reduce((a, i) => a + i.price * i.quantity, 0),
      isOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      add,
      update,
      remove,
      clear,
    }),
    [items, isOpen, add, update, remove, clear],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <CartDrawer />
    </Ctx.Provider>
  );
}

function CartDrawer() {
  const { items, subtotal, isOpen, close, update, remove, clear } = useCart();
  const [step, setStep] = useState<"CART" | "CHECKOUT" | "DONE">("CART");
  const [form, setForm] = useState({ name: "", phone: "", address: "", pin: "", paymentMethod: "COD" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ orderNumber: string; total: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  if (!isOpen) return null;
  const delivery = subtotal === 0 ? 0 : subtotal >= DELIVERY_FREE_ABOVE ? 0 : DELIVERY_FEE;
  const total = subtotal + delivery;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      const msg = "Your cart is empty.";
      setError(msg);
      toast.error(msg);
      return;
    }
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 10) {
      const msg = "Please enter a valid 10-digit mobile number.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: items.map((i) => ({ productId: i.id, quantity: i.quantity })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Could not place order — please try again.");
      const orderNumber = (data as { orderNumber?: string }).orderNumber;
      const totalVal = (data as { total?: number }).total;
      if (!orderNumber) throw new Error("Order was received but no order number was returned. Please call the pharmacy desk.");
      setDone({ orderNumber, total: typeof totalVal === "number" ? totalVal : subtotal + delivery });
      clear();
      setStep("DONE");
      toast.success(`Order ${orderNumber} placed successfully.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not place order — please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-line bg-white px-3.5 py-3 text-base focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20";

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={close} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-navy px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-gold" />
            <h2 className="font-heading text-lg font-semibold !text-white">Pharmacy cart</h2>
          </div>
          <button onClick={close} aria-label="Close cart" className="rounded-lg p-2 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "CART" &&
            (items.length === 0 ? (
              <div className="py-20 text-center text-ink/70">
                <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-line" />
                <p className="text-lg">Your cart is empty.</p>
                <p className="mt-1">Browse our pharmacy and wellness store to add items.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {items.map((i) => (
                  <li key={i.id} className="flex gap-3 rounded-xl border border-line bg-canvas p-3">
                    {i.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.image} alt="" className="h-20 w-20 flex-none rounded-lg object-cover" />
                    ) : (
                      <div className="h-20 w-20 flex-none rounded-lg bg-line" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug text-navy">{i.name}</p>
                      <p className="text-sm font-semibold text-royal">{formatINR(i.price)}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1 rounded-lg border border-line bg-white">
                          <button aria-label="Decrease quantity" onClick={() => update(i.id, -1)} className="p-2 hover:text-royal"><Minus className="h-4 w-4" /></button>
                          <span className="w-6 text-center font-semibold">{i.quantity}</span>
                          <button aria-label="Increase quantity" onClick={() => update(i.id, 1)} disabled={i.quantity >= i.stock} className="p-2 hover:text-royal disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                        </div>
                        <button onClick={() => remove(i.id)} aria-label={`Remove ${i.name}`} className="rounded-lg p-2 text-alert hover:bg-alert/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ))}

          {step === "CHECKOUT" && (
            <form id="checkout-form" onSubmit={submit} className="space-y-4">
              <p className="rounded-lg bg-canvas p-3 text-sm text-ink/80">Secure checkout — we’ll confirm your order by phone and dispatch from our 24/7 pharmacy.</p>
              <label className="block"><span className="mb-1 block text-sm font-semibold text-navy">Full name *</span><input required minLength={2} className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></label>
              <label className="block"><span className="mb-1 block text-sm font-semibold text-navy">Mobile number *</span><input required type="tel" inputMode="tel" className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></label>
              <label className="block"><span className="mb-1 block text-sm font-semibold text-navy">Delivery address & landmark *</span><textarea required rows={3} className={input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} autoComplete="street-address" /></label>
              <label className="block"><span className="mb-1 block text-sm font-semibold text-navy">PIN code *</span><input required pattern="\d{6}" maxLength={6} inputMode="numeric" className={input} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} autoComplete="postal-code" /></label>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-navy">Payment method</legend>
                <div className="grid grid-cols-2 gap-3">
                  {[["COD", "Cash on Delivery"], ["UPI", "UPI Pay"]].map(([v, l]) => (
                    <label key={v} className={`cursor-pointer rounded-xl border p-3 text-center font-medium ${form.paymentMethod === v ? "border-royal bg-royal/5 text-royal" : "border-line"}`}>
                      <input type="radio" name="pay" className="sr-only" checked={form.paymentMethod === v} onChange={() => setForm({ ...form, paymentMethod: v })} />
                      {l}
                    </label>
                  ))}
                </div>
                {form.paymentMethod === "UPI" && <p className="mt-2 text-sm text-ink/80">Our team will share a UPI payment request on your mobile number after confirming the order.</p>}
              </fieldset>
              {error && <p role="alert" className="rounded-lg bg-alert/10 p-3 text-sm font-medium text-alert">{error}</p>}
            </form>
          )}

          {step === "DONE" && done && (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
              <h3 className="mt-4 text-2xl font-semibold">Order received</h3>
              <p className="mt-2 text-ink/80">Your order number is</p>
              <p className="mt-1 font-heading text-xl font-bold text-royal">{done.orderNumber}</p>
              <p className="mt-3 text-ink/80">Total {formatINR(done.total)}. Our pharmacy desk will call to confirm dispatch.</p>
              <button onClick={() => { setStep("CART"); setDone(null); close(); }} className="mt-6 rounded-full bg-royal px-6 py-3 font-medium text-white hover:bg-alert">Continue shopping</button>
            </div>
          )}
        </div>

        {step !== "DONE" && (
          <footer className="border-t border-line bg-canvas p-5">
            <dl className="mb-4 space-y-1.5 text-base">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-semibold">{formatINR(subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Delivery estimate</dt><dd className="font-semibold">{delivery === 0 ? "Free" : formatINR(delivery)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-lg"><dt className="font-semibold text-navy">Total</dt><dd className="font-heading font-bold text-navy">{formatINR(total)}</dd></div>
              {subtotal > 0 && delivery > 0 && <p className="text-sm text-ink/70">Free delivery on orders above {formatINR(DELIVERY_FREE_ABOVE)}. Delivery within Khammam in 1–2 days.</p>}
            </dl>
            {step === "CART" ? (
              <button disabled={items.length === 0} onClick={() => setStep("CHECKOUT")} className="flex w-full items-center justify-center gap-2 rounded-full bg-royal py-3.5 font-semibold text-white hover:bg-alert disabled:opacity-50">
                Proceed to checkout <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep("CART")} className="w-1/3 rounded-full bg-gray-200 py-3.5 font-medium text-navy hover:bg-gray-300">Back</button>
                <button type="submit" form="checkout-form" disabled={busy} className="flex w-2/3 items-center justify-center gap-2 rounded-full bg-royal py-3.5 font-semibold text-white hover:bg-alert disabled:opacity-60">
                  <ShieldCheck className="h-4 w-4" /> {busy ? "Placing order…" : "Place order"}
                </button>
              </div>
            )}
          </footer>
        )}
      </aside>
    </div>
  );
}
