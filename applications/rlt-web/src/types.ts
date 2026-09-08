export type IntegrationProtocol =
  | "FHIR_R4"
  | "HL7_V2";


export type RltState =
  | "SUBMITTED"
  | "TERMINOLOGY_RESOLVED"

  // FHIR request
  | "FHIR_REQUEST_CREATED"

  // HL7 v2 request
  | "HL7V2_REQUEST_CREATED"

  // Common MOLIS states
  | "SENT_TO_MOLIS"
  | "ORDER_RECEIVED"
  | "RESULT_AVAILABLE"

  // HL7 v2 result
  | "HL7V2_RESULT_RECEIVED"

  // Common result states
  | "RESULT_MAPPED"
  | "FHIR_DOCUMENT_CREATED"
  | "COMPLETED"
  | "FAILED";