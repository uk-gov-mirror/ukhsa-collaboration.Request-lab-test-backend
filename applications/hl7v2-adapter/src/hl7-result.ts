import type {
  CanonicalResult
} from "./types.js";

function getField(
  segment: string[],
  index: number
): string {
  return segment[index] ?? "";
}

function parseSegments(
  message: string
): string[][] {

  return message
    .split(/\r\n|\r|\n/)
    .filter(Boolean)
    .map(
      segment =>
        segment.split("|")
    );
}

function findSegment(
  segments: string[][],
  segmentType: string
): string[] | undefined {

  return segments.find(
    segment =>
      segment[0] === segmentType
  );
}

function parseNumericValue(
  value: string
): number | string | undefined {

  if (!value) {
    return undefined;
  }

  const numeric =
    Number(value);

  return Number.isNaN(numeric)
    ? value
    : numeric;
}

function parseReferenceRange(
  value: string,
  unit?: string
) {

  if (!value) {
    return undefined;
  }

  const match =
    value.match(
      /^(-?\d+(?:\.\d+)?)?-(-?\d+(?:\.\d+)?)?$/
    );

  if (!match) {
    return {
      unit
    };
  }

  const low =
    match[1] !== undefined
      ? Number(match[1])
      : undefined;

  const high =
    match[2] !== undefined
      ? Number(match[2])
      : undefined;

  return {
    low,
    high,
    unit
  };
}

export function hl7ResultToCanonical(
  message: string
): CanonicalResult {

  if (!message) {
    throw new Error(
      "HL7 v2 result message is required"
    );
  }

  const segments =
    parseSegments(message);

  const msh =
    findSegment(
      segments,
      "MSH"
    );

  const obx =
    findSegment(
      segments,
      "OBX"
    );

  if (!msh) {
    throw new Error(
      "HL7 v2 MSH segment is required"
    );
  }

  if (!obx) {
    throw new Error(
      "HL7 v2 OBX segment is required"
    );
  }

  // MSH-9
  const messageType =
    getField(msh, 8);

  if (messageType !== "ORU^R01") {
    throw new Error(
      `Unsupported HL7 result message type: ${messageType || "unknown"}`
    );
  }

  // OBX-2
  const valueType =
    getField(obx, 2);

  // OBX-3
  const observationIdentifier =
    getField(obx, 3);

  const [
    code,
    display
  ] =
    observationIdentifier.split("^");

  // OBX-5
  const value =
    parseNumericValue(
      getField(obx, 5)
    );

  // OBX-6
  const unit =
    getField(obx, 6);

  // OBX-7
  const referenceRange =
    getField(obx, 7);

  // OBX-8
  const interpretation =
    getField(obx, 8);

  // OBX-11
  const status =
    getField(obx, 11);

  if (!code) {
    throw new Error(
      "HL7 v2 OBX observation code is required"
    );
  }

  if (
    valueType === "NM" &&
    typeof value !== "number"
  ) {
    throw new Error(
      "HL7 v2 numeric result contains a non-numeric value"
    );
  }

  return {
    observationId: undefined,

    test: {
        code,
        display: display || undefined,
        system: "http://snomed.info/sct"
    },

    value,

    unit: unit || undefined,

    referenceRange:
        parseReferenceRange(
        referenceRange,
        unit || undefined
        ),

    interpretation:
        interpretation || undefined,

    status:
        status || undefined,

    issuedAt:
        getField(obx, 14) || undefined
    };
}