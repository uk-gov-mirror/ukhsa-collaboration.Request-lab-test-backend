import {
  config
} from "./config.js";

import {
  getJson,
  postJson,
  postText
} from "./http.js";

import type {
  LabTestRequest
} from "./types.js";


export class PathologyOrchestrator {


  // ================================================
  // STEP 1
  // Terminology
  // ================================================

  async resolveTerminology(
    localCode: string
  ) {

    console.log(
      "[1] Resolving terminology..."
    );


    const response =
      await getJson<any>(

        `${config.terminologyUrl}` +
        `/terminology/tests/` +
        encodeURIComponent(
          localCode
        )

      );


    if (
      response.status !==
      "FOUND"
    ) {

      throw new Error(
        `Terminology not found for ${localCode}`
      );

    }


    console.log(
      "[1] Terminology resolved"
    );


    return response;

  }


  // ================================================
  // STEP 2
  // Canonical request
  // ================================================

  buildCanonicalRequest(
    request: LabTestRequest
  ) {

    console.log(
      "[2] Building canonical request..."
    );


    return {

      requestId:
        request.requestId,

      patient:
        request.patient,

      requester:
        request.requester,

      laboratory:
        request.laboratory,

      test:
        request.test,

      specimen:
        request.specimen,

      clinicalInformation:
        request.clinicalInformation,

      requestedAt:
        request.requestedAt

    };

  }


  // ================================================
  // STEP 2A
  // Terminology normalization
  // ================================================

  normalizeTerminology(
    terminology: any
  ) {

    console.log(
      "[2A] Normalizing terminology for FHIR Adapter..."
    );


    const test =
      terminology.test;


    if (!test) {

      throw new Error(
        "Terminology response does not contain test"
      );

    }


    const palmRequestable =
      test.request?.palmProcedure;


    if (!palmRequestable) {

      throw new Error(
        "PaLM procedure terminology is missing"
      );

    }


    const normalized = {

      status:
        terminology.status,

      test: {

        localCode:
          test.localCode,

        display:
          test.display,

        specimenType:
          "Venous blood specimen",

        palmRequestable,

        palmReportable:
          test.result?.palmObservable,

        pbcl:
          test.result?.pbcl,

        molis:
          test.molis

      }

    };


    console.log(
      "[2A] Terminology normalized"
    );


    return normalized;

  }


  // ================================================
  // STEP 2B
  // Canonical + terminology → FHIR Adapter
  // ================================================

  async buildFhirRequest(
    canonicalRequest: any,
    terminology: any
  ) {

    console.log(
      "[2B] Sending request to FHIR Adapter..."
    );


    const response =
      await postJson<any>(

        `${config.fhirAdapterUrl}` +
        `/fhir/requests`,

        {

          request:
            canonicalRequest,

          terminology:
            terminology

        }

      );


    if (
      response.status !==
      "CREATED"
    ) {

      throw new Error(
        `FHIR Adapter returned unexpected status: ` +
        `${response.status}`
      );

    }


    console.log(
      "[2B] FHIR request created"
    );

    return response;
  }

  // ================================================
// STEP 3A
// Process MOLIS order
// ================================================

async processMolisOrder(
    accessionNumber: string
    ) {

    console.log(
        `[3A] Processing MOLIS order ${accessionNumber}...`
    );


    const response =
        await postJson<any>(

        `${config.molisUrl}` +
        `/molis/orders/` +
        encodeURIComponent(
            accessionNumber
        ) +
        `/process`,

        {}

        );

        console.log(
            `[3A] MOLIS order processed`
        );

        return response;
    }

// ================================================
// STEP 3B
// Retrieve FHIR result from MOLIS
// ================================================

    async getMolisFhirResult(
    accessionNumber: string
    ) {

    console.log(
        `[3B] Retrieving FHIR result from MOLIS ` +
        `${accessionNumber}...`
    );


    const response =
        await getJson<any>(

        `${config.molisUrl}` +
        `/molis/orders/` +
        encodeURIComponent(
            accessionNumber
        ) +
        `/fhir`

        );


    console.log(
        `[3B] FHIR result received from MOLIS`
    );


    return response;

    }

// ================================================
// STEP 4
// FHIR Result → Canonical Result
// ================================================

    async convertFhirResultToCanonical(
    fhirResult: any
    ) {

    console.log(
        "[4] Sending FHIR result to Result Adapter..."
    );


    if (!fhirResult) {

        throw new Error(
        "FHIR result is missing"
        );

    }


    const response =
        await postJson<any>(

            `${config.resultAdapterUrl}` +
            `/results/from-fhir`,

            fhirResult

        );


    if (
        response.status !==
        "CONVERTED"
    ) {

        throw new Error(
        `Result Adapter returned unexpected status: ` +
        `${response.status}`
        );

    }


    console.log(
        "[4] FHIR result converted to canonical result"
    );


    return response;

    }

// ================================================
// STEP 5
// Canonical Result → FHIR Document
// ================================================

