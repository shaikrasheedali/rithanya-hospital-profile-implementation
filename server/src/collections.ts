export type FieldType = "text" | "textarea" | "richtext" | "number" | "decimal" | "select" | "checkbox";

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  help?: string;
  max?: number;
  half?: boolean;
  showIf?: (values: Record<string, unknown>) => boolean;
};

export type CollectionKey =
  | "specialties"
  | "treatments"
  | "services"
  | "doctors"
  | "insurance"
  | "gallery"
  | "blogs"
  | "testimonials"
  | "products";

export type CollectionDef = {
  key: CollectionKey;
  label: string;
  singular: string;
  module: "cms" | "store";
  titleField: string;
  slugSource?: string;
  subtitleField?: string;
  mediaHelp: string;
  fields: FieldDef[];
};

const sortOrder: FieldDef = {
  name: "sortOrder",
  label: "Display order",
  type: "number",
  half: true,
  help: "Lower numbers appear first.",
};

export const COLLECTIONS: Record<CollectionKey, CollectionDef> = {
  specialties: {
    key: "specialties",
    label: "Specialties",
    singular: "Specialty",
    module: "cms",
    titleField: "title",
    slugSource: "title",
    subtitleField: "shortSummary",
    mediaHelp: "First image becomes the cover. Add more images or videos for the detail page gallery.",
    fields: [
      { name: "title", label: "Specialty title", type: "text", required: true },
      { name: "shortSummary", label: "Short summary", type: "textarea", required: true, max: 500 },
      { name: "contentHtml", label: "Detailed content", type: "richtext" },
      sortOrder,
    ],
  },
  treatments: {
    key: "treatments",
    label: "Treatments",
    singular: "Treatment",
    module: "cms",
    titleField: "title",
    slugSource: "title",
    subtitleField: "shortSummary",
    mediaHelp: "Showcase imagery or videos of the treatment pathway.",
    fields: [
      { name: "title", label: "Treatment title", type: "text", required: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        half: true,
        options: ["Blood Disorders", "Diabetes & Endocrine", "General Medicine", "Infectious Diseases", "Diagnostics & Wellness"],
      },
      { name: "isFlagship", label: "Flagship treatment (shown on home page)", type: "checkbox", half: true },
      { name: "shortSummary", label: "Short summary", type: "textarea", required: true, max: 500 },
      { name: "contentHtml", label: "Detailed content", type: "richtext" },
      sortOrder,
    ],
  },
  services: {
    key: "services",
    label: "Services",
    singular: "Service",
    module: "cms",
    titleField: "title",
    slugSource: "title",
    subtitleField: "shortSummary",
    mediaHelp: "Photos or videos of the facility or service.",
    fields: [
      { name: "title", label: "Service title", type: "text", required: true },
      {
        name: "category",
        label: "Service type",
        type: "select",
        half: true,
        options: ["Daycare", "Outpatient", "Inpatient", "Diagnostics", "Pharmacy", "Emergency"],
      },
      sortOrder,
      { name: "shortSummary", label: "Short summary", type: "textarea", required: true, max: 500 },
      { name: "contentHtml", label: "Detailed content", type: "richtext" },
    ],
  },
  doctors: {
    key: "doctors",
    label: "Doctors",
    singular: "Doctor",
    module: "cms",
    titleField: "fullName",
    slugSource: "fullName",
    subtitleField: "designation",
    mediaHelp: "Portrait photo first. Extra images or videos (clinic, camps, intro video) are optional.",
    fields: [
      { name: "fullName", label: "Full name", type: "text", required: true },
      { name: "qualifications", label: "Qualifications", type: "text", required: true, half: true },
      { name: "designation", label: "Designation", type: "text", required: true, half: true },
      { name: "department", label: "Department", type: "text", required: true, half: true },
      { name: "experienceYears", label: "Years of experience", type: "number", half: true },
      { name: "consultationTimings", label: "Consultation timings", type: "text" },
      { name: "isVisiting", label: "Visiting faculty", type: "checkbox", half: true },
      sortOrder,
      { name: "biographyHtml", label: "Biography", type: "richtext" },
    ],
  },
  insurance: {
    key: "insurance",
    label: "Insurance Providers",
    singular: "Insurance Provider",
    module: "cms",
    titleField: "name",
    subtitleField: "schemeType",
    mediaHelp: "Provider logo or scheme artwork.",
    fields: [
      { name: "name", label: "Provider / scheme name", type: "text", required: true },
      {
        name: "schemeType",
        label: "Scheme type",
        type: "select",
        required: true,
        half: true,
        options: ["Government Scheme", "Private TPA", "Corporate / PSU"],
      },
      sortOrder,
      { name: "descriptionHtml", label: "Description & process", type: "richtext" },
    ],
  },
  gallery: {
    key: "gallery",
    label: "Gallery",
    singular: "Gallery Item",
    module: "cms",
    titleField: "title",
    subtitleField: "caption",
    mediaHelp: "Images or self-hosted videos shown in the gallery. For social embeds, attach a cover image that is shown as the thumbnail.",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      {
        name: "mediaType",
        label: "Gallery type",
        type: "select",
        half: true,
        options: ["IMAGE", "VIDEO", "IFRAME_YOUTUBE", "IFRAME_FACEBOOK", "IFRAME_INSTAGRAM"],
      },
      sortOrder,
      {
        name: "embedCode",
        label: "Embed iframe code / URL",
        type: "textarea",
        help: "Paste the <iframe …> embed code or the public post URL (YouTube / Facebook / Instagram).",
      },
      { name: "caption", label: "Caption", type: "textarea" },
    ],
  },
  blogs: {
    key: "blogs",
    label: "Insights / Blogs",
    singular: "Article",
    module: "cms",
    titleField: "title",
    slugSource: "title",
    subtitleField: "excerpt",
    mediaHelp: "First image is the cover. You can add more images or videos to illustrate the article.",
    fields: [
      { name: "title", label: "Article title", type: "text", required: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        half: true,
        options: ["Diabetes Management", "Blood Disorders", "Maternal Health", "General Wellness"],
      },
      { name: "authorName", label: "Author", type: "text", half: true },
      { name: "isPublished", label: "Published", type: "checkbox", half: true },
      { name: "excerpt", label: "Excerpt", type: "textarea", required: true, max: 600 },
      { name: "contentHtml", label: "Article body", type: "richtext" },
    ],
  },
  testimonials: {
    key: "testimonials",
    label: "Testimonials",
    singular: "Testimonial",
    module: "cms",
    titleField: "patientName",
    subtitleField: "quote",
    mediaHelp: "Patient photo (with consent) or a thank-you video.",
    fields: [
      { name: "patientName", label: "Patient / family name", type: "text", required: true, half: true },
      { name: "location", label: "Location", type: "text", half: true },
      { name: "treatment", label: "Treatment received", type: "text", half: true },
      { name: "rating", label: "Rating (1-5)", type: "number", half: true },
      { name: "quote", label: "Testimonial", type: "textarea", required: true },
      sortOrder,
    ],
  },
  products: {
    key: "products",
    label: "Pharmacy Products",
    singular: "Product",
    module: "store",
    titleField: "name",
    slugSource: "name",
    subtitleField: "category",
    mediaHelp: "Product photos or demo videos. The first image is used on the storefront card.",
    fields: [
      { name: "name", label: "Product name", type: "text", required: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        half: true,
        options: ["Diabetes Care", "Blood Health", "Wellness", "First Aid", "Senior Care"],
      },
      { name: "price", label: "Price (₹)", type: "decimal", required: true, half: true },
      { name: "stockUnits", label: "Stock units", type: "number", half: true },
      { name: "isPrescriptionReq", label: "Prescription required", type: "checkbox", half: true },
      { name: "description", label: "Description", type: "textarea" },
      sortOrder,
    ],
  },
};

export const COLLECTION_KEYS = Object.keys(COLLECTIONS) as CollectionKey[];
