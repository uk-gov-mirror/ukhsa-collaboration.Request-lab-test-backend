import type {
  RltState
} from "./rlt-state.js";

import {
  assertValidTransition
} from "./workflow-transitions.js";

// ==================================================
// WORKFLOW HISTORY ENTRY
// ==================================================

export interface WorkflowHistoryEntry {
  state: RltState;

  timestamp: string;

  message: string;

  source:
    | "RLT"
    | "USER"
    | "ORCHESTRATOR"
    | "MOLIS"
    | "FHIR_ADAPTER"
    | "HL7V2_ADAPTER"
    | "RESULT_ADAPTER";
}

export function recordRequestError(
  requestId: string,
  message: string
): RequestStatus | undefined {

  const existing =
    statuses.get(
      requestId
    );


  if (!existing) {
    return undefined;
  }


  const updated:
    RequestStatus = {

      ...existing,

      error:
        message,

      message,

      updatedAt:
        new Date()
          .toISOString()

  };


  statuses.set(
    requestId,
    updated
  );


  return updated;
}

// ==================================================
// REQUEST STATUS
// ==================================================

export interface RequestStatus {
  requestId: string;

  state: RltState;

  progress: number;

  message: string;

  updatedAt: string;

  history: WorkflowHistoryEntry[];

  error?: string;
}


// ==================================================
// IN-MEMORY STORE
//
// POC only.
// Later this can become a database / workflow store.
// ==================================================

const statuses =
  new Map<string, RequestStatus>();


// ==================================================
// CREATE DRAFT
// ==================================================

export function createDraftStatus(
  requestId: string
): RequestStatus {

  const now =
    new Date().toISOString();

  const status: RequestStatus = {
    requestId,

    state:
      "DRAFT",

    progress:
      0,

    message:
      "Lab test request created as draft",

    updatedAt:
      now,

    history: [
      {
        state:
          "DRAFT",

        timestamp:
          now,

        message:
          "Lab test request created as draft",

        source:
          "RLT"
      }
    ]
  };


  statuses.set(
    requestId,
    status
  );


  return status;
}

export function transitionRequestStatus(
  requestId: string,
  nextState: RltState,
  progress: number,
  message: string,
  source: WorkflowHistoryEntry["source"] =
    "ORCHESTRATOR"
): RequestStatus {

  const existing =
    statuses.get(
      requestId
    );


  if (!existing) {

    throw new Error(
      `Cannot transition request ${requestId}: request not found`
    );

  }


  assertValidTransition(
    existing.state,
    nextState
  );


  return updateRequestStatus(
    requestId,
    nextState,
    progress,
    message,
    source
  );
}

// ==================================================
// UPDATE STATUS
// ==================================================

export function updateRequestStatus(
  requestId: string,
  state: RltState,
  progress: number,
  message: string,
  source: WorkflowHistoryEntry["source"] =
    "ORCHESTRATOR"
): RequestStatus {

  const now =
    new Date().toISOString();


  const existing =
    statuses.get(
      requestId
    );


  const history =
    existing?.history
      ? [...existing.history]
      : [];


  history.push({
    state,
    timestamp:
      now,
    message,
    source
  });


  const updated: RequestStatus = {

    requestId,

    state,

    progress,

    message,

    updatedAt:
      now,

    history

  };


  statuses.set(
    requestId,
    updated
  );


  return updated;
}


// ==================================================
// GET STATUS
// ==================================================

export function getRequestStatus(
  requestId: string
): RequestStatus | undefined {

  return statuses.get(
    requestId
  );
}


// ==================================================
// GET HISTORY
// ==================================================

export function getRequestHistory(
  requestId: string
): WorkflowHistoryEntry[] {

  return (
    statuses.get(
      requestId
    )?.history
    ?? []
  );
}