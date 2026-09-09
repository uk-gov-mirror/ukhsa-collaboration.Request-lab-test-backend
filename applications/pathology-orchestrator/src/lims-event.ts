import type {
  RltState
} from "./rlt-state.js";


// ==================================================
// LIMS EVENT TYPES
// ==================================================

export type LimsEventType =
  | "SPECIMEN_RECEIVED"
  | "BOOKED_IN"
  | "TEST_STARTED"
  | "RESULT_RECEIVED"
  | "RESULT_SAVED"
  | "RESULT_NOTIFIED"

  // unhappy paths
  | "INVALID_SAMPLE"
  | "SAMPLE_NOT_FOUND";


// ==================================================
// LIMS EVENT
// ==================================================

export interface LimsEvent {
  eventType: LimsEventType;
  accessionNumber?: string;
  timestamp?: string;
  message?: string;
  reasonCode?: string;
  details?: string;
  payload?: unknown;
}


// ==================================================
// MAP EXTERNAL EVENT → RLT STATE
// ==================================================

export function mapLimsEventToRltState(
  eventType: LimsEventType
): RltState {

  switch (eventType) {

    case "SPECIMEN_RECEIVED":
      return "RECEIVED";

    case "BOOKED_IN":
      return "BOOKED_IN";

    case "TEST_STARTED":
      return "IN_PROGRESS";

    case "RESULT_RECEIVED":
      return "RESULT_RECEIVED";

    case "RESULT_SAVED":
      return "RESULT_SAVED";

    case "RESULT_NOTIFIED":
      return "RESULT_NOTIFIED";

    case "INVALID_SAMPLE":
      return "INVALID_SAMPLE";

    case "SAMPLE_NOT_FOUND":
      return "SAMPLE_NOT_FOUND";

  }
}

export function getProgressForState(
  state: RltState
): number {

  switch (state) {

    case "DRAFT":
      return 0;

    case "SENT":
      return 10;

    case "LABELLED":
      return 20;

    case "COLLECTED":
      return 30;

    case "RECEIVED":
      return 40;

    case "BOOKED_IN":
      return 50;

    case "IN_PROGRESS":
      return 60;

    case "RESULT_RECEIVED":
      return 70;

    case "RESULT_SAVED":
      return 78;

    case "RESULT_NOTIFIED":
      return 85;

    case "RESULT_VIEWED":
      return 90;

    case "COMPLETED":
      return 95;

    case "LIMS_UPDATED":
      return 100;

    case "INVALID_SAMPLE":
    case "SAMPLE_NOT_FOUND":
      return 100;
  }
}

export function buildLimsEventMessage(
  eventType: LimsEventType
): string {

  switch (eventType) {

    case "SPECIMEN_RECEIVED":
      return "Specimen received by laboratory";

    case "BOOKED_IN":
      return "Specimen booked into LIMS";

    case "TEST_STARTED":
      return "Laboratory testing started";

    case "RESULT_RECEIVED":
      return "Laboratory result received";

    case "RESULT_SAVED":
      return "Laboratory result saved in LIMS";

    case "RESULT_NOTIFIED":
      return "LIMS notified RLT that result is available";

    case "INVALID_SAMPLE":
      return "Laboratory reported an invalid sample";

    case "SAMPLE_NOT_FOUND":
      return "Laboratory reported sample not found";

  }
}