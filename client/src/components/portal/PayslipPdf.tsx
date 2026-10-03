import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

export type PayslipData = {
  employee: {
    fullName: string;
    designation: string;
    department: string;
    entity?: string;
  };
  baseSalary: number;
  calendarDays: number;
  lopDays: number;
  paidDays: number;
  lopDeduction: number;
  allowances: number;
  otherDeductions: number;
  netPayable: number;
  monthName: string;
  year: number;
  entityLabel: string;
  authorizerName?: string;
  signedAt?: string | null;
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1E293B",
    backgroundColor: "#FFFFFF",
  },
  headerContainer: {
    borderBottomWidth: 2,
    borderBottomColor: "#0B2545",
    paddingBottom: 12,
    marginBottom: 14,
  },
  hospitalTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0B2545",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hospitalSubtitle: {
    fontSize: 8.5,
    color: "#475569",
    marginTop: 2,
  },
  hospitalAddress: {
    fontSize: 7.5,
    color: "#64748B",
    marginTop: 2,
  },
  badgeBanner: {
    marginTop: 8,
    backgroundColor: "#0F4C81",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  bannerPeriod: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#FDE047",
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0F4C81",
    textTransform: "uppercase",
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 3,
  },
  grid2: {
    flexDirection: "row",
    gap: 12,
  },
  gridCol: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F1F5F9",
  },
  infoLabel: {
    fontSize: 8,
    color: "#64748B",
  },
  infoValue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#0F172A",
  },
  table: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableHeaderCol: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: "#0F4C81",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 4.5,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  tableRowTotal: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#94A3B8",
  },
  colDesc: {
    flex: 3,
  },
  colAmount: {
    flex: 2,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  colType: {
    flex: 1.5,
    textAlign: "center",
    fontSize: 7.5,
  },
  netPayableContainer: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#1D4ED8",
    borderRadius: 6,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  netPayableLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1E3A8A",
  },
  netPayableWords: {
    fontSize: 7.5,
    color: "#3B82F6",
    marginTop: 2,
  },
  netPayableAmount: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: "#1D4ED8",
  },
  formulaNote: {
    fontSize: 7.5,
    color: "#64748B",
    fontStyle: "italic",
    backgroundColor: "#F8FAFC",
    padding: 6,
    borderRadius: 3,
    marginBottom: 14,
    borderLeftWidth: 2,
    borderLeftColor: "#3B82F6",
  },
  signaturesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    paddingTop: 8,
  },
  signBox: {
    width: "42%",
    alignItems: "center",
  },
  signLine: {
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#94A3B8",
    marginBottom: 4,
  },
  signTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
  },
  signSub: {
    fontSize: 7,
    color: "#64748B",
    marginTop: 1,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: "#E2E8F0",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: "#94A3B8",
  },
});

function inr(val: number): string {
  const rounded = Math.round(Number(val) || 0);
  return `Rs. ${rounded.toLocaleString("en-IN")}`;
}

function convertNumberToWords(amount: number): string {
  if (amount <= 0) return "Zero Rupees Only";
  const single = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertTwoDigits(n: number): string {
    if (n === 0) return "";
    if (n < 10) return single[n];
    if (n < 20) return teens[n - 10];
    return `${tens[Math.floor(n / 10)]} ${single[n % 10]}`.trim();
  }

  function convertThreeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const hStr = h > 0 ? `${single[h]} Hundred` : "";
    const restStr = convertTwoDigits(rest);
    if (hStr && restStr) return `${hStr} and ${restStr}`;
    return hStr || restStr;
  }

  const crores = Math.floor(amount / 10000000);
  amount %= 10000000;
  const lakhs = Math.floor(amount / 100000);
  amount %= 100000;
  const thousands = Math.floor(amount / 1000);
  amount %= 1000;
  const hundreds = amount;

  const parts: string[] = [];
  if (crores > 0) parts.push(`${convertTwoDigits(crores)} Crore`);
  if (lakhs > 0) parts.push(`${convertTwoDigits(lakhs)} Lakh`);
  if (thousands > 0) parts.push(`${convertTwoDigits(thousands)} Thousand`);
  if (hundreds > 0) parts.push(convertThreeDigits(hundreds));

  return `Rupees ${parts.join(" ")} Only`;
}

