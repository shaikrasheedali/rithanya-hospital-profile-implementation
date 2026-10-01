export interface PayrollComputationInput {
  baseSalary: number;
  calendarDays: number;
  lopDays: number;
  allowances: number;
  otherDeductions: number;
}

export function computeMonthlyPayroll(input: PayrollComputationInput) {
  const { baseSalary, calendarDays, lopDays, allowances, otherDeductions } = input;
  const perDaySalary = baseSalary / (calendarDays || 30);
  const lopDeduction = Math.round(perDaySalary * lopDays * 100) / 100;
  const paidDays = Math.max(0, calendarDays - lopDays);
  const netPayable = Math.round((baseSalary - lopDeduction + allowances - otherDeductions) * 100) / 100;
  return {
    baseSalary,
    calendarDays,
    lopDays,
    paidDays,
    perDaySalary: Math.round(perDaySalary * 100) / 100,
    lopDeduction,
    allowances,
    otherDeductions,
    netPayable: Math.max(0, netPayable),
  };
}

export const daysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();
