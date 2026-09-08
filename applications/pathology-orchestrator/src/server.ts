import Fastify from "fastify";

import cors from "@fastify/cors";

import {
  PathologyOrchestrator
} from "./orchestrator.js";

import type {
  LabTestRequest
} from "./types.js";

import {
  config
} from "./config.js";

import {
  getRequestStatus,
  updateRequestStatus
} from "./request-status";

const app =
  Fastify({
    logger: true
  });


await app.register(
  cors,
  {
    origin: true
  }
);


const orchestrator =
  new PathologyOrchestrator();


app.get(
  "/health",
  async () => {

    return {

      status:
        "UP",

      service:
        "pathology-orchestrator"

    };

  }
);

app.get(
  "/lab-requests/:requestId/status",
  async (request, reply) => {

    const {
      requestId
    } = request.params as {
      requestId: string;
    };

    const status =
      getRequestStatus(requestId);

    if (!status) {

      return reply
        .code(404)
        .send({
          message:
            "Request not found"
        });

    }

    return reply.send(status);

  }
);

app.post<{
  Body: LabTestRequest;
}>(
  "/lab-requests",
  async (
    request,
    reply
  ) => {

    try {

      console.log(
        `[ORCHESTRATOR] Starting ` +
        `${request.body.requestId}`
      );

      const requestId =
        request.body.requestId;

      updateRequestStatus(
        requestId,
        "SUBMITTED",
        5,
        "Lab request submitted"
        );


      // ==========================================
      // STEP 1
      // Resolve terminology
      // ==========================================

      const terminology =
        await orchestrator
          .resolveTerminology(
            request.body.test.localCode
          );
      
      updateRequestStatus(
        requestId,
        "TERMINOLOGY_RESOLVED",
        15,
        "Pathology terminology resolved"
      );


      // ==========================================
      // STEP 2
      // Build canonical request
      // ==========================================

      const canonicalRequest =
        orchestrator
          .buildCanonicalRequest(
            request.body
          );


      // ==========================================
      // STEP 2A
      // Normalize terminology
      // ==========================================

      const fhirTerminology =
        orchestrator
          .normalizeTerminology(
            terminology
          );


      // ==========================================
    // STEP 2B
    // Canonical → FHIR Adapter
    // ==========================================

        const protocol =
          request.body.protocol ??
          "FHIR_R4";

        if (
          protocol !== "FHIR_R4" &&
          protocol !== "HL7_V2"
        ) {
          throw new Error(
            `Unsupported protocol: ${protocol}`
          );
        }

        if (protocol === "HL7_V2") {

      // ==========================================
      // STEP 2B-HL7
      // Canonical → HL7 v2 Adapter
      // ==========================================

      const hl7Response =
        await orchestrator
          .buildHl7V2Request(
            canonicalRequest,
            terminology
          );

      updateRequestStatus(
        requestId,
        "HL7V2_REQUEST_CREATED",
        35,
        "HL7 v2 pathology request created"
      );

      // ==========================================
      // STEP 2C-HL7
      // HL7 v2 → MOLIS
      // ==========================================
      const molisResponse =
        await orchestrator
          .sendHl7V2ToMolis(
            hl7Response.message
          );

      updateRequestStatus(
        requestId,
        "SENT_TO_MOLIS",
        50,
        "HL7 v2 pathology request sent to MOLIS"
      );

      // ==========================================
      // STEP 3A-HL7
      // MOLIS order processing
      // ==========================================

      const accessionNumber =
        molisResponse.accessionNumber;

      const molisProcessResponse =
        await orchestrator
          .processMolisOrder(
            accessionNumber
          );


      updateRequestStatus(
        requestId,
        "ORDER_RECEIVED",
        60,
        "MOLIS order received"
      );

      // ==========================================
      // STEP 4F-HL7
      // Get HL7 v2 result from MOLIS
      // ==========================================

      updateRequestStatus(
        requestId,
        "RESULT_AVAILABLE",
        75,
        "HL7 v2 pathology result received from MOLIS"
      );

      const hl7Result =
        await orchestrator
          .getHl7V2ResultFromMolis(
            accessionNumber
          );

      updateRequestStatus(
        requestId,
        "HL7V2_RESULT_RECEIVED",
        75,
        "HL7 v2 ORU^R01 result received from MOLIS"
      );


      // ==========================================
      // STEP 4F-HL7
      // HL7 v2 Result → Canonical Result
      // ==========================================

      const canonicalResult =
        await orchestrator
          .convertHl7V2ResultToCanonical(
            hl7Result
          );

      updateRequestStatus(
        requestId,
        "RESULT_MAPPED",
        90,
        "HL7 v2 result mapped to canonical result"
      );

      const fhirDocumentResponse =
        await orchestrator
          .buildFhirDocumentFromCanonicalResult(
            canonicalRequest,
            canonicalResult,
            accessionNumber
          );

      updateRequestStatus(
        requestId,
        "FHIR_DOCUMENT_CREATED",
        95,
        "FHIR pathology document created from canonical result"
      );

      updateRequestStatus(
        requestId,
        "COMPLETED",
        100,
        "Laboratory request completed"
      );

      return reply
        .code(200)
        .send({
          status: "FHIR_DOCUMENT_CREATED",
          protocol,
          requestId,
          accessionNumber,
          canonicalRequest,
          hl7Request: hl7Response.message,
          molis: molisResponse,
          molisProcess: molisProcessResponse,
          hl7Result,
          canonicalResult,
          fhirDocument:
            fhirDocumentResponse.document
        });
    }

    // ==========================================
    // STEP 2B-FHIR
    // Canonical → FHIR Adapter
    // ==========================================

    const fhirResponse =
      await orchestrator
        .buildFhirRequest(
          canonicalRequest,
          fhirTerminology
        );
    
    updateRequestStatus(
      requestId,
      "FHIR_REQUEST_CREATED",
      35,
      "FHIR pathology request created"
    );

    updateRequestStatus(
        requestId,
        "SENT_TO_MOLIS",
        50,
        "Pathology request sent to MOLIS"
    );

    // ==========================================
    // STEP 3A
    // Process MOLIS order
    // ==========================================

    const accessionNumber =
    fhirResponse
        ?.molis
        ?.accessionNumber;


    if (!accessionNumber) {

    throw new Error(
        "FHIR Adapter did not return a MOLIS accession number"
    );

    }

    const molisProcessResponse =
    await orchestrator
        .processMolisOrder(
        accessionNumber
        );
    
    updateRequestStatus(
        requestId,
        "ORDER_RECEIVED",
        60,
        "MOLIS order received"
    );


    // ==========================================
    // STEP 3B
    // Retrieve FHIR result
    // ==========================================

    const molisFhirResult =
    await orchestrator
        .getMolisFhirResult(
        accessionNumber
        );
    
    updateRequestStatus(
        requestId,
        "RESULT_AVAILABLE",
        75,
        "Laboratory result received from MOLIS"
    );
    
    
    // ==========================================
    // STEP 4
    // FHIR Result → Canonical Result
    // ==========================================

    const canonicalResultResponse =
    await orchestrator
        .convertFhirResultToCanonical(
        molisFhirResult
        );
    updateRequestStatus(
        requestId,
        "RESULT_MAPPED",
        90,
        "FHIR result mapped to canonical result"
    );
    
    // ==========================================
    // STEP 5
    // Canonical Result → FHIR Document
    // ==========================================

    const documentResponse =
    await orchestrator
        .buildFhirDocument(
        canonicalResultResponse.result
        );
    
    updateRequestStatus(
      requestId,
      "FHIR_DOCUMENT_CREATED",
      95,
      "FHIR pathology document created"
    );
    
    
    // ==========================================
    // STEP 6
    // Validate final FHIR document
    // ==========================================

    const documentValidation =
    orchestrator
        .validateFhirDocument(
        documentResponse.document
        );
    
    updateRequestStatus(
        requestId,
        "COMPLETED",
        100,
        "Laboratory request completed"
    );

    return reply
    .code(200)
    .send({

        status:
        "COMPLETED",

        requestId:
        request.body.requestId,

        accessionNumber,

        canonicalRequest,

        fhirRequest:
        fhirResponse.fhir,

        molis:
        fhirResponse.molis,

        molisProcess:
        molisProcessResponse,

        fhirResult:
        molisFhirResult,

        canonicalResult:
        canonicalResultResponse.result,

        fhirDocument:
        documentResponse.document,

        validation:
        documentValidation

    });

    } catch (error) {

      request.log.error(
        error
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error";

      updateRequestStatus(
        request.body.requestId,
        "FAILED",
        0,
        errorMessage
      );


      return reply
        .code(500)
        .send({

          status:
            "ORCHESTRATION_ERROR",

          message:
            error instanceof Error
              ? error.message
              : "Unknown error"

        });

    }

  }
);


try {

  await app.listen({

    port:
      config.port,

    host:
      "0.0.0.0"

  });


  console.log(
    `Orchestrator running on ` +
    `http://localhost:${config.port}`
  );

} catch (error) {

  app.log.error(
    error
  );

  process.exit(1);

}