import { CanonicalLabRequest } from "./types.js";

export function canonicalToFHIR(
  request: CanonicalLabRequest
) {

  const patientId = `patient-${request.patient.nhsNumber}`;
  const specimenId = `specimen-${request.requestId}`;

  const entries: any[] = [];

  const patient = {
    resourceType: "Patient",
    id: patientId,

    identifier: [
      {
        system: "https://fhir.nhs.uk/Id/nhs-number",
        value: request.patient.nhsNumber
      }
    ],

    name: [
      {
        use: "official",
        family: request.patient.lastName,
        given: [
          request.patient.firstName
        ]
      }
    ],

    gender: request.patient.gender,

    ...(request.patient.dateOfBirth
      ? {
          birthDate: request.patient.dateOfBirth
        }
      : {})
  };

  entries.push({
    fullUrl: `urn:uuid:${patientId}`,
    resource: patient
  });

  const specimen = {
    resourceType: "Specimen",
    id: specimenId,

    status: "available",

    type: {
      coding: request.specimen.code
        ? [
            {
              system:
                request.specimen.system ||
                "http://snomed.info/sct",
              code: request.specimen.code,
              display: request.specimen.type
            }
          ]
        : [],
      text: request.specimen.type
    },

    subject: {
      reference: `Patient/${patientId}`
    }
  };

  entries.push({
    fullUrl: `urn:uuid:${specimenId}`,
    resource: specimen
  });

  const serviceRequest = {
    resourceType: "ServiceRequest",

    id: request.requestId,

    status: "active",

    intent: "order",

    code: {
      coding: [
        {
          system:
            request.test.system ||
            "http://snomed.info/sct",
          code: request.test.code,
          display: request.test.display
        }
      ]
    },

    subject: {
      reference: `Patient/${patientId}`
    },

    specimen: [
      {
        reference: `Specimen/${specimenId}`
      }
    ]
  };

  entries.push({
    fullUrl: `urn:uuid:${request.requestId}`,
    resource: serviceRequest
  });

  if (request.result) {

    const observationId =
      `observation-${request.requestId}`;

    const observation: any = {
      resourceType: "Observation",

      id: observationId,

      status:
        request.result.status === "F"
          ? "final"
          : "final",

      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: request.test.code,
            display: request.test.display
          }
        ]
      },

      subject: {
        reference: `Patient/${patientId}`
      }
    };

    if (
      typeof request.result.value === "number"
    ) {
      observation.valueQuantity = {
        value: request.result.value,
        unit: request.result.unit,
        system: "http://unitsofmeasure.org",
        code: request.result.unit
      };
    } else if (
      request.result.value !== undefined
    ) {
      observation.valueString =
        request.result.value;
    }

    if (request.result.referenceRange) {
      observation.referenceRange = [
        {
          low: request.result.referenceRange.low !== undefined
            ? {
                value: request.result.referenceRange.low,
                unit: request.result.referenceRange.unit
              }
            : undefined,

          high: request.result.referenceRange.high !== undefined
            ? {
                value: request.result.referenceRange.high,
                unit: request.result.referenceRange.unit
              }
            : undefined
        }
      ];
    }

    if (request.result.interpretation) {
      observation.interpretation = [
        {
          text: request.result.interpretation
        }
      ];
    }

    entries.push({
      fullUrl: `urn:uuid:${observationId}`,
      resource: observation
    });

    const diagnosticReport = {
      resourceType: "DiagnosticReport",

      id: `report-${request.requestId}`,

      status: "final",

      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: request.test.code,
            display: request.test.display
          }
        ]
      },

      subject: {
        reference: `Patient/${patientId}`
      },

      result: [
        {
          reference:
            `Observation/${observationId}`
        }
      ]
    };

    entries.push({
      fullUrl:
        `urn:uuid:report-${request.requestId}`,

      resource: diagnosticReport
    });
  }

  return {
    resourceType: "Bundle",

    type: "collection",

    entry: entries
  };
}