    async buildFhirDocument(
    canonicalResult: any
    ) {

    console.log(
        "[5] Sending canonical result to Result Adapter..."
    );


    if (!canonicalResult) {

        throw new Error(
        "Canonical result is missing"
        );

    }


    const response =
        await postJson<any>(
            `${config.resultAdapterUrl}` +
            `/results/to-document`,
            canonicalResult
        );


    if (
        response.status !==
        "DOCUMENT_CREATED"
    ) {

        throw new Error(
        `Result Adapter returned unexpected status: ` +
        `${response.status}`
        );

    }


    console.log(
        "[5] FHIR document created"
    );


    return response;

    }

// ================================================
// STEP 6
// Validate final FHIR Document
// ================================================

    validateFhirDocument(
    document: any
    ) {

    console.log(
        "[6] Validating FHIR document..."
    );

    if (!document) {
        throw new Error(
        "FHIR document is missing"
        );
    }

    if (
        document.resourceType !==
        "Bundle"
    ) {
        throw new Error(
        "Final resource is not a FHIR Bundle"
        );
    }

    if (
        document.type !==
        "document"
    ) {
        throw new Error(
        "FHIR Bundle is not a document Bundle"
        );
    }

    if (
        !Array.isArray(
        document.entry
        )
    ) {
        throw new Error(
        "FHIR document Bundle has no entries"
        );
    }

    const resources =
        document.entry
        .map(
            (entry: any) =>
            entry.resource
        )
        .filter(Boolean);

    const hasComposition =
        resources.some(
        (resource: any) =>
            resource.resourceType ===
            "Composition"
        );

    const hasPatient =
        resources.some(
        (resource: any) =>
            resource.resourceType ===
            "Patient"
        );

    const hasDiagnosticReport =
        resources.some(
        (resource: any) =>
            resource.resourceType ===
            "DiagnosticReport"
        );

    const hasObservation =
        resources.some(
        (resource: any) =>
            resource.resourceType ===
            "Observation"
        );

    if (!hasComposition) {
        throw new Error(
        "FHIR document is missing Composition"
        );
    }

    if (!hasPatient) {
        throw new Error(
        "FHIR document is missing Patient"
        );
    }

    if (!hasDiagnosticReport) {
        throw new Error(
        "FHIR document is missing DiagnosticReport"
        );
    }

    if (!hasObservation) {
        throw new Error(
        "FHIR document is missing Observation"
        );
    }

    console.log(
        "[6] FHIR document validated"
    );

    return {
        valid: true,
        resourceCount:
        resources.length
    };
    }


  async buildHl7V2Request(
    canonicalRequest: any,
    terminology: any
  ) {
    console.log(
      "[2B-HL7] Sending request to HL7 v2 Adapter..."
    );

    const palmRequestable =
      terminology?.test?.request?.palmProcedure;

    if (!palmRequestable?.code) {
      throw new Error(
        "PaLM procedure terminology code is required for HL7 v2 request"
      );
    }

    const hl7Request = {
      ...canonicalRequest,

      test: {
        code: palmRequestable.code,
        display:
          palmRequestable.display ??
          canonicalRequest.test.display,
        system:
          palmRequestable.system
      },

      specimen: {
        ...canonicalRequest.specimen,

        // The HL7 adapter supports specimen.code.
        // Preserve the local specimen information if no
        // standard code has been resolved yet.
        code:
          canonicalRequest.specimen.code,
        system:
          canonicalRequest.specimen.system
      }
    };

    const response =
      await postJson<any>(
        `${config.hl7v2AdapterUrl}/hl7v2/from-canonical`,
        {
          request: hl7Request
        }
      );

    if (response.status !== "SUCCESS") {
      throw new Error(
        `HL7 v2 Adapter returned unexpected status: ` +
        `${response.status}`
      );
    }

    console.log(
      "[2B-HL7] HL7 v2 request created"
    );

    return response;
  }

// ================================================
// STEP 2C
// HL7 v2 → Fake MOLIS
// ================================================
  async sendHl7V2ToMolis(
    hl7Message: string
  ) {

    console.log(
      "[2C-HL7] Sending HL7 v2 request to MOLIS..."
    );

    if (!hl7Message) {

      throw new Error(
        "HL7 v2 message is missing"
      );

    }

    const response =
      await postText<any>(
        `${config.molisUrl}` +
        `/molis/orders/hl7v2`,
        hl7Message
      );

    if (
      response.status !==
      "ORDER_RECEIVED"
    ) {

      throw new Error(
        `MOLIS returned unexpected HL7 v2 status: ` +
        `${response.status}`
      );

    }

    if (
      !response.accessionNumber
    ) {

      throw new Error(
        "MOLIS did not return an accession number"
      );

    }

    console.log(
      `[2C-HL7] MOLIS order received: ` +
      `${response.accessionNumber}`
    );

    return response;
  }
}