import {
  useEffect,
  useState
} from "react";

import type {
  SyntheticEvent
} from "react";

import "./App.css";

import RequestProgress
  from "./components/RequestProgress";

import type {
  IntegrationProtocol,
  RltState,
} from "./types";


// ==================================================
// CONFIG
// ==================================================

const ORCHESTRATOR_URL =
  import.meta.env.VITE_ORCHESTRATOR_URL ??
  "http://localhost:4005";


// ==================================================
// TYPES
// ==================================================

interface LabRequest {

  requestId: string;

  protocol?: IntegrationProtocol;


  patient: {

    nhsNumber: string;

    firstName: string;

    lastName: string;

    dateOfBirth: string;

    gender: string;

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

  };


  clinicalInformation: string;

  requestedAt: string;

}


// ==================================================
// WORKFLOW HISTORY
// ==================================================

interface WorkflowHistoryEntry {

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


// ==================================================
// REQUEST STATUS
// ==================================================

interface RequestStatus {

  requestId: string;

  state: RltState;

  progress: number;

  message: string;

  updatedAt: string;

  history?: WorkflowHistoryEntry[];

  error?: string;

}


// ==================================================
// ORCHESTRATION RESPONSE
// ==================================================

interface OrchestrationResponse {
  status: string;
  protocol?: IntegrationProtocol;
  requestId: string;
  accessionNumber?: string;
  workflow?: RequestStatus;
  // ------------------------------------------------
  // Request transformations
  // ------------------------------------------------
  canonicalRequest?: unknown;
  fhirRequest?: unknown;
  hl7Request?: string;
  // ------------------------------------------------
  // MOLIS
  // ------------------------------------------------
  molis?: unknown;
  molisProcess?: unknown;
  // ------------------------------------------------
  // Result transformations
  // ------------------------------------------------
  fhirResult?: unknown;
  hl7Result?: string;
  canonicalResult?: {
    test?: {
      code?: string;
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
  };
  fhirDocument?: any;
  validation?: {
    valid: boolean;
    resourceCount?: number;
  };
  failure?: {
    type:
      | "INVALID_SAMPLE"
      | "SAMPLE_NOT_FOUND";
    reasonCode?: string;
    message: string;
    details?: string;
    occurredAt: string;
    source?:
      | "MOLIS"
      | "ORCHESTRATOR"
      | "USER";
  };
}


// ==================================================
// FORM
// ==================================================

interface FormState {

  nhsNumber: string;

  firstName: string;

  lastName: string;

  dateOfBirth: string;

  gender: string;

  test: string;

  specimen: string;

  clinicalInformation: string;

}


// ==================================================
// INITIAL DATA
// ==================================================

const INITIAL_FORM: FormState = {

  nhsNumber:
    "9999999999",

  firstName:
    "John",

  lastName:
    "Smith",

  dateOfBirth:
    "1975-03-12",

  gender:
    "male",

  test:
    "HBA1C",

  specimen:
    "Venous blood specimen",

  clinicalInformation:
    "Routine diabetes monitoring",

};


// ==================================================
// LIMS POLLING STATES
//
// Poll only while RLT is waiting for external
// laboratory / LIMS events.
// ==================================================

const LIMS_POLLING_STATES:
  RltState[] = [

    "COLLECTED",

    "RECEIVED",

    "BOOKED_IN",

    "IN_PROGRESS",

    "RESULT_RECEIVED",

    "RESULT_SAVED",

  ];


// ==================================================
// HELPERS
// ==================================================

function createRequestId(): string {

  return `RLT-${Date.now()}`;

}


function findResource(
  bundle: any,
  resourceType: string
): any | undefined {

  if (
    !bundle?.entry ||
    !Array.isArray(
      bundle.entry
    )
  ) {

    return undefined;

  }


  return bundle.entry
    .map(
      (entry: any) =>
        entry?.resource
    )
    .find(
      (resource: any) =>
        resource?.resourceType ===
        resourceType
    );

}


// ==================================================
// RESULT VISIBILITY
//
// Do not show the result card merely because the
// backend has entered RESULT_RECEIVED.
//
// The actual result-data integration is added in
// the next step.
//
// For now result UI begins at RESULT_NOTIFIED.
// ==================================================

function hasResultState(
  state?: RltState
): boolean {

  if (!state) {
    return false;
  }


  return [
    "RESULT_RECEIVED",
    "RESULT_SAVED",
    "RESULT_NOTIFIED",
    "RESULT_VIEWED",
    "COMPLETED",
    "LIMS_UPDATED",
  ].includes(
    state
  );
}

function getNextDemoStateLabel(
  state: RltState
): string | undefined {

  switch (state) {

    case "COLLECTED":
      return "Simulate specimen received";

    case "RECEIVED":
      return "Simulate specimen booked in";

    case "BOOKED_IN":
      return "Simulate testing started";

    case "IN_PROGRESS":
      return "Simulate result received";

    case "RESULT_RECEIVED":
      return "Simulate result saved";

    case "RESULT_SAVED":
      return "Simulate result notification";

    default:
      return undefined;
  }
}


// ==================================================
// APP
// ==================================================

function App() {

  // ==================================================
  // FORM
  // ==================================================

  const [
    form,
    setForm
  ] =
    useState<FormState>(
      INITIAL_FORM
    );


  // ==================================================
  // PROTOCOL
  // ==================================================

  const [
    protocol,
    setProtocol
  ] =
    useState<IntegrationProtocol>(
      "HL7_V2"
    );


  // ==================================================
  // REQUEST
  // ==================================================

  const [
    requestId,
    setRequestId
  ] =
    useState<string | null>(
      null
    );


  const [
    requestStatus,
    setRequestStatus
  ] =
    useState<RequestStatus | null>(
      null
    );


  const [
    result,
    setResult
  ] =
    useState<OrchestrationResponse | null>(
      null
    );


  // ==================================================
  // UI STATE
  // ==================================================

  const [
    error,
    setError
  ] =
    useState<string | null>(
      null
    );


  const [
    submitting,
    setSubmitting
  ] =
    useState(
      false
    );


  const [
    actionLoading,
    setActionLoading
  ] =
    useState(
      false
    );


  const [
    showTechnicalDetails,
    setShowTechnicalDetails
  ] =
    useState(
      false
    );
  
  const nextDemoAction =
  requestStatus
    ? getNextDemoStateLabel(
        requestStatus.state
      )
    : undefined;


  // ==================================================
  // FORM UPDATE
  // ==================================================

  function updateField(
    field: keyof FormState,
    value: string
  ) {

    setForm(
      previous => ({
        ...previous,

        [field]:
          value
      })
    );

  }


  // ==================================================
  // GET REQUEST STATUS
  // ==================================================

  async function getRequestStatus(
    id: string
  ): Promise<RequestStatus> {

    const response =
      await fetch(
        `${ORCHESTRATOR_URL}/lab-requests/${id}/status`
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data?.message ??
        "Unable to retrieve request status"
      );

    }


    return data;

  }

