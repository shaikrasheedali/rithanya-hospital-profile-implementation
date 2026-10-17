import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import SiteLayout from "@/pages/site/SiteLayout";
import HomePage from "@/pages/site/Home";
import AboutPage from "@/pages/site/About";
import FacilitiesPage from "@/pages/site/Facilities";
import FacilityDetailPage from "@/pages/site/FacilityDetail";
import ClinicalCarePage from "@/pages/site/ClinicalCare";
import ClinicalTypePage from "@/pages/site/ClinicalType";
import ClinicalDetailPage from "@/pages/site/ClinicalDetail";
import DoctorsPage from "@/pages/site/Doctors";
import DoctorDetailPage from "@/pages/site/DoctorDetail";
import ProductsPage from "@/pages/site/Products";
import GalleryPage from "@/pages/site/Gallery";
import InsightsPage from "@/pages/site/Insights";
import InsightDetailPage from "@/pages/site/InsightDetail";
import InsurancePage from "@/pages/site/Insurance";
import ContactPage from "@/pages/site/Contact";
import PrivacyPage from "@/pages/site/Privacy";
import TermsPage from "@/pages/site/Terms";
import DisclaimerPage from "@/pages/site/Disclaimer";
import DpdpPage from "@/pages/site/Dpdp";
import BloodBankPublicPage from "@/pages/site/BloodBank";

// The admin portal ships as its own chunk so the public site stays lean;
// pages load lazily and render inside a neutral shell (no layout flash).
const PortalLayout = lazy(() => import("@/pages/portal/PortalLayout"));
const PortalLoginPage = lazy(() => import("@/pages/portal/Login"));
const DashboardPage = lazy(() => import("@/pages/portal/Dashboard"));
const AppointmentsPage = lazy(() => import("@/pages/portal/Appointments"));
const InpatientsPage = lazy(() => import("@/pages/portal/Inpatients"));
const OutpatientsPage = lazy(() => import("@/pages/portal/Outpatients"));
const PatientProfilePage = lazy(() => import("@/pages/portal/PatientProfile"));
const DischargedPage = lazy(() => import("@/pages/portal/Discharged"));
const DiagnosisCategoriesPage = lazy(() => import("@/pages/portal/DiagnosisCategories"));
const BloodBankPage = lazy(() => import("@/pages/portal/BloodBank"));
const CmsCollectionPage = lazy(() => import("@/pages/portal/CmsCollection"));
const MediaLibraryPage = lazy(() => import("@/pages/portal/MediaLibraryPage"));
const StoreProductsPage = lazy(() => import("@/pages/portal/StoreProducts"));
const StoreOrdersPage = lazy(() => import("@/pages/portal/StoreOrders"));
const HrEmployeesPage = lazy(() => import("@/pages/portal/HrEmployees"));
const HrPayrollPage = lazy(() => import("@/pages/portal/HrPayroll"));
const PayslipPage = lazy(() => import("@/pages/portal/Payslip"));
const FinanceLedgerPage = lazy(() => import("@/pages/portal/FinanceLedger"));
const FinanceCategoriesPage = lazy(() => import("@/pages/portal/FinanceCategories"));
const FinanceOverviewPage = lazy(() => import("@/pages/portal/FinanceOverview"));
const DpdpRequestsPage = lazy(() => import("@/pages/portal/DpdpRequests"));
const AccessUsersPage = lazy(() => import("@/pages/portal/AccessUsers"));
const AccessPermissionsPage = lazy(() => import("@/pages/portal/AccessPermissions"));
const SettingsMasterPage = lazy(() => import("@/pages/portal/SettingsMaster"));
const SettingsSeoPage = lazy(() => import("@/pages/portal/SettingsSeo"));
const SettingsAuditLogsPage = lazy(() => import("@/pages/portal/SettingsAuditLogs"));

function PortalFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-royal border-t-transparent" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-32 text-center sm:px-8">
      <h1 className="text-4xl font-semibold">Page not found</h1>
      <p className="mt-2 text-ink/70">The page you are looking for does not exist.</p>
      <a href="/" className="mt-6 inline-block rounded-full bg-royal px-6 py-3 font-semibold text-white">← Back home</a>
    </div>
  );
}

