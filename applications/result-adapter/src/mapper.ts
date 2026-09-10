import type {
  CanonicalLabResult
} from "./types.js";


export interface FhirBundle {
  resourceType: "Bundle";

  type: string;

  entry?: Array<{
    fullUrl?: string;

    resource?: any;
  }>;
}


export function mapFhirResultToCanonical(
  bundle: FhirBundle
): CanonicalLabResult {

  if (
    !bundle ||
    bundle.resourceType !== "Bundle"
  ) {
    throw new Error(
      "Expected a FHIR Bundle"
    );
  }


  // ------------------------------------------------
  // Find DiagnosticReport
  // ------------------------------------------------

  const diagnosticReport =
    bundle.entry?.find(
      entry =>
        entry.resource?.resourceType ===
        "DiagnosticReport"
    )?.resource;


  if (!diagnosticReport) {

    throw new Error(
      "DiagnosticReport not found"
    );
  }


  // ------------------------------------------------
  // Find Observation
  // ------------------------------------------------

  const observation =
    bundle.entry?.find(
      entry =>
        entry.resource?.resourceType ===
        "Observation"
    )?.resource;


  if (!observation) {

    throw new Error(
      "Observation not found"
    );
  }


  // ------------------------------------------------
  // Extract code
  // ------------------------------------------------

  const coding =
    observation.code?.coding?.[0];


  if (!coding?.code) {

    throw new Error(
      "Observation code not found"
    );
  }


  // ------------------------------------------------
  // Extract value
  // ------------------------------------------------

  const valueQuantity =
    observation.valueQuantity;


  if (
    typeof valueQuantity?.value !==
    "number"
  ) {

    throw new Error(
      "Observation numeric value not found"
    );
  }


  // ------------------------------------------------
  // Extract patient
  // ------------------------------------------------

  const patientIdentifier =
    observation.subject
      ?.identifier;


  const nhsNumber =
    patientIdentifier?.value
    ?? "";


  const patientDisplay =
    observation.subject
      ?.display
    ?? "";


  const patientParts =
    patientDisplay.split(" ");


  const firstName =
    patientParts[0];


  const lastName =
    patientParts.length > 1
      ? patientParts
          .slice(1)
          .join(" ")
      : undefined;


  // ------------------------------------------------
  // Extract reference range
  // ------------------------------------------------

  const reference =
    observation.referenceRange?.[0];


  // ------------------------------------------------
  // Extract interpretation
  // ------------------------------------------------

  const interpretation =
    observation.interpretation?.[0]
      ?.text
    ??
    diagnosticReport.conclusion;


  // ------------------------------------------------
  // Extract accession
  // ------------------------------------------------

  const accessionNumber =
    extractAccessionNumber(
      diagnosticReport.id
    );


  // ------------------------------------------------
  // Create canonical result
  // ------------------------------------------------

  const canonicalResult:
    CanonicalLabResult = {

      resultId:
        observation.id
        ??
        `RESULT-${Date.now()}`,

      accessionNumber,

      patient: {

        nhsNumber,

        firstName,

        lastName
      },

      laboratory: {

        name:
          diagnosticReport.performer
            ?.[0]
            ?.display
      },

      test: {

        localCode:
            coding.code,

        display:
            coding.display
            ??
            observation.code?.text
            ??
            "Unknown test",

        palmObservable: {

            system:
            coding.system,

            code:
            coding.code,

            display:
            coding.display
            ??
            observation.code?.text

        }

    },

      result: {

        value:
          valueQuantity.value,

        unit:
          valueQuantity.unit
          ??
          valueQuantity.code
          ??
          "",

        interpretation,

        referenceRange:
          reference
            ? {

                low:
                  reference.low?.value,

                high:
                  reference.high?.value,

                unit:
                  reference.low?.unit
                  ??
                  reference.high?.unit
              }
            : undefined
      },

      status:
        mapStatus(
          diagnosticReport.status
        ),

      issuedAt:
        diagnosticReport.issued
        ??
        observation.effectiveDateTime
        ??
        new Date().toISOString()
    };


  return canonicalResult;
}


// ==================================================
// Helpers
// ==================================================

function extractAccessionNumber(
  reportId?: string
): string {

  if (!reportId) {

    return "UNKNOWN";
  }


  if (
    reportId.startsWith(
      "report-"
    )
  ) {

    return reportId.substring(
      "report-".length
    );
  }


  return reportId;
}


function mapStatus(
  status?: string
):
  | "FINAL"
  | "PRELIMINARY"
  | "CANCELLED" {

  switch (status) {

    case "final":
      return "FINAL";

    case "preliminary":
      return "PRELIMINARY";

    case "cancelled":
      return "CANCELLED";

    default:
      return "PRELIMINARY";
  }
}