export function PayslipDocument({ data }: { data: PayslipData }) {
  const grossEarnings = data.baseSalary + data.allowances;
  const totalDeductions = data.lopDeduction + data.otherDeductions;
  const isRvbc = (data.employee.entity ?? "").toUpperCase() === "RVBC";

  return (
    <Document title={`Payslip - ${data.employee.fullName} - ${data.monthName} ${data.year}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.hospitalTitle}>
            {isRvbc ? "RITHANYA VOLUNTARY BLOOD CENTRE (RVBC)" : "RITHANYA HOSPITAL & RESEARCH CENTRE"}
          </Text>
          <Text style={styles.hospitalSubtitle}>
            NABH Accredited Healthcare Institution · Blood Transfusion & Thalassemia Daycare Centre
          </Text>
          <Text style={styles.hospitalAddress}>
            Opp. Collectorate Complex, Wyra Road, Khammam, Telangana - 507002 · Ph: 08742-234567
          </Text>
          <View style={styles.badgeBanner}>
            <Text style={styles.bannerTitle}>EMPLOYEE SALARY STATEMENT / PAYSLIP</Text>
            <Text style={styles.bannerPeriod}>
              {data.monthName.toUpperCase()} {data.year}
            </Text>
          </View>
        </View>

        {/* Employee & Attendance Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employee & Attendance Particulars</Text>
          <View style={styles.grid2}>
            {/* Col 1 */}
            <View style={styles.gridCol}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Staff Name</Text>
                <Text style={styles.infoValue}>{data.employee.fullName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Designation</Text>
                <Text style={styles.infoValue}>{data.employee.designation}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Department</Text>
                <Text style={styles.infoValue}>{data.employee.department}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Healthcare Entity</Text>
                <Text style={styles.infoValue}>{data.entityLabel}</Text>
              </View>
            </View>

            {/* Col 2 */}
            <View style={styles.gridCol}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Calendar Days in Month</Text>
                <Text style={styles.infoValue}>{data.calendarDays} Days</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Loss of Pay (LOP) Days</Text>
                <Text style={styles.infoValue}>{data.lopDays} Days</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Effective Paid Days</Text>
                <Text style={[styles.infoValue, { color: "#059669" }]}>{data.paidDays} Days</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Disbursement Mode</Text>
                <Text style={styles.infoValue}>Direct Bank Transfer (NEFT)</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Salary Breakdown Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Salary Computation Breakdown</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCol, styles.colDesc]}>Description / Component</Text>
              <Text style={[styles.tableHeaderCol, styles.colType]}>Category</Text>
              <Text style={[styles.tableHeaderCol, styles.colAmount]}>Amount (INR)</Text>
            </View>

            {/* Earnings */}
            <View style={styles.tableRow}>
              <Text style={styles.colDesc}>Monthly Fixed Base Salary</Text>
              <Text style={[styles.colType, { color: "#059669" }]}>Earning</Text>
              <Text style={styles.colAmount}>{inr(data.baseSalary)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.colDesc}>Special Allowances / Healthcare Duties</Text>
              <Text style={[styles.colType, { color: "#059669" }]}>Earning</Text>
              <Text style={styles.colAmount}>{inr(data.allowances)}</Text>
            </View>
            <View style={styles.tableRowTotal}>
              <Text style={[styles.colDesc, { fontFamily: "Helvetica-Bold", color: "#0F4C81" }]}>
                Gross Earnings (Base + Allowances)
              </Text>
              <Text style={styles.colType}>—</Text>
              <Text style={[styles.colAmount, { color: "#0F4C81" }]}>{inr(grossEarnings)}</Text>
            </View>

            {/* Deductions */}
            <View style={styles.tableRow}>
              <Text style={styles.colDesc}>
                Loss of Pay (LOP) Deduction ({data.lopDays} days × {inr(Math.round(data.baseSalary / data.calendarDays))}/day)
              </Text>
              <Text style={[styles.colType, { color: "#DC2626" }]}>Deduction</Text>
              <Text style={[styles.colAmount, { color: "#DC2626" }]}>− {inr(data.lopDeduction)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.colDesc}>Other Deductions / Advances</Text>
              <Text style={[styles.colType, { color: "#DC2626" }]}>Deduction</Text>
              <Text style={[styles.colAmount, { color: "#DC2626" }]}>− {inr(data.otherDeductions)}</Text>
            </View>
            <View style={styles.tableRowTotal}>
              <Text style={[styles.colDesc, { fontFamily: "Helvetica-Bold", color: "#DC2626" }]}>
                Total Deductions (LOP + Other)
              </Text>
              <Text style={styles.colType}>—</Text>
              <Text style={[styles.colAmount, { color: "#DC2626" }]}>− {inr(totalDeductions)}</Text>
            </View>
          </View>
        </View>

        {/* Net Payable Banner */}
        <View style={styles.netPayableContainer}>
          <View>
            <Text style={styles.netPayableLabel}>NET SALARY DISBURSEMENT PAYABLE</Text>
            <Text style={styles.netPayableWords}>{convertNumberToWords(data.netPayable)}</Text>
          </View>
          <Text style={styles.netPayableAmount}>{inr(data.netPayable)}</Text>
        </View>

        {/* Formula Annotation */}
        <View style={styles.formulaNote}>
          <Text>
            Formula: Net Payable = (Base − LOP deduction) + Allowances − Other deductions.
            LOP deduction = (Base ÷ calendar days) × LOP days.
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.signaturesContainer}>
          <View style={styles.signBox}>
            <View style={styles.signLine} />
            <Text style={styles.signTitle}>Employee Acknowledgment</Text>
            <Text style={styles.signSub}>{data.employee.fullName}</Text>
          </View>
          <View style={styles.signBox}>
            <View style={styles.signLine} />
            <Text style={styles.signTitle}>Authorized Signatory</Text>
            <Text style={styles.signSub}>
              {data.authorizerName || "Medical Superintendent / HR Director"}
              {data.signedAt ? ` · Verified` : ""}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Confidential · Generated on {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}
          </Text>
          <Text style={styles.footerText}>Rithanya Healthcare Management Information System</Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Downloads a generated payslip PDF in the user's browser
 */
export async function downloadPayslipPdf(data: PayslipData): Promise<void> {
  const blob = await pdf(<PayslipDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const cleanName = data.employee.fullName.replace(/[^a-zA-Z0-9]/g, "_");
  a.href = url;
  a.download = `Payslip_${cleanName}_${data.monthName}_${data.year}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
