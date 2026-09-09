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
  description: string;
}


// ==================================================
// RLT BUSINESS WORKFLOW
// ==================================================

const workflowSteps: ProgressStep[] = [
  {
    state: "DRAFT",
    label: "Draft",
    description:
      "Lab test request created but not yet sent",
  },

  {
    state: "SENT",
    label: "Sent",
    description:
      "Lab test request sent to the laboratory",
  },

  {
    state: "LABELLED",
    label: "Labelled",
    description:
      "Specimen label created and applied",
  },

  {
    state: "COLLECTED",
    label: "Collected",
    description:
      "Specimen collected from the patient",
  },

  {
    state: "RECEIVED",
    label: "Received",
    description:
      "Specimen received by the laboratory",
  },

  {
    state: "BOOKED_IN",
    label: "Booked in",
    description:
      "Specimen booked into the laboratory system",
  },

  {
    state: "IN_PROGRESS",
    label: "In progress",
    description:
      "Laboratory testing is in progress",
  },

  {
    state: "RESULT_RECEIVED",
    label: "Result received",
    description:
      "Laboratory result received",
  },

  {
    state: "RESULT_SAVED",
    label: "Result saved",
    description:
      "Laboratory result saved into LIMS",
  },

  {
    state: "RESULT_NOTIFIED",
    label: "Result notified",
    description:
      "RLT notified that the result is available",
  },

  {
    state: "RESULT_VIEWED",
    label: "Result viewed",
    description:
      "Result viewed by an RLT user",
  },

  {
    state: "COMPLETED",
    label: "Completed",
    description:
      "Lab test request workflow completed",
  },

  {
    state: "LIMS_UPDATED",
    label: "LIMS updated",
    description:
      "Final workflow update sent to the LIMS",
  },
];


const terminalFailureStates:
  RltState[] = [
    "INVALID_SAMPLE",
    "SAMPLE_NOT_FOUND",
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

  const currentIndex =
    workflowSteps.findIndex(
      step =>
        step.state === state
    );


  const isFailure =
    terminalFailureStates.includes(
      state
    );


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
            REQUEST STATUS
          </div>

          <h2>
            Laboratory request workflow
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
      {/* PROGRESS BAR */}
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
      {/* BUSINESS WORKFLOW */}
      {/* ========================================== */}

      <div className="progress-steps">

        {workflowSteps.map(
          (
            step,
            index
          ) => {

            const completed =
              !isFailure &&
              currentIndex >= 0 &&
              index < currentIndex;


            const current =
              !isFailure &&
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

                  <div className="step-description">
                    {step.description}
                  </div>

                </div>

              </div>
            );

          }
        )}

      </div>


      {/* ========================================== */}
      {/* UNHAPPY PATH */}
      {/* ========================================== */}

      {state === "INVALID_SAMPLE" && (

        <div className="progress-error">

          <div className="progress-error-icon">
            !
          </div>

          <div>

            <strong>
              Invalid sample
            </strong>

            <p>
              {message}
            </p>

          </div>

        </div>

      )}


      {state === "SAMPLE_NOT_FOUND" && (

        <div className="progress-error">

          <div className="progress-error-icon">
            !
          </div>

          <div>

            <strong>
              Sample not found
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