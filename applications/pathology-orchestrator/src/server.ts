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

import type {
  LimsEvent
} from "./lims-event.js";

import {
  buildLimsEventMessage,
  getProgressForState,
  mapLimsEventToRltState
} from "./lims-event.js";

import {
  recordRequestError
} from "./request-status.js";

import {
  addLimsEvent,
  createRequestContext,
  getRequestContext,
  updateRequestContext
} from "./request-store.js";

import {
  RltWorkflowService
} from "./workflow-service.js";

import {
  processReceivedResult
} from "./result-workflow.js";

import type {
  RltState
} from './rlt-state.js';

import {
  generateSpecimenId
} from "./specimen-id.js";

import {
  buildSpecimenBarcode
} from "./barcode.js";

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

const workflow =
  new RltWorkflowService();

interface WorkflowActionResponse {
  status: string;

  requestId: string;

  state: string;

  message: string;

  workflow: unknown;
}

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
      workflow.getStatus(
        requestId
      );

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

app.get(
  "/lab-requests/:requestId",
  async (
    request,
    reply
  ) => {

    const {
      requestId
    } =
      request.params as {
        requestId: string;
      };


    const context =
      getRequestContext(
        requestId
      );


    const status =
      workflow.getStatus(
        requestId
      );


    if (
      !context ||
      !status
    ) {

      return reply
        .code(404)
        .send({
          message:
            "Request not found"
        });

    }


    return reply.send({

      ...context,

      workflow:
        status

    });

  }
);

app.get(
  "/lab-requests/:requestId/history",
  async (
    request,
    reply
  ) => {

    const {
      requestId
    } =
      request.params as {
        requestId: string;
      };


    const status =
      workflow.getStatus(
        requestId
      );


    if (!status) {

      return reply
        .code(404)
        .send({
          message:
            "Request not found"
        });

    }


    return reply.send({
      requestId,

      currentState:
        status.state,

      history:
        workflow.getHistory(
          requestId
        )
    });
  }
);

// ==================================================
// LABEL SPECIMEN
//
// SENT → LABELLED
//
// RLT-owned action.
// Does NOT call MOLIS.
// ==================================================

app.post<{
  Params: {
    requestId: string;
  };

  Body: {
    labelId?: string;
  };
}>(
  "/lab-requests/:requestId/label",
  async (
    request,
    reply
  ) => {

    const {
      requestId
    } =
      request.params;


    try {

      // ==========================================
      // REQUEST MUST EXIST
      // ==========================================

      const context =
        getRequestContext(
          requestId
        );


      if (!context) {

        return reply
          .code(404)
          .send({

            status:
              "REQUEST_NOT_FOUND",

            message:
              `Request ${requestId} not found`

          });

      }

      const now =
        new Date().toISOString();


      updateRequestContext(
        requestId,
        {

          specimenWorkflow: {

            ...context.specimenWorkflow,

            labelId:
              request.body?.labelId,

            labelledAt:
              now

          }

        }
      );

      // ==========================================
      // TRANSITION
      //
      // SENT → LABELLED
      // ==========================================

      const status =
        workflow.transition(
          requestId,
          "LABELLED",
          20,
          request.body?.labelId
            ? `Specimen labelled: ${request.body.labelId}`
            : "Specimen labelled",
          "USER"
        );


      return reply
        .code(200)
        .send({

          status:
            "LABELLED",

          requestId,

          state:
            status.state,

          message:
            status.message,

          labelId:
            request.body?.labelId,

          workflow:
            status

        });


    } catch (error) {

      request.log.error(
        error
      );


      const message =
        error instanceof Error
          ? error.message
          : "Unable to label specimen";


      return reply
        .code(409)
        .send({

          status:
            "INVALID_WORKFLOW_TRANSITION",

          requestId,

          message,

          workflow:
            workflow.getStatus(
              requestId
            )

        });

    }

  }
);

// ==================================================
// COLLECT SPECIMEN
//
// LABELLED → COLLECTED
//
// RLT-owned action.
// Does NOT call MOLIS.
// ==================================================

