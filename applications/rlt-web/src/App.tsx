import { useState } from "react";
import type { SyntheticEvent } from "react";

import "./App.css";

import RequestProgress from "./components/RequestProgress";

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


interface RequestStatus {
  requestId: string;

  state: RltState;

  progress: number;

  message: string;

  updatedAt: string;

  error?: string;
}


interface OrchestrationResponse {
  status: string;

  protocol?: IntegrationProtocol;

  requestId: string;

  accessionNumber?: string;

  canonicalRequest?: unknown;

  // ================================================
  // FHIR request path
  // ================================================

  fhirRequest?: Record<string, unknown>;
  fhirResult?: Record<string, unknown>;

  // ================================================
  // HL7 v2 path
  // ================================================

  hl7Request?: string;

  hl7Result?: string;

  // ================================================
  // MOLIS
  // ================================================

  molis?: unknown;

  molisProcess?: unknown;

  // ================================================
  // CANONICAL RESULT
  // ================================================

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

  // ================================================
  // FINAL FHIR DOCUMENT
  // ================================================

  fhirDocument?: any;

  validation?: {
    valid: boolean;
    resourceCount?: number;
  };
}


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
// INITIAL FORM
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
    "Blood specimen",

  clinicalInformation:
    "Routine diabetes monitoring",
};


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
    !Array.isArray(bundle.entry)
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
// APP
// ==================================================

