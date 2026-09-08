export interface Coding {
  system: string;
  code: string;
  display?: string;
}


export interface CanonicalLabResult {

  resultId: string;

  accessionNumber: string;

  requestId?: string;

  patient: {
    nhsNumber: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  };

  laboratory: {
    organisationCode?: string;
    name?: string;
  };

  test: {
    localCode?: string;

    display: string;

    palmObservable?: Coding;

    pbcl?: Coding;
  };

  result: {

    value: number;

    unit: string;

    interpretation?: string;

    referenceRange?: {

      low?: number;

      high?: number;

      unit?: string;
    };
  };

  status:
    | "FINAL"
    | "PRELIMINARY"
    | "CANCELLED"
    | "F"
    | "C"
    | "P";

  issuedAt: string;
}