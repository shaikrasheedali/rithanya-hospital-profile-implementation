"use client";

import { Printer } from "lucide-react";
import { Btn } from "@/components/portal/ui";

export function PrintButton() {
  return (
    <Btn onClick={() => window.print()}>
      <Printer className="h-5 w-5" /> Download PDF / Print
    </Btn>
  );
}