app.post<{
  Params: {
    requestId: string;
  };
  Body: {
    collectedBy?: string;
    collectedAt?: string;
  };
}>(
  "/lab-requests/:requestId/collect",
  async (
    request,
    reply
  ) => {

    const {
      requestId
    } =
      request.params;


    try {

      // ==========================================
      // REQUEST MUST EXIST
      // ==========================================

      const context =
        getRequestContext(
          requestId
        );


      if (!context) {

        return reply
          .code(404)
          .send({

            status:
              "REQUEST_NOT_FOUND",

            message:
              `Request ${requestId} not found`

          });

      }

      // ==========================================
      // BUILD AUDIT MESSAGE
      // ==========================================

      const collectedBy =
        request.body?.collectedBy;


      const message =
        collectedBy
          ? `Specimen collected by ${collectedBy}`
          : "Specimen collected";
      
      const collectedAt =
        request.body?.collectedAt
        ??
        new Date().toISOString();


      updateRequestContext(
        requestId,
        {
          specimenWorkflow: {
            ...context.specimenWorkflow,
            collectedAt,
            collectedBy:
              request.body?.collectedBy
          }

        }
      );
      // ==========================================
      // TRANSITION
      //
      // LABELLED → COLLECTED
      // ==========================================

      const status =
        workflow.transition(
          requestId,
          "COLLECTED",
          30,
          message,
          "USER"
        );


      return reply
        .code(200)
        .send({

          status:
            "COLLECTED",

          requestId,

          state:
            status.state,

          collectedBy,

          collectedAt: 
            collectedAt,

          message:
            status.message,

          workflow:
            status

        });


    } catch (error) {

      request.log.error(
        error
      );


      const message =
        error instanceof Error
          ? error.message
          : "Unable to collect specimen";


      return reply
        .code(409)
        .send({

          status:
            "INVALID_WORKFLOW_TRANSITION",

          requestId,

          message,

          workflow:
            workflow.getStatus(
              requestId
            )

        });

    }

  }
);

// ==================================================
// RECEIVE EXTERNAL LIMS EVENT
//
// This endpoint represents an event/notification
// arriving FROM the external LIMS integration.
//
// RLT does NOT command MOLIS through this endpoint.
// ==================================================

app.post<{
  Params: {
    requestId: string;
  };

  Body: LimsEvent;
}>(
  "/lab-requests/:requestId/lims-events",
  async (
    request,
    reply
  ) => {

    const {
      requestId
    } =
      request.params;


    const event =
      request.body;


    try {

      // ==========================================
      // REQUEST MUST EXIST
      // ==========================================

      const context =
        getRequestContext(
          requestId
        );


      if (!context) {

        return reply
          .code(404)
          .send({

            status:
              "REQUEST_NOT_FOUND",

            message:
              `Request ${requestId} not found`

          });

      }


      // ==========================================
      // ACCESSION NUMBER CHECK
      // ==========================================

      if (
        event.accessionNumber &&
        context.accessionNumber &&
        event.accessionNumber !==
          context.accessionNumber
      ) {

        return reply
          .code(409)
          .send({

            status:
              "ACCESSION_NUMBER_MISMATCH",

            message:
              `Event accession ${event.accessionNumber} ` +
              `does not match request accession ` +
              `${context.accessionNumber}`

          });

      }      

      // ==========================================
      // STORE ORIGINAL EXTERNAL EVENT
      // ==========================================

      const storedEvent:
        LimsEvent = {
          ...event,
          timestamp:
            event.timestamp ??
            new Date().toISOString()
        };


      addLimsEvent(
        requestId,
        storedEvent
      );

      // ==========================================
      // RESULT RECEIVED
      //
      // Special case.
      //
      // When LIMS tells us the result exists,
      // RLT retrieves and processes the actual result.
      // ==========================================
      if (
        event.eventType ===
        "RESULT_RECEIVED"
      ) {
        const currentContext =
          getRequestContext(
            requestId
          );
        if (!currentContext) {
          return reply
            .code(404)
            .send({
              status:
                "REQUEST_NOT_FOUND",
              message:
                `Request ${requestId} not found`
            });
        }
      // ----------------------------------------
      // Retrieve and transform actual result
      // ----------------------------------------
      const updatedContext =
        await processReceivedResult(
          orchestrator,
          currentContext
        );

      // ----------------------------------------
      // IN_PROGRESS → RESULT_RECEIVED
      // ----------------------------------------
      const status =
        workflow.transition(
          requestId,
          "RESULT_RECEIVED",
          70,
          event.message ??
            "Laboratory result received and processed",
          "MOLIS"
        );

      return reply
        .code(200)
        .send({
          status:
            "EVENT_ACCEPTED",
          requestId,
          event:
            storedEvent,
          workflow:
            status,
          result: {
            canonicalResult:
              updatedContext.canonicalResult,
            fhirDocument:
              updatedContext.fhirDocument
          }
        });
      }

      if (
        event.eventType === "INVALID_SAMPLE" ||
        event.eventType === "SAMPLE_NOT_FOUND"
      ) {

        const failureState =
          mapLimsEventToRltState(
            event.eventType
          );

        const occurredAt =
          event.timestamp ??
          new Date().toISOString();

        const failureMessage =
          event.message ??
          buildLimsEventMessage(
            event.eventType
          );

        updateRequestContext(
          requestId,
          {
            failure: {
              type:
                failureState as
                  | "INVALID_SAMPLE"
                  | "SAMPLE_NOT_FOUND",
              reasonCode:
                event.reasonCode,
              message:
                failureMessage,
              details:
                event.details,
              occurredAt,
              source:
                "MOLIS"
            }
          }
        );
        const status =
          workflow.transition(
            requestId,
            failureState,
            100,
            failureMessage,
            "MOLIS"
          );

        return reply
          .code(200)
          .send({
            status:
              "EVENT_ACCEPTED",
            requestId,
            event:
              storedEvent,
            failure: {
              type:
                failureState,
              reasonCode:
                event.reasonCode,
              message:
                failureMessage,
              details:
                event.details,
              occurredAt
            },
            workflow:
              status
          });
      }
      // ==========================================
      // MAP EXTERNAL EVENT → RLT STATE
      // ==========================================

      const nextState =
        mapLimsEventToRltState(
          event.eventType
        );


      const progress =
        getProgressForState(
          nextState
        );
      // ==========================================
      // TRANSITION RLT WORKFLOW
      // ==========================================

      const status =
        workflow.transition(
          requestId,
          nextState,
          progress,
          event.message ??
            buildLimsEventMessage(
              event.eventType
            ),
          "MOLIS"
        );


      return reply
        .code(200)
        .send({
          status:
            "EVENT_ACCEPTED",
          requestId,
          event:
            storedEvent,
          workflow:
            status
        });
    } catch (error) {
      request.log.error(
        error
      );
      const message =
        error instanceof Error
          ? error.message
          : "Unable to process LIMS event";

      return reply
        .code(409)
        .send({
          status:
            "LIMS_EVENT_REJECTED",
          requestId,
          message,
          workflow:
            workflow.getStatus(
              requestId
            )
        });
    }
  }
);