function LegacyClinicalRedirect({ kind }: { kind: string }) {
  const { slug } = useParams();
  return <Navigate to={`/clinical-care/${kind}/${slug ?? ""}`} replace />;
}

/** Navigations start at the top of the page (long detail pages otherwise land
 * the visitor mid-scroll). `behavior: "instant"` overrides the global
 * `scroll-behavior: smooth`, which would otherwise animate a long page back up. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<PortalFallback />}>
        <Routes>
        {/* Public site */}
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="facilities" element={<FacilitiesPage />} />
          <Route path="facilities/:slug" element={<FacilityDetailPage />} />
          <Route path="clinical-care" element={<ClinicalCarePage />} />
          <Route path="clinical-care/:type" element={<ClinicalTypePage />} />
          <Route path="clinical-care/:type/:slug" element={<ClinicalDetailPage />} />
          <Route path="specialties" element={<Navigate to="/clinical-care/specialties" replace />} />
          <Route path="specialties/:slug" element={<LegacyClinicalRedirect kind="specialties" />} />
          <Route path="treatments" element={<Navigate to="/clinical-care/treatments" replace />} />
          <Route path="treatments/:slug" element={<LegacyClinicalRedirect kind="treatments" />} />
          <Route path="services" element={<Navigate to="/clinical-care/services" replace />} />
          <Route path="services/:slug" element={<LegacyClinicalRedirect kind="services" />} />
          <Route path="doctors" element={<DoctorsPage />} />
          <Route path="doctors/:slug" element={<DoctorDetailPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="pharmacy" element={<Navigate to="/products" replace />} />
          <Route path="blood-bank" element={<BloodBankPublicPage />} />
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="blogs" element={<InsightsPage />} />
          <Route path="blogs/:slug" element={<InsightDetailPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="insights/:slug" element={<InsightDetailPage />} />
          <Route path="insurance-providers" element={<InsurancePage />} />
          <Route path="insurance" element={<Navigate to="/insurance-providers" replace />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="privacy-policy" element={<PrivacyPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms-conditions" element={<TermsPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="disclaimer" element={<DisclaimerPage />} />
          <Route path="dpdp-erasure-request" element={<DpdpPage />} />
        </Route>

        {/* Portal (lazy chunk) */}
        <Route path="portal/login" element={<PortalLoginPage />} />
        <Route path="portal" element={<PortalLayout />}>
          <Route index element={<Navigate to="/portal/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="inpatients" element={<InpatientsPage />} />
          <Route path="outpatients" element={<OutpatientsPage />} />
          <Route path="patients/:id" element={<PatientProfilePage />} />
          <Route path="discharged-patients" element={<DischargedPage />} />
          <Route path="diagnosis-categories" element={<DiagnosisCategoriesPage />} />
          <Route path="blood-bank" element={<BloodBankPage />} />
          <Route path="cms/:collection" element={<CmsCollectionPage />} />
          <Route path="cms/media-library" element={<MediaLibraryPage />} />
          <Route path="store/products" element={<StoreProductsPage />} />
          <Route path="store/orders" element={<StoreOrdersPage />} />
          <Route path="hr/employees" element={<HrEmployeesPage />} />
          <Route path="hr/payroll" element={<HrPayrollPage />} />
          <Route path="hr/payslip/:id" element={<PayslipPage />} />
          <Route path="finance/ledger" element={<FinanceLedgerPage />} />
          <Route path="finance/categories" element={<FinanceCategoriesPage />} />
          <Route path="finance/overview" element={<FinanceOverviewPage />} />
          <Route path="compliance/dpdp-requests" element={<DpdpRequestsPage />} />
          <Route path="access/users" element={<AccessUsersPage />} />
          <Route path="access/permissions" element={<AccessPermissionsPage />} />
          <Route path="settings/master" element={<SettingsMasterPage />} />
          <Route path="settings/seo" element={<SettingsSeoPage />} />
          <Route path="settings/audit-logs" element={<SettingsAuditLogsPage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
