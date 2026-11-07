export type CatalogRecord = {
  id: number;
  status: string;
  [key: string]: string | number | null;
};
export type Field = {
  key: string;
  label: string;
  max?: number;
  number?: number;
  required?: boolean;
  choices?: string[];
  lookup?: string;
};
export type CatalogKind =
  | "departments"
  | "facility-categories"
  | "asset-categories"
  | "facilities"
  | "assets"
  | "instances";
export const catalogLabels: Record<CatalogKind, string> = {
  departments: 'department', 'facility-categories': 'facility category',
  'asset-categories': 'asset category', facilities: 'facility', assets: 'asset', instances: 'tagged item',
};
const text = (
  key: string,
  label: string,
  max: number,
  required = false,
): Field => ({ key, label, max, required });
const description = text("description", "Description", 4000);
const condition: Field = {
  key: "condition_status",
  label: "Condition",
  choices: ["good", "fair", "damaged", "lost", "inspection"],
};
export const catalogs: Record<
  CatalogKind,
  {
    title: string;
    read?: string;
    create: string;
    edit: string;
    status: string;
    fields: Field[];
  }
> = {
  departments: {
    title: "Departments",
    create: "department.manage",
    edit: "department.manage",
    status: "department.manage",
    fields: [
      text("department_code", "Department code", 30, true),
      text("department_name", "Department name", 150, true),
      description,
    ],
  },
  "facility-categories": {
    title: "Facility categories",
    create: "facility.category.manage",
    edit: "facility.category.manage",
    status: "facility.category.manage",
    fields: [text("category_name", "Category name", 100, true), description],
  },
  "asset-categories": {
    title: "Asset categories",
    create: "asset.category.manage",
    edit: "asset.category.manage",
    status: "asset.category.manage",
    fields: [text("category_name", "Category name", 100, true), description],
  },
  facilities: {
    title: "Facilities",
    read: "facility.view",
    create: "facility.create",
    edit: "facility.update",
    status: "facility.deactivate",
    fields: [
      text("facility_code", "Facility code", 50, true),
      text("facility_name", "Facility name", 150, true),
      {
        key: "category_id",
        label: "Category",
        lookup: "facility-categories",
        required: true,
      },
      { key: "capacity", label: "Capacity", number: 1, required: true },
      text("building", "Building", 120),
      text("location_details", "Location details", 255),
      description,
    ],
  },
  assets: {
    title: "Assets",
    read: "asset.view",
    create: "asset.create",
    edit: "asset.update",
    status: "asset.deactivate",
    fields: [
      text("asset_code", "Asset code", 60, true),
      text("asset_name", "Asset name", 150, true),
      {
        key: "category_id",
        label: "Category",
        lookup: "asset-categories",
        required: true,
      },
      {
        key: "owning_department_id",
        label: "Owning department",
        lookup: "departments",
        required: true,
      },
      {
        key: "tracking_mode",
        label: "Tracking mode",
        choices: ["quantity", "individual"],
        required: true,
      },
      { key: "total_quantity", label: "Total quantity", number: 0 },
      { key: "usable_quantity", label: "Usable quantity", number: 0 },
      condition,
      text("location", "Location", 180),
      description,
    ],
  },
  instances: {
    title: "Tagged items",
    read: "asset.view",
    create: "asset.create",
    edit: "asset.update",
    status: "asset.deactivate",
    fields: [
      text("asset_tag", "Asset tag", 60, true),
      text("serial_number", "Serial number", 120),
      condition,
      text("location", "Location", 180),
    ],
  },
};
export const catalogName = (row: CatalogRecord) =>
  String(
    row.department_name ||
      row.category_name ||
      row.facility_name ||
      row.asset_name ||
      row.asset_tag ||
      `Record #${row.id}`,
  );
export function canManage(kind: CatalogKind, permissions: string[]) {
  const config = catalogs[kind];
  return (
    (!config.read || permissions.includes(config.read)) &&
    [config.create, config.edit, config.status].some((p) =>
      permissions.includes(p),
    )
  );
}
export function catalogPayload(
  kind: CatalogKind,
  values: Record<string, string>,
  original?: CatalogRecord,
) {
  const result: Record<string, string | number | null> = {};
  for (const field of catalogs[kind].fields) {
    if (original && field.key === "tracking_mode") continue;
    if (
      kind === "assets" &&
      values.tracking_mode === "individual" &&
      ["total_quantity", "usable_quantity"].includes(field.key)
    )
      continue;
    const value = (values[field.key] ?? "").trim();
    let parsed: string | number | null = value || null;
    if (field.number !== undefined || field.lookup) {
      const minimum = field.number ?? 1;
      if (
        !/^\d+$/.test(value) ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) < minimum ||
        Number(value) > 4294967295
      )
        throw new Error(
          `${field.label} must be a whole number of at least ${minimum}.`,
        );
      parsed = Number(value);
    } else {
      if (field.required && !value)
        throw new Error(`${field.label} is required.`);
      if (field.max && new TextEncoder().encode(value).length > field.max)
        throw new Error(`${field.label} must be at most ${field.max} bytes.`);
      if (field.choices && !field.choices.includes(value))
        throw new Error(`Choose a valid ${field.label.toLowerCase()}.`);
    }
    // Send only changed fields: a background stock update must not be overwritten.
    if (!original || String(original[field.key] ?? "") !== String(parsed ?? ""))
      result[field.key] = parsed;
  }
  if (kind === "assets" && values.tracking_mode !== "individual") {
    if (Number(values.usable_quantity) > Number(values.total_quantity))
      throw new Error("Usable quantity cannot exceed total quantity.");
    if (
      !["good", "fair"].includes(values.condition_status) &&
      Number(values.usable_quantity) > 0
    )
      throw new Error("Unusable pools must have zero usable quantity.");
  }
  if (!Object.keys(result).length) throw new Error("No changes to save.");
  return result;
}
