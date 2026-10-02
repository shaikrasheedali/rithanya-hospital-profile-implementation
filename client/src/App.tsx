import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import DpdpPage from "@/pages/site/Dpdp";
import BloodBankPublicPage from "@/pages/site/BloodBank";
import PortalLayout from "@/pages/portal/PortalLayout";
import PortalLoginPage from "@/pages/portal/Login";
import DashboardPage from "@/pages/portal/Dashboard";
import AppointmentsPage from "@/pages/portal/Appointments";
import InpatientsPage from "@/pages/portal/Inpatients";
import OutpatientsPage from "@/pages/portal/Outpatients";
import DischargedPage from "@/pages/portal/Discharged";
import DiagnosisCategoriesPage from "@/pages/portal/DiagnosisCategories";
import BloodBankPage from "@/pages/portal/BloodBank";
import CmsCollectionPage from "@/pages/portal/CmsCollection";
import MediaLibraryPage from "@/pages/portal/MediaLibraryPage";
import StoreProductsPage from "@/pages/portal/StoreProducts";
import StoreOrdersPage from "@/pages/portal/StoreOrders";
import HrEmployeesPage from "@/pages/portal/HrEmployees";
import HrPayrollPage from "@/pages/portal/HrPayroll";
import PayslipPage from "@/pages/portal/Payslip";
import FinanceLedgerPage from "@/pages/portal/FinanceLedger";
import FinanceCategoriesPage from "@/pages/portal/FinanceCategories";
import FinanceOverviewPage from "@/pages/portal/FinanceOverview";
import DpdpRequestsPage from "@/pages/portal/DpdpRequests";
import AccessUsersPage from "@/pages/portal/AccessUsers";
import AccessPermissionsPage from "@/pages/portal/AccessPermissions";
import SettingsMasterPage from "@/pages/portal/SettingsMaster";
import SettingsSeoPage from "@/pages/portal/SettingsSeo";
import SettingsAuditLogsPage from "@/pages/portal/SettingsAuditLogs";

function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-32 text-center sm:px-8">
      <h1 className="text-4xl font-semibold">Page not found</h1>
      <p className="mt-2 text-ink/70">The page you are looking for does not exist.</p>
      <a href="/" className="mt-6 inline-block rounded-full bg-royal px-6 py-3 font-semibold text-white">← Back home</a>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="specialties/:slug" element={<Navigate to="/clinical-care/specialties/:slug" replace />} />
          <Route path="treatments" element={<Navigate to="/clinical-care/treatments" replace />} />
          <Route path="treatments/:slug" element={<Navigate to="/clinical-care/treatments/:slug" replace />} />
          <Route path="services" element={<Navigate to="/clinical-care/services" replace />} />
          <Route path="services/:slug" element={<Navigate to="/clinical-care/services/:slug" replace />} />
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
          <Route path="dpdp-erasure-request" element={<DpdpPage />} />
        </Route>

        {/* Portal */}
        <Route path="portal/login" element={<PortalLoginPage />} />
        <Route path="portal" element={<PortalLayout />}>
          <Route index element={<Navigate to="/portal/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="inpatients" element={<InpatientsPage />} />
          <Route path="outpatients" element={<OutpatientsPage />} />
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
    </BrowserRouter>
  );
}
