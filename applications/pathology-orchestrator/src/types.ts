export type Protocol =
  | "FHIR_R4"
  | "HL7_V2";


export interface LabTestRequest {

  requestId: string;

  protocol?: Protocol;

  patient: {

    nhsNumber: string;

    firstName: string;

    lastName: string;

    dateOfBirth: string;

    gender?:
      | "male"
      | "female"
      | "other"
      | "unknown";
  };

  requester: {

    practitionerId: string;

    name: string;

    organisationCode: string;
  };

  laboratory: {

    organisationCode: string;

    name: string;
  };

  test: {

    localCode: string;

    display: string;
  };

  specimen: {

    type: string;

    collectedAt?: string;
  };

  clinicalInformation?: string;

  requestedAt: string;
}

export interface OrchestrationResponse {

  status: string;

  requestId: string;

  accessionNumber?: string;

  canonicalRequest?: unknown;

  terminology?: unknown;

  fhirRequest?: unknown;

  molisResponse?: unknown;

  molisResult?: unknown;

  canonicalResult?: unknown;

  fhirDocument?: unknown;
}