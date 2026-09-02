"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Boxes, Search, TriangleAlert, PackagePlus, X, Loader2, MessageCircleWarning,
  CircleCheck, CircleAlert, CircleX, Pencil, Wallet, ChartNoAxesColumn,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import type { IngredientDto, StockStatus } from "@/lib/types";
import { formatIDR, formatQty } from "@/lib/format";

type Filter = "all" | "risk" | StockStatus;

const STATUS_META: Record<StockStatus, { label: string; cls: string; icon: typeof CircleCheck }> = {
  ok: { label: "Aman", cls: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10", icon: CircleCheck },
  low: { label: "Menipis", cls: "text-amber-400 border-amber-400/30 bg-amber-400/10", icon: CircleAlert },
  out: { label: "Habis", cls: "text-red-400 border-red-400/40 bg-red-400/10", icon: CircleX },
};

export default function InventoryPage() {
  const [items, setItems] = useState<IngredientDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ type: "restock" | "edit" | "add"; ing?: IngredientDto } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3600);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory");
      if (res.ok) {
        const data = (await res.json()) as { ingredients: IngredientDto[] };
        setItems(data.ingredients);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === "risk") list = list.filter((i) => i.predictedOut || i.status !== "ok");
    else if (filter !== "all") list = list.filter((i) => i.status === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list;
  }, [items, filter, query]);

  const stats = useMemo(
    () => ({
      ok: items.filter((i) => i.status === "ok").length,
      low: items.filter((i) => i.status === "low").length,
      out: items.filter((i) => i.status === "out").length,
      risk: items.filter((i) => i.predictedOut).length,
      value: items.reduce((s, i) => s + i.stockQty * i.costPerUnit, 0),
    }),
    [items]
  );

  const critical = items.filter((i) => i.daysLeft !== null && i.daysLeft <= 2.5);

  const whatsappHref = useMemo(() => {
    const lines = [
      "*BrewMetrics — Low-Stock AI Alert*",
      new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
      "",
      ...critical.slice(0, 6).map(
        (i) =>
          `• ${i.name}: sisa *${formatQty(i.stockQty, i.unit)}* ≈ *${i.daysLeft} hari* (velocity ${formatQty(i.dailyUsage, i.unit)}/hari) → saran order ${formatQty(i.suggestedOrder, i.unit)}`
      ),
      "",
      "Segera restock sebelum jam operasional puncak.",
    ];
    return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [critical]);

  /* ------------------------------- MUTATIONS -------------------------------- */
  const patchIngredient = async (id: number, body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Gagal memperbarui.");
        return false;
      }
      showToast("Inventory diperbarui — dashboard owner ikut tersinkron.");
      setModal(null);
      load();
      return true;
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell allowedRoles={["manager", "owner"]}>
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5 max-w-[1500px] w-full mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-faint font-bold mb-1">Dynamic Inventory</p>
            <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
              Inventory Matrix
              {stats.risk > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-400/10 px-3 py-1 text-[11px] font-bold text-red-400">
                  <TriangleAlert className="size-3.5" /> {stats.risk} prediksi kritis
                </span>
              )}
            </h1>
            <p className="text-sm text-sand mt-1.5">
              Setiap gelas terjual memotong bahan baku per gram/ml secara real-time.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {critical.length > 0 && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="btn-press flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2.5 text-[13px] font-bold text-emerald-300 hover:bg-emerald-400/20"
              >
                <MessageCircleWarning className="size-4" />
                Broadcast WhatsApp Owner
              </a>
            )}
            <button
              onClick={() => setModal({ type: "add" })}
              className="btn-press flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-bold text-coal shadow-[0_12px_30px_-12px] shadow-brand/70 hover:brightness-110"
            >
              <PackagePlus className="size-4" />
              Tambah Bahan
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Nilai Stok Aktif" value={formatIDR(stats.value, true)} icon={Wallet} cls="text-brand" />
          <StatCard label="Bahan Aman" value={String(stats.ok)} icon={CircleCheck} cls="text-emerald-400" />
          <StatCard label="Menipis" value={String(stats.low)} icon={CircleAlert} cls="text-amber-400" />
          <StatCard label="Habis" value={String(stats.out)} icon={CircleX} cls="text-red-400" />
          <StatCard label="Prediksi ≤ 2 Hari" value={String(stats.risk)} icon={ChartNoAxesColumn} cls="text-brand-2" />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-line bg-panel p-1 gap-1">
            {(
              [
                ["all", "Semua"],
                ["risk", "Berisiko"],
                ["ok", "Aman"],
                ["low", "Menipis"],
                ["out", "Habis"],
              ] as [Filter, string][]
            ).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`btn-press rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  filter === f ? "bg-brand text-coal" : "text-sand hover:text-cream"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-52 max-w-sm ml-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari bahan baku…"
              className="w-full rounded-xl border border-line bg-panel py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-faint focus:border-brand/50 focus:ring-2 focus:ring-brand/15"
            />
          </div>
        </div>

        {/* Matrix table */}
        <div className="rounded-2xl border border-line bg-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-line bg-coal-2/70 text-left">
                  {["Bahan Baku", "Stok Live", "Level", "Status", "Velocity/Hari", "AI Forecast", "Saran Order", "Aksi"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.18em] text-faint whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-line/60">
                      <td colSpan={8} className="px-5 py-3.5">
                        <div className="h-6 rounded-lg bg-panel-2 animate-pulse-soft" style={{ animationDelay: `${i * 70}ms` }} />
                      </td>
                    </tr>
                  ))}
                {!loading &&
                  filtered.map((ing, i) => (
                    <MatrixRow
                      key={ing.id}
                      ing={ing}
                      index={i}
                      onRestock={() => setModal({ type: "restock", ing })}
                      onEdit={() => setModal({ type: "edit", ing })}
                    />
                  ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-14 text-center text-sm text-faint">
                      Tidak ada bahan pada filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[11px] text-faint text-center pb-4">
          Forecast dihitung dari kecepatan penjualan 14 hari terakhir × resep (Bill of Materials) tiap menu.
        </p>
      </div>

      {/* ------------------------------- MODALS -------------------------------- */}
      <InventoryModal
        modal={modal}
        saving={saving}
        onClose={() => setModal(null)}
        onPatch={patchIngredient}
        onAdd={async (body) => {
          setSaving(true);
          try {
            const res = await fetch("/api/inventory", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
              showToast(data.error ?? "Gagal menambah bahan.");
              return;
            }
            showToast("Bahan baru ditambahkan ke matrix.");
            setModal(null);
            load();
          } finally {
            setSaving(false);
          }
        }}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-emerald-400/40 bg-emerald-950/85 backdrop-blur px-5 py-3 text-sm font-semibold text-emerald-200 shadow-ticket"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

/* --------------------------------- SUBPARTS -------------------------------- */

function StatCard({
  label, value, icon: Icon, cls,
}: {
  label: string; value: string; icon: typeof CircleCheck; cls: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-4 py-3.5 flex items-center gap-3">
      <div className={`grid size-10 place-items-center rounded-xl border border-line-2/50 bg-coal ${cls}`}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="font-display text-lg font-bold tabular leading-none">{value}</p>
        <p className="text-[10px] text-faint mt-1">{label}</p>
      </div>
    </div>
  );
}

function MatrixRow({
  ing, index, onRestock, onEdit,
}: {
  ing: IngredientDto; index: number; onRestock: () => void; onEdit: () => void;
}) {
  const meta = STATUS_META[ing.status];
  const pct = Math.max(2, Math.min(100, (ing.stockQty / Math.max(ing.lowThreshold * 2.5, 1)) * 100));
  const barColor =
    ing.status === "out" ? "bg-red-400" : ing.status === "low" ? "bg-amber-400" : "bg-emerald-400";

  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4) }}
      className="border-b border-line/60 hover:bg-panel-2/60 transition-colors"
    >
      <td className="px-5 py-3.5">
        <p className="font-semibold text-cream">{ing.name}</p>
        <p className="text-[11px] text-faint mt-0.5">
          HPP {formatIDR(ing.costPerUnit)}/{ing.unit} • ambang {formatQty(ing.lowThreshold, ing.unit)}
        </p>
      </td>
      <td className="px-5 py-3.5">
        <p className="font-display font-bold tabular text-[15px]">{formatQty(ing.stockQty, ing.unit)}</p>
      </td>
      <td className="px-5 py-3.5 w-36">
        <div className="h-1.5 w-28 rounded-full bg-coal overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.cls}`}>
          <meta.icon className="size-3.5" />
          {meta.label}
        </span>
      </td>
      <td className="px-5 py-3.5 tabular text-sand">
        {ing.dailyUsage > 0 ? formatQty(ing.dailyUsage, ing.unit) : "—"}
      </td>
      <td className="px-5 py-3.5">
        {ing.daysLeft === null ? (
          <span className="text-faint text-xs">Belum ada data jual</span>
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold tabular ${
              ing.daysLeft <= 2
                ? "border-red-400/40 bg-red-400/10 text-red-300"
                : ing.daysLeft <= 5
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                  : "border-line-2 bg-coal text-sand"
            }`}
          >
            {ing.daysLeft <= 2 && <TriangleAlert className="size-3.5" />}
            ≈ {ing.daysLeft} hari lagi
          </span>
        )}
      </td>
      <td className="px-5 py-3.5 tabular text-sand">
        {ing.suggestedOrder > 0 ? formatQty(ing.suggestedOrder, ing.unit) : "—"}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <button
            onClick={onRestock}
            className="btn-press rounded-lg bg-brand/15 border border-brand/40 px-3 py-1.5 text-[11px] font-bold text-brand hover:bg-brand/25"
          >
            Restock
          </button>
          <button
            onClick={onEdit}
            className="btn-press grid size-8 place-items-center rounded-lg border border-line bg-coal text-faint hover:text-cream"
            title="Edit detail"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

/* ---------------------------------- MODAL ----------------------------------- */

function InventoryModal({
  modal, saving, onClose, onPatch, onAdd,
}: {
  modal: { type: "restock" | "edit" | "add"; ing?: IngredientDto } | null;
  saving: boolean;
  onClose: () => void;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<boolean>;
  onAdd: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [qty, setQty] = useState("");
  const [threshold, setThreshold] = useState("");
  const [cost, setCost] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<"g" | "ml" | "pcs">("g");
  const [recordExpense, setRecordExpense] = useState(true);

  useEffect(() => {
    if (!modal) return;
    const ing = modal.ing;
    setQty("");
    setName(ing?.name ?? "");
    setThreshold(ing ? String(ing.lowThreshold) : "");
    setCost(ing ? String(ing.costPerUnit) : "");
    setUnit(ing?.unit ?? "g");
    setRecordExpense(true);
  }, [modal]);

  const ing = modal?.ing;
  const expenseEst = modal?.type === "restock" && ing ? (Number(qty) || 0) * ing.costPerUnit : 0;

  return (
    <AnimatePresence>
      {modal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-coal/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-line-2 bg-panel-2 shadow-ticket p-6"
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="font-display text-lg font-bold">
                  {modal.type === "restock" && "Restock Bahan"}
                  {modal.type === "edit" && "Edit Bahan"}
                  {modal.type === "add" && "Bahan Baru"}
                </p>
                {ing && <p className="text-xs text-faint mt-1">{ing.name} — sisa {formatQty(ing.stockQty, ing.unit)}</p>}
              </div>
              <button onClick={onClose} className="btn-press grid size-8 place-items-center rounded-lg border border-line bg-coal text-faint hover:text-cream">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              {(modal.type === "edit" || modal.type === "add") && (
                <Field label="Nama bahan">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-dark"
                    placeholder="cth: Biji Kopi Arabika"
                  />
                </Field>
              )}

              {modal.type === "add" && (
                <Field label="Satuan">
                  <div className="grid grid-cols-3 gap-2">
                    {(["g", "ml", "pcs"] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => setUnit(u)}
                        className={`btn-press rounded-xl border py-2.5 text-sm font-bold ${
                          unit === u ? "border-brand bg-brand/15 text-brand" : "border-line bg-coal text-sand"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              <Field
                label={
                  modal.type === "restock"
                    ? `Jumlah masuk (${ing?.unit})`
                    : modal.type === "edit"
                      ? `Set stok langsung (${ing?.unit}) — opsional`
                      : `Stok awal (${unit})`
                }
              >
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  type="number"
                  min={0}
                  className="input-dark tabular"
                  placeholder="0"
                  autoFocus={modal.type === "restock"}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={`Ambang menipis (${ing?.unit ?? unit})`}>
                  <input value={threshold} onChange={(e) => setThreshold(e.target.value)} type="number" min={0} className="input-dark tabular" placeholder="0" />
                </Field>
                <Field label="HPP per unit (Rp)">
                  <input value={cost} onChange={(e) => setCost(e.target.value)} type="number" min={0} className="input-dark tabular" placeholder="0" />
                </Field>
              </div>

              {modal.type === "restock" && (
                <label className="flex items-start gap-3 rounded-xl border border-line bg-coal p-3.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recordExpense}
                    onChange={(e) => setRecordExpense(e.target.checked)}
                    className="mt-0.5 size-4 accent-amber-500"
                  />
                  <span>
                    <span className="block text-[13px] font-semibold text-cream">Catat sebagai kas keluar</span>
                    <span className="block text-[11px] text-faint mt-0.5">
                      Estimasi {formatIDR(expenseEst)} akan muncul di laporan arus kas owner.
                    </span>
                  </span>
                </label>
              )}

              <button
                disabled={saving}
                onClick={() => {
                  if (modal.type === "add") {
                    onAdd({ name, unit, stockQty: Number(qty) || 0, lowThreshold: Number(threshold) || 0, costPerUnit: Number(cost) || 0 });
                  } else if (modal.type === "restock" && ing) {
                    onPatch(ing.id, {
                      mode: "restock",
                      qty: Number(qty),
                      recordExpense,
                      expenseAmount: Math.round(expenseEst),
                      costPerUnit: cost !== "" ? Number(cost) : undefined,
                    });
                  } else if (modal.type === "edit" && ing) {
                    onPatch(ing.id, {
                      mode: qty !== "" ? "set" : undefined,
                      qty: qty !== "" ? Number(qty) : undefined,
                      name: name || undefined,
                      lowThreshold: threshold !== "" ? Number(threshold) : undefined,
                      costPerUnit: cost !== "" ? Number(cost) : undefined,
                    });
                  }
                }}
                className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-display text-sm font-bold text-coal hover:brightness-110 disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Simpan Perubahan
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-faint">{label}</span>
      {children}
    </label>
  );
}