// ==================================================
// RESULT VIEWED
//
// RESULT_NOTIFIED → RESULT_VIEWED
//
// RLT-owned user action.
// ==================================================

app.post<{
  Params: {
    requestId: string;
  };

  Body: {
    viewedBy?: string;
    viewedAt?: string;
  };
}>(
  "/lab-requests/:requestId/view-result",
  async (
    request,
    reply
  ) => {

    const {
      requestId
    } =
      request.params;


    try {

      const context =
        getRequestContext(
          requestId
        );


      if (!context) {

        return reply
          .code(404)
          .send({

            status:
              "REQUEST_NOT_FOUND",

            message:
              `Request ${requestId} not found`

          });

      }


      const viewedAt =
        request.body?.viewedAt
        ??
        new Date().toISOString();


      const viewedBy =
        request.body?.viewedBy;


      const status =
        workflow.transition(
          requestId,
          "RESULT_VIEWED",
          90,
          viewedBy
            ? `Result viewed by ${viewedBy}`
            : "Laboratory result viewed",
          "USER"
        );
      
      updateRequestContext(
        requestId,
        {
          resultWorkflow: {
            ...context.resultWorkflow,
            viewedAt,
            viewedBy
          }
        }
      );


      return reply
        .code(200)
        .send({

          status:
            "RESULT_VIEWED",

          requestId,

          viewedBy,

          viewedAt,

          workflow:
            status

        });


    } catch (error) {

      request.log.error(
        error
      );


      const message =
        error instanceof Error
          ? error.message
          : "Unable to mark result as viewed";


      return reply
        .code(409)
        .send({

          status:
            "INVALID_WORKFLOW_TRANSITION",

          requestId,

          message,

          workflow:
            workflow.getStatus(
              requestId
            )

        });

    }

  }
);

// ==================================================
// COMPLETE REQUEST
//
// RESULT_VIEWED → COMPLETED
//
// RLT-owned workflow action.
// ==================================================

