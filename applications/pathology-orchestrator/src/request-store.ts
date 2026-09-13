import type {
  LimsEvent
} from "./lims-event.js";

export type IntegrationProtocol =
  | "FHIR_R4"
  | "HL7_V2";


export interface RltRequestContext {
  requestId: string;
  protocol: IntegrationProtocol;
  accessionNumber?: string;
  canonicalRequest?: unknown;
  fhirRequest?: unknown;
  hl7Request?: string;
  specimenWorkflow?: {
    labelId?: string;
    specimenId?: string;
    barcode?: {
      symbology: "GS1-128";
      payload: string;
      humanReadable: string;
    };
    labelledAt?: string;
    collectedAt?: string;
    collectedBy?: string;
  };
  limsEvents?: LimsEvent[];
  fhirResult?: unknown;
  hl7Result?: string;
  canonicalResult?: unknown;
  fhirDocument?: unknown;
  resultWorkflow?: {
    viewedAt?: string;
    viewedBy?: string;
    completedAt?: string;
    limsUpdatedAt?: string;
    };
  failure?: {
    type:
      | "INVALID_SAMPLE"
      | "SAMPLE_NOT_FOUND";
    reasonCode?: string;
    message: string;
    details?: string;
    occurredAt: string;
    source:
      | "MOLIS"
      | "ORCHESTRATOR"
      | "USER";
  };
  createdAt: string;
  updatedAt: string;
}


const requests =
  new Map<
    string,
    RltRequestContext
  >();


export function addLimsEvent(
  requestId: string,
  event: LimsEvent
): RltRequestContext {

  const existing =
    requests.get(
      requestId
    );


  if (!existing) {

    throw new Error(
      `RLT request ${requestId} not found`
    );

  }


  const updated:
    RltRequestContext = {

      ...existing,

      limsEvents: [
        ...(existing.limsEvents ?? []),
        event
      ],

      updatedAt:
        new Date().toISOString()

  };


  requests.set(
    requestId,
    updated
  );


  return updated;
}

// ==================================================
// CREATE
// ==================================================

export function createRequestContext(
  requestId: string,
  protocol: IntegrationProtocol
): RltRequestContext {

  const now =
    new Date().toISOString();


  const context:
    RltRequestContext = {

      requestId,

      protocol,

      createdAt:
        now,

      updatedAt:
        now
    };


  requests.set(
    requestId,
    context
  );


  return context;
}


// ==================================================
// UPDATE
// ==================================================

export function updateRequestContext(
  requestId: string,
  update:
    Partial<
      Omit<
        RltRequestContext,
        "requestId" |
        "createdAt"
      >
    >
): RltRequestContext {

  const existing =
    requests.get(
      requestId
    );


  if (!existing) {

    throw new Error(
      `RLT request ${requestId} not found`
    );

  }


  const updated:
    RltRequestContext = {

      ...existing,

      ...update,

      requestId,

      createdAt:
        existing.createdAt,

      updatedAt:
        new Date()
          .toISOString()

    };


  requests.set(
    requestId,
    updated
  );


  return updated;
}


// ==================================================
// GET
// ==================================================

export function getRequestContext(
  requestId: string
):
  | RltRequestContext
  | undefined {

  return requests.get(
    requestId
  );
}