  async function getRequestContext(
    id: string
  ): Promise<OrchestrationResponse> {

    const response =
      await fetch(
        `${ORCHESTRATOR_URL}/lab-requests/${id}`
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data?.message ??
        "Unable to retrieve request details"
      );

    }


    return data;
  }


  // ==================================================
  // REFRESH REQUEST STATUS
  // ==================================================

  async function refreshRequestStatus(
    id: string
  ): Promise<RequestStatus> {

    const status =
      await getRequestStatus(
        id
      );


    setRequestStatus(
      status
    );


    return status;

  }

  async function viewResult() {
    if (!requestId) {
      return;
    }

    setError(null);
    setActionLoading(true);

    try {
      const response =
        await fetch(
          `${ORCHESTRATOR_URL}/lab-requests/${requestId}/view-result`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                viewedBy:
                  "Dr John Smith",

                viewedAt:
                  new Date()
                    .toISOString(),
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ??
          "Unable to mark result as viewed"
        );
      }

      await refreshRequestStatus(
        requestId
      );

      const context =
        await getRequestContext(
          requestId
        );

      setResult(
        context
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to mark result as viewed"
      );
    } finally {
      setActionLoading(
        false
      );
    }
  }

  async function completeRequest() {
    if (!requestId) {
      return;
    }

    setError(null);
    setActionLoading(true);

    try {
      const response =
        await fetch(
          `${ORCHESTRATOR_URL}/lab-requests/${requestId}/complete`,
          {
            method: "POST",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ??
          "Unable to complete request"
        );
      }

      await refreshRequestStatus(
        requestId
      );

      const context =
        await getRequestContext(
          requestId
        );

      setResult(
        context
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete request"
      );
    } finally {
      setActionLoading(
        false
      );
    }
  }

  async function markLimsUpdated() {
    if (!requestId) {
      return;
    }

    setError(null);
    setActionLoading(true);

    try {
      const response =
        await fetch(
          `${ORCHESTRATOR_URL}/lab-requests/${requestId}/lims-updated`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                message:
                  "Result-consumed acknowledgement sent to LIMS",
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ??
          "Unable to update LIMS"
        );
      }

      await refreshRequestStatus(
        requestId
      );

      const context =
        await getRequestContext(
          requestId
        );

      setResult(
        context
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update LIMS"
      );
    } finally {
      setActionLoading(
        false
      );
    }
  }


  // ==================================================
  // AUTOMATIC LIMS STATUS POLLING
  //
  // Starts automatically at COLLECTED.
  //
  // Continues through:
  //
  // RECEIVED
  // BOOKED_IN
  // IN_PROGRESS
  // RESULT_RECEIVED
  // RESULT_SAVED
  //
  // Stops when:
  //
  // RESULT_NOTIFIED
  // INVALID_SAMPLE
  // SAMPLE_NOT_FOUND
  // ==================================================

  useEffect(
    () => {

      if (
        !requestId ||
        !requestStatus
      ) {

        return;

      }


      const shouldPoll =
        LIMS_POLLING_STATES.includes(
          requestStatus.state
        );


      if (!shouldPoll) {

        return;

      }


      let cancelled =
        false;


      // ==============================================
      // POLL FUNCTION
      // ==============================================

      const poll =
        async () => {
          try {
            const response =
              await fetch(
                `${ORCHESTRATOR_URL}/lab-requests/${requestId}/status`
              );
            if (!response.ok) {
              return;
            }
            const status:
              RequestStatus =
              await response.json();
            // ========================================
            // UPDATE ONLY WHEN SOMETHING CHANGED
            // ========================================
            setRequestStatus(
              previous => {
                if (
                  previous?.state ===
                    status.state &&
                  previous?.updatedAt ===
                    status.updatedAt
                ) {
                  return previous;
                }
                return status;
              }
            );

            if (
              status.state === "INVALID_SAMPLE" ||
              status.state === "SAMPLE_NOT_FOUND"
            ) {
              try {
                const context =
                  await getRequestContext(
                    requestId
                  );
                if (!cancelled) {
                  setResult(
                    context
                  );
                }
              } catch (err) {
                console.error(
                  "Unable to retrieve failure context",
                  err
                );
              }
            }

            if (
              status.state ===
                "RESULT_RECEIVED" ||
              status.state ===
                "RESULT_SAVED" ||
              status.state ===
                "RESULT_NOTIFIED"
            ) {
              try {
                const context =
                  await getRequestContext(
                    requestId
                  );
                if (!cancelled) {
                  setResult(
                    context
                  );
                }
              } catch (err) {
                console.error(
                  "Unable to refresh result context",
                  err
                );
              }
            }

            if (
              cancelled
            ) {
              return;
            }
          } catch (err) {
            /*
             * Temporary polling failures should not
             * fail the RLT business workflow.
             *
             * The next poll can retry.
             */
            console.error(
              "Unable to poll request status",
              err
            );
          }
        };


      // ==============================================
      // POLL IMMEDIATELY
      // ==============================================

      void poll();


      // ==============================================
      // THEN EVERY SECOND
      // ==============================================

      const intervalId =
        window.setInterval(
          () => {

            void poll();

          },
          1000
        );


      // ==============================================
      // CLEANUP
      // ==============================================

      return () => {

        cancelled =
          true;


        window.clearInterval(
          intervalId
        );

      };

    },
    [
      requestId,
      requestStatus?.state
    ]
  );


  // ==================================================
  // SUBMIT REQUEST
  //
  // DRAFT → SENT
  // ==================================================

  async function submitRequest(
    event:
      SyntheticEvent<HTMLFormElement>
  ) {

    event.preventDefault();


    // ================================================
    // RESET PREVIOUS UI
    // ================================================

    setError(
      null
    );

    setResult(
      null
    );

    setRequestStatus(
      null
    );

    setShowTechnicalDetails(
      false
    );


    // ================================================
    // CREATE REQUEST ID
    // ================================================

    const id =
      createRequestId();


    setRequestId(
      id
    );


    setSubmitting(
      true
    );


    // ================================================
    // BUILD RLT REQUEST
    // ================================================

    const labRequest:
      LabRequest = {

        requestId:
          id,

        protocol,


        patient: {

          nhsNumber:
            form.nhsNumber,

          firstName:
            form.firstName,

          lastName:
            form.lastName,

          dateOfBirth:
            form.dateOfBirth,

          gender:
            form.gender,

        },


        requester: {

          practitionerId:
            "GMC-1234567",

          name:
            "Dr John Smith",

          organisationCode:
            "RLT001",

        },


        laboratory: {

          organisationCode:
            "LAB001",

          name:
            "Fake MOLIS Pathology Laboratory",

        },


        test: {

          localCode:
            form.test,

          display:
            "Haemoglobin A1c",

        },


        specimen: {

          type:
            form.specimen,

        },


        clinicalInformation:
          form.clinicalInformation,


        requestedAt:
          new Date()
            .toISOString(),

      };


    // ================================================
    // LOCAL DRAFT STATE
    // ================================================

    setRequestStatus({

      requestId:
        id,

      state:
        "DRAFT",

      progress:
        0,

      message:
        "Lab test request created as draft",

      updatedAt:
        new Date()
          .toISOString(),

      history:
        []

    });


    try {

      // ==============================================
      // SEND REQUEST
      //
      // Backend authoritative transition:
      //
      // DRAFT → SENT
      // ==============================================

      const response =
        await fetch(
          `${ORCHESTRATOR_URL}/lab-requests`,
          {

            method:
              "POST",


            headers: {

              "Content-Type":
                "application/json",

            },


            body:
              JSON.stringify(
                labRequest
              ),

          }
        );


      const data:
        OrchestrationResponse &
        {
          message?: string;
        } =
        await response.json();


      if (
        !response.ok
      ) {

        throw new Error(
          data?.message ??
          "Laboratory request failed"
        );

      }


      // ==============================================
      // STORE SUBMISSION CONTEXT
      // ==============================================

      setResult(
        data
      );


      // ==============================================
      // GET AUTHORITATIVE STATE
      // ==============================================

      await refreshRequestStatus(
        id
      );


    } catch (err) {

      const message =
        err instanceof Error
          ? err.message
          : "Unexpected error";


      setError(
        message
      );


      /*
       * Do not manufacture a business failure state.
       *
       * If backend created DRAFT but transmission
       * failed, the workflow can remain DRAFT with
       * an error.
       */

      try {

        await refreshRequestStatus(
          id
        );

      } catch {

        // Request may not have been created.

      }


    } finally {

      setSubmitting(
        false
      );

    }

  }


  // ==================================================
  // LABEL SPECIMEN
  //
  // SENT → LABELLED
  // ==================================================

  async function labelSpecimen() {

    if (!requestId) {

      return;

    }


    setError(
      null
    );


    setActionLoading(
      true
    );


    try {

      const response =
        await fetch(
          `${ORCHESTRATOR_URL}/lab-requests/${requestId}/label`,
          {

            method:
              "POST",


            headers: {

              "Content-Type":
                "application/json",

            },


            body:
              JSON.stringify({

                labelId:
                  `SPEC-${requestId}`

              }),

          }
        );


      const data =
        await response.json();


      if (
        !response.ok
      ) {

        throw new Error(
          data?.message ??
          "Unable to label specimen"
        );

      }


      await refreshRequestStatus(
        requestId
      );


    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Unable to label specimen"
      );


    } finally {

      setActionLoading(
        false
      );

    }

  }


  // ==================================================
  // COLLECT SPECIMEN
  //
  // LABELLED → COLLECTED
  //
  // Once COLLECTED, useEffect starts polling.
  // ==================================================

  async function collectSpecimen() {

    if (!requestId) {

      return;

    }


    setError(
      null
    );


    setActionLoading(
      true
    );


    try {

      const response =
        await fetch(
          `${ORCHESTRATOR_URL}/lab-requests/${requestId}/collect`,
          {

            method:
              "POST",


            headers: {

              "Content-Type":
                "application/json",

            },


            body:
              JSON.stringify({

                collectedBy:
                  "Dr John Smith",

                collectedAt:
                  new Date()
                    .toISOString()

              }),

          }
        );


      const data =
        await response.json();


      if (
        !response.ok
      ) {

        throw new Error(
          data?.message ??
          "Unable to collect specimen"
        );

      }


      /*
       * This returns COLLECTED.
       *
       * The polling effect sees COLLECTED
       * and starts automatically.
       */

      await refreshRequestStatus(
        requestId
      );


    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Unable to collect specimen"
      );


    } finally {

      setActionLoading(
        false
      );

    }

  }


  // ==================================================
  // MANUAL STATUS REFRESH
  //
  // Useful during POC testing.
  // ==================================================

  async function refreshStatusManually() {
    if (!requestId) {
      return;
    }
    setError(
      null
    );
    try {
      await refreshRequestStatus(
        requestId
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to refresh request status"
      );
    }
  }

  // ==================================================
  // RESET
  // ==================================================

  function resetForm() {
    setForm(
      INITIAL_FORM
    );
    setRequestId(
      null
    );
    setRequestStatus(
      null
    );
    setResult(
      null
    );
    setError(
      null
    );
    setShowTechnicalDetails(
      false
    );
  }

  // ==================================================
  // FHIR RESULT RESOURCES
  // ==================================================

  const observation =
    findResource(
      result?.fhirDocument,
      "Observation"
    );


  const diagnosticReport =
    findResource(
      result?.fhirDocument,
      "DiagnosticReport"
    );


  // ==================================================
  // RESULT VALUE
  // ==================================================

  const resultValue =

    observation
      ?.valueQuantity
      ?.value

    ??

    result
      ?.canonicalResult
      ?.value;


  const resultUnit =

    observation
      ?.valueQuantity
      ?.unit

    ??

    result
      ?.canonicalResult
      ?.unit

    ??

    "";


  // ==================================================
  // RESULT INTERPRETATION
  // ==================================================

  const interpretation =

    observation
      ?.interpretation
      ?.[0]
      ?.text

    ??

    observation
      ?.interpretation
      ?.[0]
      ?.coding
      ?.[0]
      ?.code

    ??

    result
      ?.canonicalResult
      ?.interpretation

    ??

    diagnosticReport
      ?.conclusion

    ??

    "—";


  // ==================================================
  // REFERENCE RANGE
  // ==================================================

  const referenceLow =

    observation
      ?.referenceRange
      ?.[0]
      ?.low
      ?.value

    ??

    result
      ?.canonicalResult
      ?.referenceRange
      ?.low;


  const referenceHigh =

    observation
      ?.referenceRange
      ?.[0]
      ?.high
      ?.value

    ??

    result
      ?.canonicalResult
      ?.referenceRange
      ?.high;


  const referenceUnit =

    observation
      ?.referenceRange
      ?.[0]
      ?.low
      ?.unit

    ??

    result
      ?.canonicalResult
      ?.referenceRange
      ?.unit

    ??

    resultUnit;


  // ==================================================
  // ABNORMAL
  // ==================================================

  const isAbnormal =

    interpretation ===
      "ABNORMAL"

    ||

    interpretation ===
      "H"

    ||

    interpretation ===
      "HIGH";


  // ==================================================
  // DISPLAY STATUS
  // ==================================================

  const displayStatus =

    result
      ?.canonicalResult
      ?.status === "F"

      ? "Final"

      :

    result
      ?.canonicalResult
      ?.status === "P"

      ? "Preliminary"

      :

    diagnosticReport
      ?.status === "final"

      ? "Final"

      :

    diagnosticReport
      ?.status === "preliminary"

      ? "Preliminary"

      :

    result
      ?.canonicalResult
      ?.status

    ??

    "Final";


  // ==================================================
  // RESULT VISIBILITY
  // ==================================================

  const showResult =
    hasResultState(
      requestStatus?.state
    );


  // ==================================================
  // WAITING FOR EXTERNAL LIMS?
  // ==================================================

  const waitingForLims =

    requestStatus != null

    &&

    LIMS_POLLING_STATES.includes(
      requestStatus.state
    );
  
  async function advanceDemoLims() {
    if (!requestId) {
      return;
    }


    setError(
      null
    );

    setActionLoading(
      true
    );


    try {

      const response =
        await fetch(
          `${ORCHESTRATOR_URL}/demo/lab-requests/${requestId}/advance-lims`,
          {
            method:
              "POST"
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data?.message
          ??
          "Unable to simulate LIMS event"
        );

      }


      // ========================================
      // Refresh authoritative workflow
      // ========================================

      await refreshRequestStatus(
        requestId
      );


      // ========================================
      // Result may now have appeared
      // ========================================

      const context =
        await getRequestContext(
          requestId
        );


      setResult(
        context
      );


    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Unable to simulate LIMS event"
      );


    } finally {

      setActionLoading(
        false
      );

    }
  }

  // ==================================================
  // UI
  // ==================================================

  return (

    <div className="app">


      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <header className="app-header">

        <div className="header-inner">

          <div className="brand">

            <div className="brand-mark">
              RLT
            </div>


            <div>

              <h1>
                Request Lab Test
              </h1>

              <p>
                Digital pathology test request
              </p>

            </div>

          </div>


          <div className="environment-badge">
            POC
          </div>

        </div>

      </header>


      {/* ================================================= */}
      {/* MAIN */}
      {/* ================================================= */}

      <main className="app-container">


        {/* ================================================= */}
        {/* CREATE REQUEST */}
        {/* ================================================= */}

        {!requestId && (

          <section className="card">

            <div className="card-header">

              <div>

                <div className="eyebrow">
                  NEW REQUEST
                </div>


                <h2>
                  Request a laboratory test
                </h2>


                <p>
                  Enter the patient, test and
                  clinical information required
                  to create a pathology request.
                </p>

              </div>

            </div>


            <form
              onSubmit={
                submitRequest
              }
            >


              {/* ============================================= */}
              {/* PROTOCOL */}
              {/* ============================================= */}

              <div className="form-section">

                <div className="section-title">

                  <span className="section-number">
                    1
                  </span>


                  <div>

                    <h3>
                      Integration protocol
                    </h3>


                    <p>
                      Select the protocol used to
                      communicate with the laboratory.
                    </p>

                  </div>

                </div>


                <div className="protocol-options">


                  <label className="protocol-option">

                    <input
                      type="radio"
                      name="protocol"
                      value="FHIR_R4"
                      checked={
                        protocol ===
                        "FHIR_R4"
                      }
                      onChange={() =>
                        setProtocol(
                          "FHIR_R4"
                        )
                      }
                    />


                    <div>

                      <strong>
                        FHIR R4
                      </strong>

                      <span>
                        NHS pathology FHIR workflow
                      </span>

                    </div>

                  </label>


                  <label className="protocol-option">

                    <input
                      type="radio"
                      name="protocol"
                      value="HL7_V2"
                      checked={
                        protocol ===
                        "HL7_V2"
                      }
                      onChange={() =>
                        setProtocol(
                          "HL7_V2"
                        )
                      }
                    />


                    <div>

                      <strong>
                        HL7 v2
                      </strong>

                      <span>
                        OML^O21 request and
                        ORU^R01 result
                      </span>

                    </div>

                  </label>


                </div>

              </div>


              {/* ============================================= */}
              {/* PATIENT */}
              {/* ============================================= */}

              <div className="form-section">

                <div className="section-title">

                  <span className="section-number">
                    2
                  </span>


                  <div>

                    <h3>
                      Patient details
                    </h3>


                    <p>
                      Enter the patient information
                      required for this request.
                    </p>

                  </div>

                </div>


                <div className="form-grid">


                  <div className="field">

                    <label>
                      NHS number
                    </label>


                    <input
                      type="text"
                      value={
                        form.nhsNumber
                      }
                      onChange={
                        event =>
                          updateField(
                            "nhsNumber",
                            event.target.value
                          )
                      }
                      required
                    />

                  </div>


                  <div className="field">

                    <label>
                      First name
                    </label>


                    <input
                      type="text"
                      value={
                        form.firstName
                      }
                      onChange={
                        event =>
                          updateField(
                            "firstName",
                            event.target.value
                          )
                      }
                      required
                    />

                  </div>


                  <div className="field">

                    <label>
                      Last name
                    </label>


                    <input
                      type="text"
                      value={
                        form.lastName
                      }
                      onChange={
                        event =>
                          updateField(
                            "lastName",
                            event.target.value
                          )
                      }
                      required
                    />

                  </div>


                  <div className="field">

                    <label>
                      Date of birth
                    </label>


                    <input
                      type="date"
                      value={
                        form.dateOfBirth
                      }
                      onChange={
                        event =>
                          updateField(
                            "dateOfBirth",
                            event.target.value
                          )
                      }
                      required
                    />

                  </div>


                  <div className="field">

                    <label>
                      Gender
                    </label>


                    <select
                      value={
                        form.gender
                      }
                      onChange={
                        event =>
                          updateField(
                            "gender",
                            event.target.value
                          )
                      }
                    >

                      <option value="male">
                        Male
                      </option>

                      <option value="female">
                        Female
                      </option>

                      <option value="other">
                        Other
                      </option>

                      <option value="unknown">
                        Unknown
                      </option>

                    </select>

                  </div>


                </div>

              </div>


              {/* ============================================= */}
              {/* TEST */}
              {/* ============================================= */}

              <div className="form-section">

                <div className="section-title">

                  <span className="section-number">
                    3
                  </span>


                  <div>

                    <h3>
                      Laboratory test
                    </h3>


                    <p>
                      Select the requested test and specimen.
                    </p>

                  </div>

                </div>


                <div className="form-grid">


                  <div className="field">

                    <label>
                      Test
                    </label>


                    <select
                      value={
                        form.test
                      }
                      onChange={
                        event =>
                          updateField(
                            "test",
                            event.target.value
                          )
                      }
                    >

                      <option value="HBA1C">
                        Haemoglobin A1c
                      </option>

                    </select>

                  </div>


                  <div className="field">

                    <label>
                      Specimen
                    </label>


                    <select
                      value={
                        form.specimen
                      }
                      onChange={
                        event =>
                          updateField(
                            "specimen",
                            event.target.value
                          )
                      }
                    >

                      <option value="Venous blood specimen">
                        Venous blood specimen
                      </option>

                      <option value="Blood specimen">
                        Blood specimen
                      </option>

                    </select>

                  </div>


                </div>

              </div>


              {/* ============================================= */}
              {/* CLINICAL INFORMATION */}
              {/* ============================================= */}

              <div className="form-section">

                <div className="section-title">

                  <span className="section-number">
                    4
                  </span>


                  <div>

                    <h3>
                      Clinical information
                    </h3>


                    <p>
                      Provide the clinical reason
                      for requesting the test.
                    </p>

                  </div>

                </div>


                <div className="field">

                  <label>
                    Reason for test
                  </label>


                  <textarea
                    value={
                      form.clinicalInformation
                    }
                    onChange={
                      event =>
                        updateField(
                          "clinicalInformation",
                          event.target.value
                        )
                    }
                    rows={4}
                    required
                  />

                </div>

              </div>


              {/* ============================================= */}
              {/* REQUESTER */}
              {/* ============================================= */}

              <div className="form-section">

                <div className="section-title">

                  <span className="section-number">
                    5
                  </span>


                  <div>

                    <h3>
                      Requester
                    </h3>


                    <p>
                      Practitioner submitting the request.
                    </p>

                  </div>

                </div>


                <div className="requester-summary">


                  <div className="requester-item">

                    <span>
                      Practitioner
                    </span>

                    <strong>
                      Dr John Smith
                    </strong>

                  </div>


                  <div className="requester-item">

                    <span>
                      GMC number
                    </span>

                    <strong>
                      GMC-1234567
                    </strong>

                  </div>


                  <div className="requester-item">

                    <span>
                      Organisation
                    </span>

                    <strong>
                      RLT001
                    </strong>

                  </div>


                </div>

              </div>


              {/* ============================================= */}
              {/* SUBMIT */}
              {/* ============================================= */}

              <div className="form-actions">

                <button
                  type="submit"
                  disabled={
                    submitting
                  }
                  className="primary-button"
                >

                  {submitting ? (

                    <>
                      <span className="spinner" />
                      Sending request...
                    </>

                  ) : (

                    <>
                      Request lab test

                      <span className="button-arrow">
                        →
                      </span>
                    </>

                  )}

                </button>

              </div>


            </form>

          </section>

        )}


        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {error && (

          <section className="error-card">

            <div className="error-icon">
              !
            </div>


            <div>

              <h3>
                Request action failed
              </h3>


              <p>
                {error}
              </p>

            </div>

          </section>

        )}


        {/* ================================================= */}
        {/* WORKFLOW */}
        {/* ================================================= */}

        {requestStatus && (

          <section className="card progress-card">


            <RequestProgress
              state={
                requestStatus.state
              }
              progress={
                requestStatus.progress
              }
              message={
                requestStatus.message
              }
              protocol={
                protocol
              }
            />


            {requestId && (

              <div className="request-id">

                <span>
                  Request ID
                </span>

                <strong>
                  {requestId}
                </strong>

              </div>

            )}


            {/* ============================================= */}
            {/* ACTIONS */}
            {/* ============================================= */}

            <div className="workflow-actions">


              {requestStatus.state ===
                "SENT" && (

                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    actionLoading
                  }
                  onClick={
                    labelSpecimen
                  }
                >

                  {actionLoading
                    ? "Updating..."
                    : "Label specimen"}

                </button>

              )}


              {requestStatus.state ===
                "LABELLED" && (

                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    actionLoading
                  }
                  onClick={
                    collectSpecimen
                  }
                >

                  {actionLoading
                    ? "Updating..."
                    : "Confirm specimen collected"}

                </button>

              )}

              {requestStatus &&
                LIMS_POLLING_STATES.includes(
                  requestStatus.state
                ) && (

                <div className="demo-simulator">

                  <div className="demo-simulator-header">

                    <div>

                      <div className="eyebrow">
                        POC DEMO TOOL
                      </div>

                      <strong>
                        Simulate next LIMS event
                      </strong>

                    </div>

                    <span className="demo-badge">
                      DEMO ONLY
                    </span>

                  </div>


                  <p>
                    Simulates an external laboratory event
                    for demonstration purposes. Production
                    RLT would receive this event from the
                    LIMS integration layer.
                  </p>


                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      actionLoading
                    }
                    onClick={
                      advanceDemoLims
                    }
                  >
                    {actionLoading
                    ? "Simulating..."
                    : nextDemoAction
                      ?? "Simulate next LIMS event"}

                  </button>

                </div>

              )}

              {/* =========================================== */}
              {/* EXTERNAL LIMS WAITING */}
              {/* =========================================== */}

              {waitingForLims && (

                <div className="workflow-waiting">

                  <strong>

                    {requestStatus.state ===
                      "COLLECTED"

                      ? "Waiting for laboratory"

                      : requestStatus.state ===
                        "RECEIVED"

                      ? "Specimen received"

                      : requestStatus.state ===
                        "BOOKED_IN"

                      ? "Specimen booked in"

                      : requestStatus.state ===
                        "IN_PROGRESS"

                      ? "Testing in progress"

                      : requestStatus.state ===
                        "RESULT_RECEIVED"

                      ? "Result received"

                      : "Result saved"}

                  </strong>


                  <p>

                    {requestStatus.message}

                  </p>


                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      refreshStatusManually
                    }
                  >
                    Refresh status
                  </button>

                </div>

              )}


              {/* =========================================== */}
              {/* RESULT NOTIFIED */}
              {/* =========================================== */}

              {requestStatus.state ===
                "RESULT_NOTIFIED" && (

                <div className="workflow-waiting">

                  <strong>
                    Result available
                  </strong>


                  <p>
                    The laboratory has notified RLT
                    that the pathology result is
                    available.
                  </p>

                </div>

              )}


              {/* =========================================== */}
              {/* UNHAPPY PATH */}
              {/* =========================================== */}

              {requestStatus.state ===
                "INVALID_SAMPLE" && (

                <div className="workflow-waiting">

                  <strong>
                    Invalid sample
                  </strong>

                  <p>
                    {requestStatus.message}
                  </p>

                </div>

              )}


              {requestStatus.state ===
                "SAMPLE_NOT_FOUND" && (

                <div className="workflow-waiting">

                  <strong>
                    Sample not found
                  </strong>

                  <p>
                    {requestStatus.message}
                  </p>

                </div>

              )}

              {requestStatus.state ===
                "RESULT_NOTIFIED" && (

                <div className="workflow-waiting">

                  <strong>
                    Result available
                  </strong>

                  <p>
                    The laboratory has notified RLT
                    that the pathology result is available.
                  </p>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      actionLoading
                    }
                    onClick={
                      viewResult
                    }
                  >
                    {actionLoading
                      ? "Updating..."
                      : "View result"}
                  </button>

                </div>

              )}

              {requestStatus.state ===
                "RESULT_VIEWED" && (

                <div className="workflow-waiting">

                  <strong>
                    Result viewed
                  </strong>

                  <p>
                    The pathology result has been viewed
                    by the requesting user.
                  </p>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      actionLoading
                    }
                    onClick={
                      completeRequest
                    }
                  >
                    {actionLoading
                      ? "Updating..."
                      : "Complete request"}
                  </button>

                </div>

              )}

              {requestStatus.state ===
                "COMPLETED" && (

                <div className="workflow-waiting">

                  <strong>
                    Request completed
                  </strong>

                  <p>
                    The RLT workflow is complete.
                    The final acknowledgement can now
                    be sent to the LIMS.
                  </p>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      actionLoading
                    }
                    onClick={
                      markLimsUpdated
                    }
                  >
                    {actionLoading
                      ? "Updating..."
                      : "Update LIMS"}
                  </button>

                </div>

              )}

              {requestStatus.state ===
                "LIMS_UPDATED" && (

                <div className="workflow-complete">

                  <strong>
                    Workflow complete
                  </strong>

                  <p>
                    The final RLT update has been
                    recorded against the LIMS workflow.
                  </p>

                </div>

              )}

              {requestStatus?.state === "INVALID_SAMPLE" && (
                <section className="card unhappy-path-card">
                  <div className="unhappy-path-icon">
                    !
                  </div>
                  <div className="unhappy-path-content">
                    <div className="eyebrow">
                      SAMPLE ISSUE
                    </div>
                    <h2>
                      Invalid sample
                    </h2>
                    <p>
                      {
                        result?.failure?.message
                        ??
                        requestStatus.message
                      }
                    </p>
                    {result?.failure?.reasonCode && (
                      <div className="failure-detail">
                        <span>
                          Reason code
                        </span>
                        <strong>
                          {result.failure.reasonCode}
                        </strong>
                      </div>
                    )}
                    {result?.failure?.details && (
                      <div className="failure-detail">
                        <span>
                          Details
                        </span>
                        <strong>
                          {result.failure.details}
                        </strong>
                      </div>
                    )}
                    <div className="failure-detail">
                      <span>
                        Request ID
                      </span>
                      <strong>
                        {requestId}
                      </strong>
                    </div>
                    <div className="failure-note">
                      This request cannot continue because
                      the specimen is unsuitable for testing.
                    </div>
                  </div>
                </section>
              )}

              {requestStatus?.state === "SAMPLE_NOT_FOUND" && (
                <section className="card unhappy-path-card">
                  <div className="unhappy-path-icon">
                    !
                  </div>
                  <div className="unhappy-path-content">
                    <div className="eyebrow">
                      SAMPLE ISSUE
                    </div>
                    <h2>
                      Sample not found
                    </h2>
                    <p>
                      {
                        result?.failure?.message
                        ??
                        requestStatus.message
                      }
                    </p>
                    {result?.failure?.details && (
                      <div className="failure-detail">
                        <span>
                          Details
                        </span>
                        <strong>
                          {result.failure.details}
                        </strong>
                      </div>
                    )}
                    <div className="failure-note">
                      Laboratory processing has stopped
                      because the expected specimen could
                      not be located.
                    </div>
                  </div>
                </section>
              )}
            </div>
          </section>
        )}

        {/* ================================================= */}
        {/* RESULT */}
        {/* ================================================= */}

        {result &&
          showResult && 
          result.canonicalResult != null && (

          <section className="card result-card">


            <div className="result-header">

              <div>

                <div className="eyebrow">
                  LABORATORY RESULT
                </div>


                <h2>

                  {
                    result
                      .canonicalResult
                      ?.test
                      ?.display

                    ??

                    observation
                      ?.code
                      ?.text

                    ??

                    diagnosticReport
                      ?.code
                      ?.text

                    ??

                    "Laboratory result"
                  }

                </h2>


                <p>
                  Pathology result received from
                  the laboratory.
                </p>

              </div>

              <div className="completed-badge">
                <span>
                  ✓
                </span>
                {requestStatus?.state ===
                  "LIMS_UPDATED"
                  ? "Workflow complete"
                  : requestStatus?.state ===
                    "COMPLETED"
                  ? "Completed"
                  : requestStatus?.state ===
                    "RESULT_VIEWED"
                  ? "Result viewed"
                  : "Result available"}
              </div>

            </div>


            {/* ============================================= */}
            {/* META */}
            {/* ============================================= */}

            <div className="result-meta">


              <div className="result-meta-item">

                <span>
                  Request ID
                </span>

                <strong>
                  {result.requestId}
                </strong>

              </div>


              <div className="result-meta-item">

                <span>
                  Accession number
                </span>

                <strong>

                  {
                    result.accessionNumber
                    ??
                    "—"
                  }

                </strong>

              </div>


              <div className="result-meta-item">

                <span>
                  Patient
                </span>

                <strong>
                  {form.firstName}
                  {" "}
                  {form.lastName}
                </strong>

              </div>


              <div className="result-meta-item">

                <span>
                  Workflow state
                </span>

                <strong>
                  {requestStatus?.state}
                </strong>

              </div>


            </div>


            {/* ============================================= */}
            {/* RESULT VALUE */}
            {/* ============================================= */}

            <div
              className={
                `result-value-card ${
                  isAbnormal
                    ? "result-abnormal"
                    : ""
                }`
              }
            >

              <div className="result-value-top">


                <div>

                  <span className="result-label">
                    Result
                  </span>


                  <div className="result-value">

                    {
                      resultValue ??
                      "—"
                    }

                    <span>
                      {resultUnit}
                    </span>

                  </div>


                  <div className="result-test">

                    {
                      result
                        .canonicalResult
                        ?.test
                        ?.display

                      ??

                      observation
                        ?.code
                        ?.text

                      ??

                      "Laboratory test"
                    }

                  </div>

                </div>


                <div
                  className={
                    `interpretation-badge ${
                      isAbnormal
                        ? "abnormal"
                        : "normal"
                    }`
                  }
                >

                  {isAbnormal
                    ? "Abnormal"
                    : interpretation}

                </div>


              </div>

            </div>


            {/* ============================================= */}
            {/* RESULT DETAILS */}
            {/* ============================================= */}

            <div className="result-details">


              <div className="result-detail">

                <span>
                  Interpretation
                </span>


                <strong
                  className={
                    isAbnormal
                      ? "abnormal-text"
                      : ""
                  }
                >

                  {
                    interpretation ===
                    "H"

                      ? "High"

                      : interpretation
                  }

                </strong>

              </div>


              <div className="result-detail">

                <span>
                  Reference range
                </span>


                <strong>

                  {
                    referenceLow ??
                    "—"
                  }

                  {" – "}

                  {
                    referenceHigh ??
                    "—"
                  }

                  {" "}

                  {referenceUnit}

                </strong>

              </div>


              <div className="result-detail">

                <span>
                  Result status
                </span>


                <strong>
                  {displayStatus}
                </strong>

              </div>


            </div>


            {/* ============================================= */}
            {/* TECHNICAL DETAILS */}
            {/* ============================================= */}

            <div className="technical-section">

              <button
                type="button"
                className="technical-toggle"
                onClick={() =>
                  setShowTechnicalDetails(
                    value =>
                      !value
                  )
                }
              >

                <span>

                  {showTechnicalDetails
                    ? "−"
                    : "+"}

                </span>


                {showTechnicalDetails
                  ? "Hide technical details"
                  : "Show technical details"}

              </button>


              {showTechnicalDetails && (

                <div className="technical-content">


                  <TechnicalBlock
                    title="Canonical request"
                    value={
                      result.canonicalRequest
                    }
                  />


                  {result.fhirRequest != null && (

                    <TechnicalBlock
                      title="FHIR R4 request"
                      value={
                        result.fhirRequest
                      }
                    />

                  )}


                  {result.hl7Request && (

                    <TechnicalBlock
                      title="HL7 v2 request — OML^O21"
                      value={
                        result.hl7Request
                      }
                    />

                  )}


                  {result.molis != null && (

                    <TechnicalBlock
                      title="MOLIS response"
                      value={
                        result.molis
                      }
                    />

                  )}


                  {result.hl7Result && (

                    <TechnicalBlock
                      title="HL7 v2 result — ORU^R01"
                      value={
                        result.hl7Result
                      }
                    />

                  )}


                  {result.fhirResult != null && (

                    <TechnicalBlock
                      title="FHIR result"
                      value={
                        result.fhirResult
                      }
                    />

                  )}


                  {result.canonicalResult != null && (

                    <TechnicalBlock
                      title="Canonical result"
                      value={
                        result.canonicalResult
                      }
                    />

                  )}


                  {result.fhirDocument != null && (

                    <TechnicalBlock
                      title="FHIR pathology document"
                      value={
                        result.fhirDocument
                      }
                    />

                  )}


                </div>

              )}

            </div>


          </section>

        )}


        {/* ================================================= */}
        {/* START ANOTHER REQUEST */}
        {/* ================================================= */}

        {requestId && (

          <div className="result-actions">

            <button
              type="button"
              className="secondary-button"
              onClick={
                resetForm
              }
            >

              ← Start another request

            </button>

          </div>

        )}


      </main>


      {/* ================================================= */}
      {/* FOOTER */}
      {/* ================================================= */}

      <footer className="app-footer">

        <div>
          Request Lab Test — Pathology Interoperability POC
        </div>


        <div>

          {protocol === "HL7_V2"

            ? (
              "RLT → HL7 v2 → LIMS → RLT workflow"
            )

            : (
              "RLT → FHIR R4 → LIMS → RLT workflow"
            )}

        </div>

      </footer>


    </div>

  );
}


// ==================================================
// TECHNICAL BLOCK
// ==================================================

function TechnicalBlock({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {

  const content =

    typeof value ===
    "string"

      ? value.replace(
          /\r/g,
          "\n"
        )

      : JSON.stringify(
          value,
          null,
          2
        );


  return (

    <div className="technical-block">

      <h4>
        {title}
      </h4>


      <pre>
        {content}
      </pre>

    </div>

  );

}


export default App;