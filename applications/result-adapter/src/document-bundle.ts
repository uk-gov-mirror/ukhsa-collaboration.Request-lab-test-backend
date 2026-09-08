import { randomUUID } from "node:crypto";

import type {
  CanonicalLabResult
} from "./types.js";


const NHS_NUMBER_SYSTEM =
  "https://fhir.nhs.uk/Id/nhs-number";

const ODS_SYSTEM =
  "https://fhir.nhs.uk/Id/ods-organization-code";

const SNOMED_SYSTEM =
  "http://snomed.info/sct";

const LOINC_SYSTEM =
  "http://loinc.org";


// --------------------------------------------------
// Main document builder
// --------------------------------------------------

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function buildPathologyDocument(
  result: CanonicalLabResult
) {

  const patientId = randomUUID();

  const organizationId = randomUUID();

  const specimenId = randomUUID();

  const observationId =
    result.resultId &&
    isValidUuid(result.resultId)
      ? result.resultId
      : randomUUID();

  const diagnosticReportId = randomUUID();

  const compositionId = randomUUID();

  const bundleId = randomUUID();


  // ==================================================
  // PATIENT
  // ==================================================

  const patient = {

    resourceType:
      "Patient",

    id:
      patientId,

    identifier: [

      {
        system:
          NHS_NUMBER_SYSTEM,

        value:
          result.patient.nhsNumber
      }

    ],

    name: [

      {
        use:
          "official",

        family:
          result.patient.lastName,

        given:
          result.patient.firstName
            ? [result.patient.firstName]
            : undefined
      }

    ],

    birthDate:
      result.patient.dateOfBirth

  };


  // ==================================================
  // ORGANIZATION
  // ==================================================

  const organization = {

    resourceType:
      "Organization",

    id:
      organizationId,

    identifier: [

      {
        system:
          ODS_SYSTEM,

        value:
          result.laboratory.organisationCode
          ?? "LAB001"
      }

    ],

    name:
      result.laboratory.name
      ??
      "Pathology Laboratory"

  };


  // ==================================================
  // SPECIMEN
  // ==================================================

  const specimen = {

    resourceType:
      "Specimen",

    id:
      specimenId,

    status:
      "available",

    type: {

      coding: [

        {
          system:
            SNOMED_SYSTEM,

          code:
            "119297000",

          display:
            "Blood specimen"
        }

      ],

      text:
        "Blood specimen"
    },

    subject: {

      reference:
        `Patient/${patientId}`

    },

    receivedTime:
      result.issuedAt

  };


  // ==================================================
  // OBSERVATION
  // ==================================================

  const observation = {

    resourceType:
      "Observation",

    id:
      observationId,

    status:
      mapObservationStatus(
        result.status
      ),

    code: {

      coding: [

        {
          system:
            result.test.palmObservable?.system
            ??
            SNOMED_SYSTEM,

          code:
            result.test.palmObservable?.code
            ??
            result.test.localCode
            ??
            "UNKNOWN",

          display:
            result.test.palmObservable?.display
            ??
            result.test.display
        }

      ],

      text:
        result.test.display

    },

    subject: {

      reference:
        `Patient/${patientId}`

    },

    specimen: {

      reference:
        `Specimen/${specimenId}`

    },

    effectiveDateTime:
      result.issuedAt,

    issued:
      result.issuedAt,

    valueQuantity: {

      value:
        result.result.value,

      unit:
        result.result.unit

    },

    referenceRange:
      buildReferenceRange(
        result
      ),

    interpretation:
      result.result.interpretation
        ? [
            {
              text:
                result.result.interpretation
            }
          ]
        : undefined

  };


  // ==================================================
  // DIAGNOSTIC REPORT
  // ==================================================

  const diagnosticReport = {

    resourceType:
      "DiagnosticReport",

    id:
      diagnosticReportId,

    status:
      mapDiagnosticReportStatus(
        result.status
      ),

    code: {

      coding: [

        {
          system:
            SNOMED_SYSTEM,

          code:
            result.test.palmObservable?.code
            ??
            result.test.localCode
            ??
            "UNKNOWN",

          display:
            result.test.palmObservable?.display
            ??
            result.test.display
        }

      ],

      text:
        result.test.display

    },

    subject: {

      reference:
        `Patient/${patientId}`

    },

    effectiveDateTime:
      result.issuedAt,

    issued:
      result.issuedAt,

    performer: [

      {
        reference:
          `Organization/${organizationId}`,

        display:
          result.laboratory.name
      }

    ],

    specimen: [

      {
        reference:
          `Specimen/${specimenId}`
      }

    ],

    result: [

      {
        reference:
          `Observation/${observationId}`
      }

    ],

    conclusion:
      result.result.interpretation

  };


  // ==================================================
  // COMPOSITION
  // ==================================================

  const composition = {

    resourceType:
      "Composition",

    id:
      compositionId,

    status:
      "final",

    type: {

      coding: [

        {
          system:
            LOINC_SYSTEM,

          code:
            "11502-2",

          display:
            "Laboratory report"
        }

      ],

      text:
        "Laboratory report"

    },

    subject: {

      reference:
        `Patient/${patientId}`

    },

    date:
      result.issuedAt,

    author: [

      {
        reference:
          `Organization/${organizationId}`,

        display:
          result.laboratory.name
      }

    ],

    title:
      `${result.test.display} - Laboratory Report`,

    section: [

      {

        title:
          "Results",

        code: {

          coding: [

            {
              system:
                LOINC_SYSTEM,

              code:
                "26436-6",

              display:
                "Laboratory studies (set)"
            }

          ]

        },

        text: {

          status:
            "generated",

          div:
            `<div xmlns="http://www.w3.org/1999/xhtml">` +
            `${result.test.display}: ` +
            `${result.result.value} ` +
            `${result.result.unit}` +
            `</div>`

        },

        entry: [

          {
            reference:
              `DiagnosticReport/${diagnosticReportId}`
          }

        ]

      }

    ]

  };


  // ==================================================
  // DOCUMENT BUNDLE
  // ==================================================

  return {

    resourceType:
      "Bundle",

    id:
      bundleId,

    identifier: {

      system:
        "https://rlt.nhs.uk/fhir/document",

      value:
        `${result.accessionNumber}-${bundleId}`

    },

    type:
      "document",

    timestamp:
      new Date().toISOString(),

    entry: [

      // IMPORTANT:
      // Composition MUST be first
      {
        fullUrl:
          `urn:uuid:${compositionId}`,

        resource:
          composition
      },

      {
        fullUrl:
          `urn:uuid:${patientId}`,

        resource:
          patient
      },

      {
        fullUrl:
          `urn:uuid:${organizationId}`,

        resource:
          organization
      },

      {
        fullUrl:
          `urn:uuid:${specimenId}`,

        resource:
          specimen
      },

      {
        fullUrl:
          `urn:uuid:${diagnosticReportId}`,

        resource:
          diagnosticReport
      },

      {
        fullUrl:
          `urn:uuid:${observationId}`,

        resource:
          observation
      }

    ]

  };
}


// ==================================================
// Helpers
// ==================================================

function mapObservationStatus(status: CanonicalLabResult["status"]) {
  switch (status) {
    case "FINAL":
    case "F":
      return "final";

    case "CANCELLED":
    case "C":
      return "cancelled";

    case "PRELIMINARY":
    case "P":
      return "preliminary";

    default:
      return "preliminary";
  }
}

function mapDiagnosticReportStatus(status: CanonicalLabResult["status"]) {
  switch (status) {
    case "FINAL":
    case "F":
      return "final";

    case "CANCELLED":
    case "C":
      return "cancelled";

    case "PRELIMINARY":
    case "P":
      return "preliminary";

    default:
      return "preliminary";
  }
}


function buildReferenceRange(
  result: CanonicalLabResult
) {

  const range =
    result.result.referenceRange;


  if (!range) {
    return undefined;
  }


  return [

    {

      low:
        range.low !== undefined
          ? {
              value:
                range.low,

              unit:
                range.unit
                ??
                result.result.unit
            }
          : undefined,

      high:
        range.high !== undefined
          ? {
              value:
                range.high,

              unit:
                range.unit
                ??
                result.result.unit
            }
          : undefined

    }

  ];
}