export interface HL7Segment {
  name: string;
  fields: string[];
}

export function parseHL7Message(message: string): HL7Segment[] {
  return message
    .replace(/\r\n/g, "\r")
    .replace(/\n/g, "\r")
    .split("\r")
    .filter(Boolean)
    .map((line) => {
      const fields = line.split("|");

      return {
        name: fields[0] ?? "",
        fields
      };
    });
}

function getSegment(
  segments: HL7Segment[],
  name: string
): HL7Segment | undefined {
  return segments.find((segment) => segment.name === name);
}

function field(
  segment: HL7Segment | undefined,
  index: number
): string {
  return segment?.fields[index] ?? "";
}

function component(
  value: string,
  index: number
): string {
  return value.split("^")[index] ?? "";
}

function formatDate(value: string): string {
  if (!value || value.length < 8) return "";

  return `${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`;
}

export interface Hl7MolisOrderInput {
  requestId: string;
  patient: {
    nhsNumber: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
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
    code: string;
    display: string;
  };
  specimen: {
    id: string;
    type: string;
  };
}

export function hl7ToMolisOrder(message: string): Hl7MolisOrderInput {
  if (!message?.trim()) {
    throw new Error("HL7 v2 message is required");
  }

  const segments = parseHL7Message(message);
  const msh = getSegment(segments, "MSH");
  const pid = getSegment(segments, "PID");
  const orc = getSegment(segments, "ORC");
  const obr = getSegment(segments, "OBR");
  const spm = getSegment(segments, "SPM");

  if (!msh) throw new Error("HL7 message does not contain MSH");
  if (!pid) throw new Error("HL7 message does not contain PID");
  if (!orc) throw new Error("HL7 message does not contain ORC");
  if (!obr) throw new Error("HL7 message does not contain OBR");
  if (!spm) throw new Error("HL7 message does not contain SPM");

  const messageType = field(msh, 8);
  if (messageType !== "OML^O21") {
    throw new Error(`Unsupported HL7 message type: ${messageType || "unknown"}`);
  }

  const requestId = field(orc, 2) || field(msh, 9);
  if (!requestId) throw new Error("HL7 request identifier is required");

  const nhsNumber = component(field(pid, 3), 0);
  if (!nhsNumber) throw new Error("HL7 NHS number is required");

  const patientName = field(pid, 5);
  const test = field(obr, 4);
  const specimen = field(spm, 4);

  const testCode = component(test, 0);
  if (!testCode) throw new Error("HL7 OBR-4 test code is required");

  const specimenCode = component(specimen, 0);
  const specimenDisplay = component(specimen, 1) || specimen;

  return {
    requestId,
    patient: {
      nhsNumber,
      firstName: component(patientName, 1),
      lastName: component(patientName, 0),
      dateOfBirth: formatDate(field(pid, 7))
    },
    requester: {
      practitionerId: "",
      name: "HL7 v2 requester",
      organisationCode: field(msh, 3)
    },
    laboratory: {
      organisationCode: field(msh, 5),
      name: field(msh, 5) || "MOLIS Pathology Laboratory"
    },
    test: {
      code: testCode,
      display: component(test, 1)
    },
    specimen: {
      id: `${requestId}-SPECIMEN`,
      type: specimenDisplay || specimenCode
    }
  };
}
