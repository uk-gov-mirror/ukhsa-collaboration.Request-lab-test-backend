export interface CanonicalPatient {
  nhsNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
}

export interface CanonicalTest {
  code: string;
  display?: string;
  system?: string;
}

export interface CanonicalSpecimen {
  type: string;
  code?: string;
  system?: string;
}

export interface CanonicalResult {
  observationId?: string;
  test?: {
    code: string;
    display?: string;
    system?: string;
  };
  value?: number | string;
  unit?: string;
  referenceRange?: {
    low?: number;
    high?: number;
    unit?: string;
  };
  interpretation?: string;
  status?: string;
  issuedAt?: string;
}

export interface CanonicalLabRequest {
  requestId: string;
  patient: CanonicalPatient;
  requester?: {
    practitionerId: string;
    name: string;
    organisationCode: string;
  };
  laboratory?: {
    organisationCode: string;
    name: string;
  };
  test: CanonicalTest;
  specimen: CanonicalSpecimen;
  clinicalInformation?: string;
  requestedAt?: string;
  result?: CanonicalResult;
}