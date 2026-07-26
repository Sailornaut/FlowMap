// @ts-check
/**
 * Stage 1: Property Validation
 *
 * Checks required fields, geocode confirmation, vacancy data completeness.
 * No external API calls — pure validation of existing data.
 *
 * Outputs: validation summary with field-level status and data completeness.
 * Confidence: high if all required fields present, degrades with missing data.
 */

export const STAGE_NAME = "property-validation";
export const STAGE_VERSION = "1.0.0";

/**
 * Required property fields and their descriptions.
 */
const REQUIRED_PROPERTY_FIELDS = [
  { field: "name", label: "Property name" },
  { field: "address", label: "Street address" },
  { field: "city", label: "City" },
  { field: "state", label: "State" },
  { field: "property_type", label: "Property type" },
];

const RECOMMENDED_PROPERTY_FIELDS = [
  { field: "lat", label: "Latitude" },
  { field: "lng", label: "Longitude" },
  { field: "total_gla_sqft", label: "Total GLA" },
  { field: "parking_spaces", label: "Parking spaces" },
  { field: "center_subtype", label: "Center subtype" },
];

const REQUIRED_VACANCY_FIELDS = [
  { field: "unit_label", label: "Unit label" },
];

const RECOMMENDED_VACANCY_FIELDS = [
  { field: "sqft", label: "Unit size (sqft)" },
  { field: "asking_rent_psf", label: "Asking rent PSF" },
  { field: "rent_basis", label: "Rent basis" },
  { field: "condition", label: "Condition" },
  { field: "placement", label: "Placement" },
  { field: "venting_possible", label: "Venting availability" },
  { field: "grease_trap", label: "Grease trap" },
  { field: "drive_through", label: "Drive-through" },
  { field: "patio_possible", label: "Patio / outdoor area" },
];

/**
 * Check if a field value is meaningfully present (not null, undefined, empty, or "unknown").
 * @param {*} value
 * @returns {boolean}
 */
function isPresent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && (value.trim() === "" || value === "unknown")) return false;
  return true;
}

/**
 * Validate a single entity against a field list.
 * @param {object} entity
 * @param {{field: string, label: string}[]} fields
 * @returns {{ present: string[], missing: string[], completeness: number }}
 */
function validateFields(entity, fields) {
  const present = [];
  const missing = [];
  for (const { field, label } of fields) {
    if (isPresent(entity[field])) {
      present.push(label);
    } else {
      missing.push(label);
    }
  }
  const completeness = fields.length > 0 ? present.length / fields.length : 1;
  return { present, missing, completeness };
}

/**
 * Check geocode validity.
 * @param {object} property
 * @returns {{ valid: boolean, issues: string[] }}
 */
function validateGeocode(property) {
  const issues = [];
  const lat = property.lat;
  const lng = property.lng;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    issues.push("Missing coordinates — will attempt geocoding from address");
    return { valid: false, issues };
  }

  // Basic sanity: US bounds (rough)
  if (lat < 24 || lat > 50 || lng < -125 || lng > -66) {
    issues.push(`Coordinates (${lat}, ${lng}) outside continental US bounds — verify geocode`);
  }

  return { valid: issues.length === 0, issues };
}

/** @type {import('../runner.js').StageDefinition} */
const stage = {
  name: STAGE_NAME,
  version: STAGE_VERSION,
  // Included in all depths
  async run(ctx) {
    const { property, tenants, vacancies } = ctx;
    const errors = [];
    const warnings = [];

    // Validate property required fields
    const propRequired = validateFields(property, REQUIRED_PROPERTY_FIELDS);
    if (propRequired.missing.length > 0) {
      errors.push(`Missing required property fields: ${propRequired.missing.join(", ")}`);
    }

    // Validate property recommended fields
    const propRecommended = validateFields(property, RECOMMENDED_PROPERTY_FIELDS);
    if (propRecommended.missing.length > 0) {
      warnings.push(`Missing recommended property fields: ${propRecommended.missing.join(", ")}`);
    }

    // Validate geocode
    const geocode = validateGeocode(property);
    if (!geocode.valid) {
      for (const issue of geocode.issues) {
        if (issue.includes("outside continental US")) {
          warnings.push(issue);
        } else {
          // Missing coordinates are a warning, not an error —
          // geo-enrichment stage will attempt geocoding from address.
          warnings.push(issue);
        }
      }
    }

    // Validate vacancies
    const vacancyResults = [];
    for (let i = 0; i < vacancies.length; i++) {
      const v = vacancies[i];
      const vRequired = validateFields(v, REQUIRED_VACANCY_FIELDS);
      const vRecommended = validateFields(v, RECOMMENDED_VACANCY_FIELDS);

      if (vRequired.missing.length > 0) {
        errors.push(`Vacancy ${i + 1}: missing required fields: ${vRequired.missing.join(", ")}`);
      }
      if (vRecommended.missing.length > 0) {
        warnings.push(`Vacancy ${v.unit_label || i + 1}: missing recommended fields: ${vRecommended.missing.join(", ")}`);
      }

      vacancyResults.push({
        unit_label: v.unit_label || `vacancy_${i + 1}`,
        required_completeness: vRequired.completeness,
        recommended_completeness: vRecommended.completeness,
        missing_recommended: vRecommended.missing,
      });
    }

    // Check for vacancies at all
    if (vacancies.length === 0) {
      warnings.push("No vacancies defined — analysis will be property-level only");
    }

    // Compute overall data completeness
    const allFields = [
      ...REQUIRED_PROPERTY_FIELDS,
      ...RECOMMENDED_PROPERTY_FIELDS,
    ];
    const propCompleteness = validateFields(property, allFields).completeness;

    const vacancyCompleteness = vacancies.length > 0
      ? vacancyResults.reduce((sum, v) => sum + v.recommended_completeness, 0) / vacancies.length
      : 0;

    const overallCompleteness = vacancies.length > 0
      ? (propCompleteness + vacancyCompleteness) / 2
      : propCompleteness;

    // Determine confidence from validation results
    let confidence;
    if (errors.length === 0 && warnings.length <= 2) {
      confidence = "high";
    } else if (errors.length === 0) {
      confidence = "moderate";
    } else if (errors.length <= 2) {
      confidence = "preliminary";
    } else {
      confidence = "insufficient";
    }

    return {
      outputs: {
        valid: errors.length === 0,
        errors,
        warnings,
        property_completeness: Math.round(propCompleteness * 100) / 100,
        vacancy_results: vacancyResults,
        overall_completeness: Math.round(overallCompleteness * 100) / 100,
        geocode_valid: geocode.valid,
        tenant_count: tenants.length,
        vacancy_count: vacancies.length,
      },
      observations: [], // No external data consumed
      confidence,
      completeness: overallCompleteness,
      cost: 0, // No API calls
    };
  },
};

export default stage;