app.post<{
  Params: {
    requestId: string;
  };
}>(
  "/lab-requests/:requestId/complete",
  async (
    request,
    reply
  ) => {

    const {
      requestId
    } =
      request.params;


    try {

      const context =
        getRequestContext(
          requestId
        );


      if (!context) {

        return reply
          .code(404)
          .send({

            status:
              "REQUEST_NOT_FOUND",

            message:
              `Request ${requestId} not found`

          });

      }


      const completedAt =
        new Date()
          .toISOString();


      updateRequestContext(
        requestId,
        {

          resultWorkflow: {

            ...context.resultWorkflow,

            completedAt

          }

        }
      );


      const status =
        workflow.transition(
          requestId,
          "COMPLETED",
          95,
          "Lab test request completed",
          "RLT"
        );


      return reply
        .code(200)
        .send({

          status:
            "COMPLETED",

          requestId,

          completedAt,

          workflow:
            status

        });


    } catch (error) {

      request.log.error(
        error
      );


      const message =
        error instanceof Error
          ? error.message
          : "Unable to complete request";


      return reply
        .code(409)
        .send({

          status:
            "INVALID_WORKFLOW_TRANSITION",

          requestId,

          message,

          workflow:
            workflow.getStatus(
              requestId
            )

        });

    }

  }
);

// ==================================================
// LIMS UPDATED
//
// COMPLETED → LIMS_UPDATED
//
// Represents RLT successfully sending the final
// acknowledgement/update back to the LIMS.
// ==================================================

