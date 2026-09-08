import type {
  IntegrationProtocol,
  RltState,
} from "../types";


interface RequestProgressProps {
  state: RltState;
  progress: number;
  message: string;
  protocol: IntegrationProtocol;
}


interface ProgressStep {
  state: RltState;
  label: string;
  description?: string;
}


// ==================================================
// FHIR R4 FLOW
// ==================================================

const fhirSteps: ProgressStep[] = [
  {
    state: "SUBMITTED",
    label: "Request submitted",
    description:
      "Laboratory request received by the orchestrator",
  },

  {
    state: "TERMINOLOGY_RESOLVED",
    label: "Terminology resolved",
    description:
      "Local pathology terminology mapped",
  },

  {
    state: "FHIR_REQUEST_CREATED",
    label: "FHIR R4 request created",
    description:
      "Canonical request converted to FHIR",
  },

  {
    state: "SENT_TO_MOLIS",
    label: "Sent to MOLIS",
    description:
      "Pathology request sent to the laboratory",
  },

  {
    state: "ORDER_RECEIVED",
    label: "MOLIS order received",
    description:
      "Laboratory accepted the pathology request",
  },

  {
    state: "RESULT_AVAILABLE",
    label: "Laboratory result available",
    description:
      "Result retrieved from MOLIS",
  },

  {
    state: "RESULT_MAPPED",
    label: "Result mapped",
    description:
      "FHIR result converted to canonical result",
  },

  {
    state: "COMPLETED",
    label: "Request completed",
    description:
      "Laboratory workflow completed",
  },
];


// ==================================================
// HL7 V2 FLOW
// ==================================================

const hl7Steps: ProgressStep[] = [
  {
    state: "SUBMITTED",
    label: "Request submitted",
    description:
      "Laboratory request received by the orchestrator",
  },

  {
    state: "TERMINOLOGY_RESOLVED",
    label: "Terminology resolved",
    description:
      "Local pathology terminology mapped",
  },

  {
    state: "HL7V2_REQUEST_CREATED",
    label: "HL7 v2 request created",
    description:
      "OML^O21 pathology request generated",
  },

  {
    state: "SENT_TO_MOLIS",
    label: "Sent to MOLIS",
    description:
      "HL7 v2 request transmitted to the laboratory",
  },

  {
    state: "ORDER_RECEIVED",
    label: "MOLIS order received",
    description:
      "Laboratory accepted the HL7 v2 order",
  },

  {
    state: "RESULT_AVAILABLE",
    label: "Laboratory result available",
    description:
      "MOLIS processing completed",
  },

  {
    state: "HL7V2_RESULT_RECEIVED",
    label: "HL7 v2 result received",
    description:
      "ORU^R01 result received from MOLIS",
  },

  {
    state: "RESULT_MAPPED",
    label: "Result mapped",
    description:
      "HL7 v2 result converted to canonical result",
  },

  {
    state: "FHIR_DOCUMENT_CREATED",
    label: "FHIR document created",
    description:
      "Canonical result converted to FHIR R4 pathology document",
  },

  {
    state: "COMPLETED",
    label: "Request completed",
    description:
      "Laboratory workflow completed successfully",
  },
];


// ==================================================
// COMPONENT
// ==================================================

export default function RequestProgress({
  state,
  progress,
  message,
  protocol,
}: RequestProgressProps) {

  const steps =
    protocol === "HL7_V2"
      ? hl7Steps
      : fhirSteps;


  const currentIndex =
    steps.findIndex(
      step =>
        step.state === state
    );


  const isFailed =
    state === "FAILED";


  const protocolLabel =
    protocol === "HL7_V2"
      ? "HL7 v2"
      : "FHIR R4";


  return (
    <div className="request-progress">


      {/* ========================================== */}
      {/* HEADER */}
      {/* ========================================== */}

      <div className="progress-heading">

        <div>

          <div className="eyebrow">
            REQUEST PROCESSING
          </div>


          <h2>
            Processing laboratory request
          </h2>


          <p>
            {message}
          </p>

        </div>


        <div className="progress-percentage">
          {progress}%
        </div>

      </div>


      {/* ========================================== */}
      {/* PROTOCOL */}
      {/* ========================================== */}

      <div className="progress-protocol">

        <span>
          Integration protocol
        </span>


        <strong>
          {protocolLabel}
        </strong>

      </div>


      {/* ========================================== */}
      {/* BAR */}
      {/* ========================================== */}

      <div className="progress-track">

        <div
          className="progress-fill"
          style={{
            width:
              `${Math.min(
                100,
                Math.max(
                  0,
                  progress
                )
              )}%`,
          }}
        />

      </div>


      {/* ========================================== */}
      {/* STEPS */}
      {/* ========================================== */}

      <div className="progress-steps">

        {steps.map(
          (
            step,
            index
          ) => {

            const completed =
              !isFailed &&
              currentIndex >= 0 &&
              index < currentIndex;


            const current =
              !isFailed &&
              index === currentIndex;


            return (
              <div
                key={
                  step.state
                }
                className={[
                  "progress-step",

                  completed
                    ? "completed"
                    : "",

                  current
                    ? "current"
                    : "",

                ]
                  .filter(Boolean)
                  .join(" ")}
              >

                <div className="step-indicator">

                  {completed ? (

                    <span>
                      ✓
                    </span>

                  ) : current ? (

                    <span className="current-dot">
                      ●
                    </span>

                  ) : (

                    <span>
                      ○
                    </span>

                  )}

                </div>


                <div className="step-content">

                  <div className="step-label">
                    {step.label}
                  </div>


                  {step.description && (

                    <div className="step-description">
                      {step.description}
                    </div>

                  )}

                </div>

              </div>
            );

          }
        )}

      </div>


      {/* ========================================== */}
      {/* FAILURE */}
      {/* ========================================== */}

      {isFailed && (

        <div className="progress-error">

          <div className="progress-error-icon">
            !
          </div>


          <div>

            <strong>
              Request failed
            </strong>


            <p>
              {message}
            </p>

          </div>

        </div>

      )}


    </div>
  );
}