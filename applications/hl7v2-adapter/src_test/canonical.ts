import {
  CanonicalLabRequest,
  CanonicalResult
} from "./types.js";

import {
  HL7Segment,
  getSegment,
  getSegments
} from "./parser.js";

function component(value: string | undefined, index: number): string {
  if (!value) return "";

  return value.split("^")[index] ?? "";
}

function field(
  segment: HL7Segment | undefined,
  index: number
): string {
  if (!segment) return "";

  return segment.fields[index] ?? "";
}

function cleanNhsNumber(value: string): string {
  return value.split("^")[0] ?? value;
}

export function hl7ToCanonical(
  segments: HL7Segment[]
): CanonicalLabRequest {

  const msh = getSegment(segments, "MSH");
  const pid = getSegment(segments, "PID");
  const orc = getSegment(segments, "ORC");
  const obr = getSegment(segments, "OBR");
  const spm = getSegment(segments, "SPM");

  if (!pid) {
    throw new Error("HL7 message does not contain PID");
  }

  if (!obr) {
    throw new Error("HL7 message does not contain OBR");
  }

  const patientIdentifier = field(pid, 3);

  const patientName = field(pid, 5);

  const test = field(obr, 4);

  const requestId =
    field(orc, 2) ||
    field(msh, 10) ||
    crypto.randomUUID();

  const specimenType = field(spm, 4);
  const specimenCode = component(specimenType, 0);
  const specimenDisplay = component(specimenType, 1) || specimenType;

  const resultSegments = getSegments(segments, "OBX");

  let result: CanonicalResult | undefined;

  if (resultSegments.length > 0) {
    const obx = resultSegments[0];

    const value = field(obx, 5);
    const unit = field(obx, 6);
    const referenceRange = field(obx, 7);
    const interpretation = field(obx, 8);
    const status = field(obx, 11);

    const [low, high] = referenceRange
      .split("-")
      .map((v) => Number(v));

    result = {
      value: value !== "" && !Number.isNaN(Number(value))
        ? Number(value)
        : value,

      unit: unit || undefined,

      referenceRange:
        referenceRange && !Number.isNaN(low)
          ? {
              low,
              high: Number.isNaN(high) ? undefined : high,
              unit
            }
          : undefined,

      interpretation: interpretation || undefined,

      status: status || undefined
    };
  }

  return {
    requestId,

    patient: {
      nhsNumber: cleanNhsNumber(patientIdentifier),
      firstName: component(patientName, 1),
      lastName: component(patientName, 0),
      dateOfBirth: formatDate(field(pid, 7)),
      gender: field(pid, 8)
    },

    test: {
      code: component(test, 0),
      display: component(test, 1),
      system: component(test, 0)
        ? "http://snomed.info/sct"
        : undefined
    },

    specimen: {
      type: specimenDisplay,
      code: specimenCode || undefined,
      system: specimenCode
        ? "http://snomed.info/sct"
        : undefined
    },

    result
  };
}

function formatDate(value: string): string | undefined {
  if (!value || value.length < 8) {
    return undefined;
  }

  return `${value.substring(0, 4)}-${value.substring(
    4,
    6
  )}-${value.substring(6, 8)}`;
}