app.post<{
  Params: {
    requestId: string;
  };

  Body: {
    message?: string;
  };
}>(
  "/lab-requests/:requestId/lims-updated",
  async (
    request,
    reply
  ) => {

    const {
      requestId
    } =
      request.params;


    try {

      const context =
        getRequestContext(
          requestId
        );


      if (!context) {

        return reply
          .code(404)
          .send({

            status:
              "REQUEST_NOT_FOUND",

            message:
              `Request ${requestId} not found`

          });

      }


      const limsUpdatedAt =
        new Date()
          .toISOString();


      updateRequestContext(
        requestId,
        {

          resultWorkflow: {

            ...context.resultWorkflow,

            limsUpdatedAt

          }

        }
      );


      const status =
        workflow.transition(
          requestId,
          "LIMS_UPDATED",
          100,
          request.body?.message
            ??
            "Final status update sent to LIMS",
          "ORCHESTRATOR"
        );


      return reply
        .code(200)
        .send({

          status:
            "LIMS_UPDATED",

          requestId,

          limsUpdatedAt,

          workflow:
            status

        });


    } catch (error) {

      request.log.error(
        error
      );


      const message =
        error instanceof Error
          ? error.message
          : "Unable to update LIMS state";


      return reply
        .code(409)
        .send({

          status:
            "INVALID_WORKFLOW_TRANSITION",

          requestId,

          message,

          workflow:
            workflow.getStatus(
              requestId
            )

        });

    }

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

    const requestId =
      request.body.requestId;


    const protocol =
      request.body.protocol ??
      "FHIR_R4";


    try {

      console.log(
        `[ORCHESTRATOR] Creating ${requestId}`
      );


      // ==========================================
      // STEP 1
      // CREATE RLT DRAFT
      // ==========================================

      if (
        workflow.getStatus(
          requestId
        )
      ) {

        return reply
          .code(409)
          .send({

            status:
              "REQUEST_ALREADY_EXISTS",

            message:
              `Request ${requestId} already exists`

          });

      }


      workflow.createDraft(
        requestId
      );


      createRequestContext(
        requestId,
        protocol
      );

      const specimenId =
        generateSpecimenId();

      const barcode =
        buildSpecimenBarcode(
          requestId,
          specimenId
        );    
      updateRequestContext(
        requestId,
        {
          specimenWorkflow: {
            specimenId,
            barcode
          }
        }
      );

      // ==========================================
      // STEP 2
      // RESOLVE TERMINOLOGY
      //
      // Technical operation only.
      // Does NOT change RLT business state.
      // ==========================================

      const terminology =
        await orchestrator
          .resolveTerminology(
            request.body
              .test
              .localCode
          );


      // ==========================================
      // STEP 3
      // BUILD CANONICAL REQUEST
      //
      // Technical operation only.
      // ==========================================

      const canonicalRequest =
        orchestrator
          .buildCanonicalRequest(
            request.body
          );


      updateRequestContext(
        requestId,
        {
          canonicalRequest
        }
      );


      // ==========================================
      // STEP 4
      // PROTOCOL-SPECIFIC TRANSPORT
      // ==========================================

      if (
        protocol ===
        "HL7_V2"
      ) {

        // ----------------------------------------
        // Canonical → HL7 v2
        // ----------------------------------------

        const hl7Response =
          await orchestrator
            .buildHl7V2Request(
              canonicalRequest,
              terminology
            );


        // ----------------------------------------
        // HL7 v2 → MOLIS
        // ----------------------------------------

        const molisResponse =
          await orchestrator
            .sendHl7V2ToMolis(
              hl7Response.message
            );


        const accessionNumber =
          molisResponse
            .accessionNumber;


        if (
          !accessionNumber
        ) {

          throw new Error(
            "MOLIS did not return an accession number"
          );

        }


        updateRequestContext(
          requestId,
          {

            accessionNumber,

            hl7Request:
              hl7Response.message

          }
        );


        // ========================================
        // DRAFT → SENT
        //
        // This is the FIRST real business
        // lifecycle transition.
        // ========================================

        workflow.transition(
          requestId,
          "SENT",
          10,
          "Lab test request sent to MOLIS",
          "ORCHESTRATOR"
        );


        return reply
          .code(201)
          .send({

            status:
              "SENT",

            protocol,

            requestId,

            specimen: {
              specimenId,
              barcode
            },

            accessionNumber,

            workflow:
              workflow.getStatus(
                requestId
              ),

            canonicalRequest,

            hl7Request:
              hl7Response.message,

            molis:
              molisResponse

          });

      }


      // ==========================================
      // FHIR R4 PATH
      // ==========================================

      if (
        protocol ===
        "FHIR_R4"
      ) {

        const fhirTerminology =
          orchestrator
            .normalizeTerminology(
              terminology
            );


        // ----------------------------------------
        // Canonical → FHIR Adapter
        //
        // Your current FHIR adapter call already
        // sends the resulting request to MOLIS.
        // ----------------------------------------

        const fhirResponse =
          await orchestrator
            .buildFhirRequest(
              canonicalRequest,
              fhirTerminology
            );


        const accessionNumber =
          fhirResponse
            ?.molis
            ?.accessionNumber;


        if (
          !accessionNumber
        ) {

          throw new Error(
            "FHIR Adapter did not return a MOLIS accession number"
          );

        }


        updateRequestContext(
          requestId,
          {

            accessionNumber,

            fhirRequest:
              fhirResponse.fhir

          }
        );


        // ========================================
        // DRAFT → SENT
        // ========================================

        workflow.transition(
          requestId,
          "SENT",
          10,
          "Lab test request sent to MOLIS",
          "ORCHESTRATOR"
        );


        return reply
          .code(201)
          .send({

            status:
              "SENT",

            protocol,

            requestId,

            specimen: {
              specimenId,
              barcode
            },

            accessionNumber,

            workflow:
              workflow.getStatus(
                requestId
              ),

            canonicalRequest,

            fhirRequest:
              fhirResponse.fhir,

            molis:
              fhirResponse.molis

          });

      }


      throw new Error(
        `Unsupported protocol: ${protocol}`
      );


    } catch (error) {

      request.log.error(
        error
      );


      const message =
        error instanceof Error
          ? error.message
          : "Unknown orchestration error";


      /*
       * Technical failures do NOT invent
       * an RLT lifecycle state.
       */

      recordRequestError(
        requestId,
        message
      );


      return reply
        .code(500)
        .send({

          status:
            "ORCHESTRATION_ERROR",

          requestId,

          message,

          workflow:
            workflow.getStatus(
              requestId
            )

        });

    }

  }
);

function getNextDemoLimsEvent(
  state: RltState
): LimsEvent | undefined {

  switch (state) {

    case "COLLECTED":
      return {
        eventType:
          "SPECIMEN_RECEIVED",

        message:
          "Specimen received by laboratory"
      };


    case "RECEIVED":
      return {
        eventType:
          "BOOKED_IN",

        message:
          "Specimen booked into LIMS"
      };


    case "BOOKED_IN":
      return {
        eventType:
          "TEST_STARTED",

        message:
          "Laboratory testing started"
      };


    case "IN_PROGRESS":
      return {
        eventType:
          "RESULT_RECEIVED",

        message:
          "Laboratory result received"
      };


    case "RESULT_RECEIVED":
      return {
        eventType:
          "RESULT_SAVED",

        message:
          "Laboratory result saved in LIMS"
      };


    case "RESULT_SAVED":
      return {
        eventType:
          "RESULT_NOTIFIED",

        message:
          "LIMS notified RLT that result is available"
      };


    default:
      return undefined;
  }
}

