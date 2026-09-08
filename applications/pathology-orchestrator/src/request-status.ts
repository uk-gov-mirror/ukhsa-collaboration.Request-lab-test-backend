export type RltState =
  | "SUBMITTED"
  | "TERMINOLOGY_RESOLVED"

  // FHIR request path
  | "FHIR_REQUEST_CREATED"

  // HL7 request path
  | "HL7V2_REQUEST_CREATED"

  | "SENT_TO_MOLIS"
  | "ORDER_RECEIVED"
  | "RESULT_AVAILABLE"

  // HL7 result path
  | "HL7V2_RESULT_RECEIVED"

  | "RESULT_MAPPED"
  | "FHIR_DOCUMENT_CREATED"
  | "COMPLETED"
  | "FAILED";

export interface RequestStatus {

  requestId: string;

  state: RltState;

  progress: number;

  message: string;

  updatedAt: string;

  error?: string;

}

const statuses =
  new Map<string, RequestStatus>();

export function updateRequestStatus(
  requestId: string,
  state: RltState,
  progress: number,
  message: string
) {

  statuses.set(
    requestId,
    {
      requestId,
      state,
      progress,
      message,
      updatedAt:
        new Date().toISOString()
    }
  );

}

export function getRequestStatus(
  requestId: string
) {

  return statuses.get(requestId);

}