import type {
  RltState
} from "./rlt-state.js";

import type {
  RequestStatus,
  WorkflowHistoryEntry
} from "./request-status.js";

import {
  createDraftStatus,
  getRequestHistory,
  getRequestStatus,
  transitionRequestStatus
} from "./request-status.js";


// ==================================================
// WORKFLOW SOURCE
// ==================================================

export type WorkflowSource =
  WorkflowHistoryEntry["source"];


// ==================================================
// RLT WORKFLOW SERVICE
// ==================================================

export class RltWorkflowService {

  // ------------------------------------------------
  // CREATE DRAFT
  // ------------------------------------------------

  createDraft(
    requestId: string
  ): RequestStatus {

    return createDraftStatus(
      requestId
    );
  }


  // ------------------------------------------------
  // TRANSITION
  // ------------------------------------------------

  transition(
    requestId: string,
    nextState: RltState,
    progress: number,
    message: string,
    source: WorkflowSource =
      "ORCHESTRATOR"
  ): RequestStatus {

    return transitionRequestStatus(
      requestId,
      nextState,
      progress,
      message,
      source
    );
  }


  // ------------------------------------------------
  // GET STATUS
  // ------------------------------------------------

  getStatus(
    requestId: string
  ): RequestStatus | undefined {

    return getRequestStatus(
      requestId
    );
  }


  // ------------------------------------------------
  // GET HISTORY
  // ------------------------------------------------

  getHistory(
    requestId: string
  ): WorkflowHistoryEntry[] {

    return getRequestHistory(
      requestId
    );
  }


  // ------------------------------------------------
  // CHECK CURRENT STATE
  // ------------------------------------------------

  isInState(
    requestId: string,
    state: RltState
  ): boolean {

    return (
      getRequestStatus(
        requestId
      )?.state === state
    );
  }
}