// ==================================================
// DEMO ONLY — ADVANCE LIMS WORKFLOW
//
// This endpoint simulates an external LIMS event.
//
// IMPORTANT:
// This is POC/demo infrastructure only.
// Production RLT must receive genuine LIMS events.
// ==================================================

app.post<{
  Params: {
    requestId: string;
  };
}>(
  "/demo/lab-requests/:requestId/advance-lims",
  async (
    request,
    reply
  ) => {

    const {
      requestId
    } =
      request.params;


    try {

      const context =
        getRequestContext(
          requestId
        );


      const status =
        workflow.getStatus(
          requestId
        );


      if (
        !context ||
        !status
      ) {

        return reply
          .code(404)
          .send({

            status:
              "REQUEST_NOT_FOUND",

            message:
              `Request ${requestId} not found`

          });

      }


      const event =
        getNextDemoLimsEvent(
          status.state
        );


      if (!event) {

        return reply
          .code(409)
          .send({

            status:
              "DEMO_TRANSITION_NOT_AVAILABLE",

            requestId,

            currentState:
              status.state,

            message:
              `No simulated LIMS event is available from ${status.state}`

          });

      }


      const demoEvent:
        LimsEvent = {

          ...event,

          accessionNumber:
            context.accessionNumber,

          timestamp:
            new Date()
              .toISOString()

        };


      // ==========================================
      // SPECIAL CASE
      //
      // Fake MOLIS must generate its fake result
      // before RLT tries to retrieve ORU/FHIR.
      //
      // This call exists ONLY in the demo harness.
      // ==========================================

      if (
        event.eventType ===
        "RESULT_RECEIVED"
      ) {

        if (
          !context.accessionNumber
        ) {

          throw new Error(
            "Cannot simulate result: accession number missing"
          );

        }


        const fakeMolisUrl =
          process.env.FAKE_MOLIS_URL
          ??
          "http://localhost:4010";


        const molisProcessResponse =
          await fetch(
            `${fakeMolisUrl}/molis/orders/${context.accessionNumber}/process`,
            {
              method:
                "POST"
            }
          );


        if (
          !molisProcessResponse.ok
        ) {

          const body =
            await molisProcessResponse
              .text();


          throw new Error(
            `Fake MOLIS processing failed: ` +
            `${molisProcessResponse.status} ${body}`
          );

        }

      }


      // ==========================================
      // STORE DEMO EVENT
      // ==========================================

      addLimsEvent(
        requestId,
        demoEvent
      );


      // ==========================================
      // RESULT_RECEIVED NEEDS REAL RESULT PIPELINE
      // ==========================================

      if (
        demoEvent.eventType ===
        "RESULT_RECEIVED"
      ) {

        const updatedContext =
          await processReceivedResult(
            orchestrator,
            context
          );


        const updatedStatus =
          workflow.transition(
            requestId,
            "RESULT_RECEIVED",
            70,
            demoEvent.message
            ??
            "Laboratory result received",
            "MOLIS"
          );


        return reply.send({

          status:
            "DEMO_EVENT_ACCEPTED",

          requestId,

          simulatedEvent:
            demoEvent,

          workflow:
            updatedStatus,

          result: {
            canonicalResult:
              updatedContext.canonicalResult,

            fhirDocument:
              updatedContext.fhirDocument
          }

        });

      }


      // ==========================================
      // NORMAL EVENT
      // ==========================================

      const nextState =
        mapLimsEventToRltState(
          demoEvent.eventType
        );


      const progress =
        getProgressForState(
          nextState
        );


      const updatedStatus =
        workflow.transition(
          requestId,
          nextState,
          progress,
          demoEvent.message
          ??
          buildLimsEventMessage(
            demoEvent.eventType
          ),
          "MOLIS"
        );


      return reply.send({

        status:
          "DEMO_EVENT_ACCEPTED",

        requestId,

        simulatedEvent:
          demoEvent,

        workflow:
          updatedStatus

      });


    } catch (error) {

      request.log.error(
        error
      );


      return reply
        .code(409)
        .send({

          status:
            "DEMO_EVENT_REJECTED",

          requestId,

          message:
            error instanceof Error
              ? error.message
              : "Unable to simulate LIMS event",

          workflow:
            workflow.getStatus(
              requestId
            )

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