import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

export type LedgerPdfItem = {
  id: string;
  entryDate: string;
  itemName: string;
  vendorPayee?: string;
  categoryName?: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  method?: string;
  description?: string;
};

export type LedgerPdfData = {
  items: LedgerPdfItem[];
  monthName: string;
  year: number;
  entityLabel: string;
  totalCredit: number;
  totalDebit: number;
  net: number;
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#1E293B",
    backgroundColor: "#FFFFFF",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#0B2545",
    paddingBottom: 10,
    marginBottom: 12,
  },
  orgTitle: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: "#0B2545",
    textTransform: "uppercase",
  },
  orgSubtitle: {
    fontSize: 8,
    color: "#475569",
    marginTop: 2,
  },
  banner: {
    marginTop: 6,
    backgroundColor: "#0F4C81",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  bannerPeriod: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#FDE047",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    padding: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  kpiLabel: {
    fontSize: 7,
    color: "#64748B",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  kpiValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
  table: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: "#0F4C81",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  rowAlternate: {
    backgroundColor: "#FAFAFA",
  },
  colIdx: { width: "4%", textAlign: "center" },
  colDate: { width: "11%" },
  colItem: { width: "27%" },
  colPayee: { width: "18%" },
  colCat: { width: "15%" },
  colMode: { width: "8%", textAlign: "center" },
  colType: { width: "7%", textAlign: "center" },
  colAmount: { width: "10%", textAlign: "right", fontFamily: "Helvetica-Bold" },

  itemSub: {
    fontSize: 6.5,
    color: "#64748B",
    marginTop: 1,
  },
  tableFooterRow: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    borderTopWidth: 1.5,
    borderTopColor: "#93C5FD",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  footerText: {
    position: "absolute",
    bottom: 18,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#E2E8F0",
    paddingTop: 4,
    fontSize: 6.5,
    color: "#94A3B8",
  },
});

function inr(val: number): string {
  const rounded = Math.round(Number(val) || 0);
  return `Rs. ${rounded.toLocaleString("en-IN")}`;
}

export function LedgerPdfDocument({ data }: { data: LedgerPdfData }) {
  return (
    <Document title={`Finance Ledger - ${data.entityLabel} - ${data.monthName} ${data.year}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.orgTitle}>{data.entityLabel}</Text>
          <Text style={styles.orgSubtitle}>
            Official Financial Books of Accounts · General Transaction Ledger
          </Text>
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>
              FINANCIAL STATEMENT & LEDGER SUMMARY
            </Text>
            <Text style={styles.bannerPeriod}>
              PERIOD: {data.monthName.toUpperCase()} {data.year}
            </Text>
          </View>
        </View>

        {/* Executive KPI Overview */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Credits (Inflow)</Text>
            <Text style={[styles.kpiValue, { color: "#059669" }]}>+ {inr(data.totalCredit)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Debits (Outflow)</Text>
            <Text style={[styles.kpiValue, { color: "#DC2626" }]}>− {inr(data.totalDebit)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Net Operational Balance</Text>
            <Text
              style={[
                styles.kpiValue,
                { color: data.net >= 0 ? "#059669" : "#DC2626" },
              ]}
            >
              {data.net >= 0 ? "+ " : "− "}
              {inr(Math.abs(data.net))}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Recorded Entries</Text>
            <Text style={[styles.kpiValue, { color: "#0F4C81" }]}>{data.items.length} Entries</Text>
          </View>
        </View>

        {/* Complete Transaction Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colIdx]}>#</Text>
            <Text style={[styles.th, styles.colDate]}>Date</Text>
            <Text style={[styles.th, styles.colItem]}>Item Description</Text>
            <Text style={[styles.th, styles.colPayee]}>Vendor / Payee</Text>
            <Text style={[styles.th, styles.colCat]}>Category</Text>
            <Text style={[styles.th, styles.colMode]}>Mode</Text>
            <Text style={[styles.th, styles.colType]}>Type</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
          </View>

          {data.items.length === 0 ? (
            <View style={{ padding: 16, alignItems: "center" }}>
              <Text style={{ color: "#64748B", fontSize: 8 }}>
                No ledger transactions recorded for this period.
              </Text>
            </View>
          ) : (
            data.items.map((item, idx) => {
              const isCredit = item.type === "CREDIT";
              const dateStr = item.entryDate
                ? new Date(item.entryDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—";

              return (
                <View
                  key={item.id || idx}
                  style={[styles.row, idx % 2 === 1 ? styles.rowAlternate : {}]}
                >
                  <Text style={[styles.colIdx, { color: "#94A3B8" }]}>{idx + 1}</Text>
                  <Text style={styles.colDate}>{dateStr}</Text>
                  <View style={styles.colItem}>
                    <Text style={{ fontFamily: "Helvetica-Bold", color: "#0B2545" }}>
                      {item.itemName}
                    </Text>
                    {item.description ? (
                      <Text style={styles.itemSub}>{item.description}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.colPayee}>{item.vendorPayee || "—"}</Text>
                  <Text style={styles.colCat}>{item.categoryName || "Uncategorised"}</Text>
                  <Text style={styles.colMode}>{item.method || "Cash"}</Text>
                  <Text
                    style={[
                      styles.colType,
                      {
                        color: isCredit ? "#059669" : "#DC2626",
                        fontFamily: "Helvetica-Bold",
                      },
                    ]}
                  >
                    {item.type}
                  </Text>
                  <Text
                    style={[
                      styles.colAmount,
                      { color: isCredit ? "#059669" : "#DC2626" },
                    ]}
                  >
                    {isCredit ? "+" : "−"} {inr(item.amount)}
                  </Text>
                </View>
              );
            })
          )}

          {/* Table Totals Row */}
          <View style={styles.tableFooterRow}>
            <Text
              style={[
                styles.colIdx,
                styles.colDate,
                styles.colItem,
                styles.colPayee,
                styles.colCat,
                styles.colMode,
                { fontFamily: "Helvetica-Bold", color: "#0B2545", textAlign: "right", paddingRight: 8 },
              ]}
            >
              PERIOD TOTALS:
            </Text>
            <Text style={[styles.colType, { fontFamily: "Helvetica-Bold" }]}>NET</Text>
            <Text
              style={[
                styles.colAmount,
                {
                  color: data.net >= 0 ? "#059669" : "#DC2626",
                  fontFamily: "Helvetica-Bold",
                },
              ]}
            >
              {data.net >= 0 ? "+" : "−"} {inr(Math.abs(data.net))}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footerText}>
          <Text>
            Confidential · Verified Ledger Generated on{" "}
            {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}{" "}
            {new Date().toLocaleTimeString("en-IN", { timeStyle: "short" })}
          </Text>
          <Text>
            Page 1 · Rithanya Hospital Management System (HMS) Finance Audit Registry
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Downloads a generated ledger PDF in the user's browser
 */
export async function downloadLedgerPdf(data: LedgerPdfData): Promise<void> {
  const blob = await pdf(<LedgerPdfDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const cleanEntity = data.entityLabel.replace(/[^a-zA-Z0-9]/g, "_");
  a.href = url;
  a.download = `Ledger_${cleanEntity}_${data.monthName}_${data.year}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