function App() {

  // ==================================================
  // FORM
  // ==================================================

  const [form, setForm] =
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
  // REQUEST STATE
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


  // ==================================================
  // RESULT
  // ==================================================

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
    showTechnicalDetails,
    setShowTechnicalDetails
  ] =
    useState(
      false
    );


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
        [field]: value,
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


  // ==================================================
  // POLL REQUEST STATUS
  // ==================================================

  async function pollRequestStatus(
    id: string,
    shouldStop: () => boolean
  ): Promise<void> {

    while (
      !shouldStop()
    ) {

      try {

        const status =
          await getRequestStatus(
            id
          );


        setRequestStatus(
          status
        );


        if (
          status.state ===
            "COMPLETED" ||
          status.state ===
            "FAILED"
        ) {

          return;

        }

      } catch {

        /*
         * Temporary 404 is OK.
         *
         * The first status request can reach
         * the orchestrator immediately before
         * POST /lab-requests has created the
         * status entry.
         */

      }


      await new Promise<void>(
        resolve => {

          window.setTimeout(
            resolve,
            200
          );

        }
      );

    }
  }


  // ==================================================
  // SUBMIT REQUEST
  // ==================================================

  async function submitRequest(
    event:
      SyntheticEvent<HTMLFormElement>
  ) {

    event.preventDefault();


    // ================================================
    // RESET UI
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
    // BUILD REQUEST
    // ================================================

    const request:
      LabRequest = {

        requestId:
          id,


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
    // INITIAL UI PROGRESS
    // ================================================

    setRequestStatus({

      requestId:
        id,

      state:
        "SUBMITTED",

      progress:
        5,

      message:
        "Laboratory request submitted",

      updatedAt:
        new Date()
          .toISOString(),

    });


    let postCompleted =
      false;


    let pollingPromise:
      Promise<void> | null =
      null;


    try {

      // ==============================================
      // START POST
      // ==============================================

      /*
       * IMPORTANT:
       *
       * DO NOT await here.
       *
       * We start the POST and then start polling
       * while the orchestrator processes the request.
       */

      const responsePromise =
        fetch(
          `${ORCHESTRATOR_URL}/lab-requests`,
          {

            method:
              "POST",


            headers: {

              "Content-Type":
                "application/json",

            },


            body:
              JSON.stringify({

                ...request,

                protocol,

              }),

          }
        );


      // ==============================================
      // START POLLING
      // ==============================================

      pollingPromise =
        pollRequestStatus(
          id,
          () =>
            postCompleted
        );


      // ==============================================
      // WAIT FOR FINAL ORCHESTRATOR RESPONSE
      // ==============================================

      const response =
        await responsePromise;


      const data:
        OrchestrationResponse &
        {
          message?: string;
        } =
        await response.json();


      postCompleted =
        true;


      // ==============================================
      // STOP ACTIVE POLLING CLEANLY
      // ==============================================

      if (
        pollingPromise
      ) {

        await pollingPromise;

      }


      // ==============================================
      // HANDLE API ERROR
      // ==============================================

      if (
        !response.ok
      ) {

        throw new Error(
          data?.message ??
          "Laboratory request failed"
        );

      }


      // ==============================================
      // STORE FINAL RESULT
      // ==============================================

      setResult(
        data
      );


      // ==============================================
      // READ FINAL STATUS
      // ==============================================

      try {

        const finalStatus =
          await getRequestStatus(
            id
          );


        setRequestStatus(
          finalStatus
        );

      } catch {

        /*
         * Fallback only.
         *
         * Normally the orchestrator should have
         * COMPLETED in the status store.
         */

        setRequestStatus({

          requestId:
            id,

          state:
            "COMPLETED",

          progress:
            100,

          message:
            "Laboratory request completed",

          updatedAt:
            new Date()
              .toISOString(),

        });

      }

    } catch (err) {

      postCompleted =
        true;


      if (
        pollingPromise
      ) {

        await pollingPromise;

      }


      const message =
        err instanceof Error
          ? err.message
          : "Unexpected error";


      setError(
        message
      );


      // ==============================================
      // TRY BACKEND FAILED STATE FIRST
      // ==============================================

      try {

        const failedStatus =
          await getRequestStatus(
            id
          );


        setRequestStatus(
          failedStatus
        );

      } catch {

        setRequestStatus({

          requestId:
            id,

          state:
            "FAILED",

          progress:
            0,

          message,

          updatedAt:
            new Date()
              .toISOString(),

        });

      }

    } finally {

      postCompleted =
        true;


      setSubmitting(
        false
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
  // RESULT RESOURCES
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
  // INTERPRETATION
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
        {/* REQUEST FORM */}
        {/* ================================================= */}

        {!result && (

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
                      Select the interoperability
                      protocol used to communicate
                      with the laboratory.
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
                      required for the pathology request.
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
              {/* LAB TEST */}
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
                      Select the test and
                      specimen required.
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

                      <option value="Blood specimen">
                        Blood specimen
                      </option>

                      <option value="Venous blood specimen">
                        Venous blood specimen
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
                    placeholder="Enter clinical information"
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
                      The practitioner submitting
                      the request.
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

                      Processing request...

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
                Request failed
              </h3>


              <p>
                {error}
              </p>

            </div>

          </section>

        )}


        {/* ================================================= */}
        {/* PROGRESS */}
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

          </section>

        )}


        {/* ================================================= */}
        {/* RESULT */}
        {/* ================================================= */}

        {result && (

          <section className="card result-card">


            {/* ============================================= */}
            {/* RESULT HEADER */}
            {/* ============================================= */}

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
                  Final pathology result received
                  from the laboratory.
                </p>

              </div>


              <div className="completed-badge">

                <span>
                  ✓
                </span>

                Completed

              </div>

            </div>


            {/* ============================================= */}
            {/* META */}
            {/* ============================================= */}

            <div className="result-meta">


              <div className="result-meta-item">

                <span>
                  Protocol
                </span>

                <strong>

                  {
                    (
                      result.protocol ??
                      protocol
                    ) === "HL7_V2"
                      ? "HL7 v2"
                      : "FHIR R4"
                  }

                </strong>

              </div>


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
                    result
                      .accessionNumber
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

                  {
                    isAbnormal
                      ? "Abnormal"
                      : interpretation
                  }

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
                    interpretation === "H"
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
                  Status
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

                  {
                    showTechnicalDetails
                      ? "−"
                      : "+"
                  }

                </span>


                {
                  showTechnicalDetails
                    ? "Hide technical details"
                    : "Show technical details"
                }

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
                      value={result.fhirRequest}
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


                  <TechnicalBlock
                    title="MOLIS order response"
                    value={
                      result.molis
                    }
                  />


                  <TechnicalBlock
                    title="MOLIS processing"
                    value={
                      result.molisProcess
                    }
                  />


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
                      value={result.fhirResult}
                    />
                  )}
                  <TechnicalBlock
                    title="Canonical result"
                    value={
                      result.canonicalResult
                    }
                  />
                  <TechnicalBlock
                    title="Final FHIR pathology document"
                    value={
                      result.fhirDocument
                    }
                  />
                  {result.validation && (
                    <TechnicalBlock
                      title="FHIR validation"
                      value={
                        result.validation
                      }
                    />
                  )}
                </div>

              )}

            </div>


            {/* ============================================= */}
            {/* ACTIONS */}
            {/* ============================================= */}

            <div className="result-actions">

              <button
                type="button"
                className="secondary-button"
                onClick={
                  resetForm
                }
              >

                ← Request another test

              </button>

            </div>


          </section>

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

          {
            protocol ===
            "HL7_V2"

              ? (
                "RLT → HL7 v2 OML^O21 → MOLIS → " +
                "ORU^R01 → Canonical → FHIR R4"
              )

              : (
                "RLT → FHIR R4 → MOLIS → FHIR R4"
              )
          }

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