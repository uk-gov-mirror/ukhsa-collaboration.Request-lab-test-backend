import type {
  RltState
} from "./rlt-state.js";

// ==================================================
// VALID RLT STATE TRANSITIONS
// ==================================================

const validTransitions:
  Record<RltState, RltState[]> = {

    // ------------------------------------------------
    // Happy path
    // ------------------------------------------------

    DRAFT: [
      "SENT"
    ],


    SENT: [
      "LABELLED",
      "SAMPLE_NOT_FOUND"
    ],


    LABELLED: [
      "COLLECTED",
      "INVALID_SAMPLE",
      "SAMPLE_NOT_FOUND"
    ],


    COLLECTED: [
      "RECEIVED",
      "INVALID_SAMPLE",
      "SAMPLE_NOT_FOUND"
    ],


    RECEIVED: [
      "BOOKED_IN",
      "INVALID_SAMPLE",
      "SAMPLE_NOT_FOUND"
    ],


    BOOKED_IN: [
      "IN_PROGRESS",
      "INVALID_SAMPLE"
    ],


    IN_PROGRESS: [
      "RESULT_RECEIVED"
    ],


    RESULT_RECEIVED: [
      "RESULT_SAVED"
    ],


    RESULT_SAVED: [
      "RESULT_NOTIFIED"
    ],


    RESULT_NOTIFIED: [
      "RESULT_VIEWED"
    ],


    RESULT_VIEWED: [
      "COMPLETED"
    ],


    COMPLETED: [
      "LIMS_UPDATED"
    ],


    LIMS_UPDATED: [],


    // ------------------------------------------------
    // Unhappy path terminal states
    // ------------------------------------------------

    INVALID_SAMPLE: [],

    SAMPLE_NOT_FOUND: []
  };


// ==================================================
// CHECK TRANSITION
// ==================================================

export function canTransition(
  from: RltState,
  to: RltState
): boolean {

  return validTransitions[
    from
  ].includes(
    to
  );
}


// ==================================================
// ASSERT TRANSITION
// ==================================================

export function assertValidTransition(
  from: RltState,
  to: RltState
): void {

  if (
    canTransition(
      from,
      to
    )
  ) {
    return;
  }


  throw new Error(
    `Invalid RLT workflow transition: ${from} → ${to}`
  );
}


// ==================================================
// GET ALLOWED NEXT STATES
// ==================================================

export function getAllowedTransitions(
  state: RltState
): RltState[] {

  return [
    ...validTransitions[
      state
    ]
  ];
}