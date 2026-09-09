// ==================================================
// AUTHORITATIVE RLT WORKFLOW STATES
// ==================================================

export type RltState =
  | "DRAFT"
  | "SENT"
  | "LABELLED"
  | "COLLECTED"
  | "RECEIVED"
  | "BOOKED_IN"
  | "IN_PROGRESS"
  | "RESULT_RECEIVED"
  | "RESULT_SAVED"
  | "RESULT_NOTIFIED"
  | "RESULT_VIEWED"
  | "COMPLETED"
  | "LIMS_UPDATED"

  // Unhappy paths
  | "INVALID_SAMPLE"
  | "SAMPLE_NOT_FOUND";
