export type Role = "SUPERADMIN" | "ADMIN" | "STAFF";
export type ModuleKey = "emr" | "bloodbank" | "cms" | "store" | "hr" | "finance" | "dpdp" | "settings" | "access";

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  modules: Record<ModuleKey, boolean>;
};

export type Settings = {
  id: string;
  legalName: string;
  clinicalTagline: string;
  emergencyHotline: string;
  secondaryHotline: string | null;
  whatsappNumber: string;
  email: string;
  criticalBloodAlertThreshold: number;
  physicalAddress: string;
  opdTimings: string;
  noticeBanner: string;
  seoPageTitle: string;
  metaDescription: string;
  targetKeywords: string;
  canonicalUrl: string;
  robotsIndexFollow: boolean;
  faviconUrl: string | null;
  socialShareThumbnailUrl: string | null;
};
