import type {
  RltRequestContext
} from "./request-store.js";

import {
  updateRequestContext
} from "./request-store.js";

import type {
  PathologyOrchestrator
} from "./orchestrator.js";


// ==================================================
// PROCESS RESULT RECEIVED FROM LIMS
// ==================================================

export async function processReceivedResult(
  orchestrator: PathologyOrchestrator,
  context: RltRequestContext
): Promise<RltRequestContext> {

  const {
    requestId,
    accessionNumber,
    protocol,
    canonicalRequest
  } =
    context;


  if (!accessionNumber) {

    throw new Error(
      `Cannot process result for ${requestId}: ` +
      `accession number is missing`
    );

  }


  if (!canonicalRequest) {

    throw new Error(
      `Cannot process result for ${requestId}: ` +
      `canonical request is missing`
    );

  }


  // ==================================================
  // HL7 V2 RESULT PATH
  // ==================================================

  if (
    protocol ===
    "HL7_V2"
  ) {

    console.log(
      `[RESULT-WORKFLOW] Retrieving HL7 v2 result for ${requestId}`
    );


    // ----------------------------------------------
    // MOLIS → ORU^R01
    // ----------------------------------------------

    const hl7Result =
      await orchestrator
        .getHl7V2ResultFromMolis(
          accessionNumber
        );


    // ----------------------------------------------
    // ORU^R01 → Canonical Result
    // ----------------------------------------------

    const canonicalResult =
      await orchestrator
        .convertHl7V2ResultToCanonical(
          hl7Result
        );


    // ----------------------------------------------
    // Canonical Result → FHIR Pathology Document
    // ----------------------------------------------

    const documentResponse =
      await orchestrator
        .buildFhirDocumentFromCanonicalResult(
          canonicalRequest,
          canonicalResult,
          accessionNumber
        );


    // ----------------------------------------------
    // Persist result artifacts
    // ----------------------------------------------

    return updateRequestContext(
      requestId,
      {

        hl7Result,

        canonicalResult,

        fhirDocument:
          documentResponse.document

      }
    );

  }


  // ==================================================
  // FHIR R4 RESULT PATH
  // ==================================================

  if (
    protocol ===
    "FHIR_R4"
  ) {

    console.log(
      `[RESULT-WORKFLOW] Retrieving FHIR result for ${requestId}`
    );


    // ----------------------------------------------
    // MOLIS → FHIR Result Bundle
    // ----------------------------------------------

    const fhirResult =
      await orchestrator
        .getMolisFhirResult(
          accessionNumber
        );


    // ----------------------------------------------
    // FHIR Result → Canonical Result
    // ----------------------------------------------

    const canonicalResultResponse =
      await orchestrator
        .convertFhirResultToCanonical(
          fhirResult
        );


    const canonicalResult =
      canonicalResultResponse.result;


    if (!canonicalResult) {

      throw new Error(
        `Result Adapter did not return a canonical result ` +
        `for ${requestId}`
      );

    }


    // ----------------------------------------------
    // Canonical Result → FHIR Document
    // ----------------------------------------------

    const documentResponse =
      await orchestrator
        .buildFhirDocument(
          canonicalResult
        );


    // ----------------------------------------------
    // Persist result artifacts
    // ----------------------------------------------

    return updateRequestContext(
      requestId,
      {

        fhirResult,

        canonicalResult,

        fhirDocument:
          documentResponse.document

      }
    );

  }


  throw new Error(
    `Unsupported protocol: ${protocol}`
  );
}