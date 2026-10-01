"use client";

import { useBooking } from "@/components/site/BookingProvider";

export function BookButton({
  children,
  department = "",
  source = "WEBSITE",
  className = "",
}: {
  children: React.ReactNode;
  department?: string;
  source?: string;
  className?: string;
}) {
  const { open } = useBooking();
  return (
    <button type="button" onClick={() => open(department, source)} className={className}>
      {children}
    </button>
  );
}
