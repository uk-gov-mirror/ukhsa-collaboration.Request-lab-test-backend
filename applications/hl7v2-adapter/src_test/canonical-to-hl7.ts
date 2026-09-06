import type {
  CanonicalLabRequest
} from "./types.js";

function escapeHl7(
  value: string | undefined
): string {

  if (!value) {
    return "";
  }

  return value
    .replace(/\\/g, "\\E\\")
    .replace(/\|/g, "\\F\\")
    .replace(/\^/g, "\\S\\")
    .replace(/~/g, "\\R\\")
    .replace(/&/g, "\\T\\");
}


function formatDate(
  date?: string
): string {

  if (!date) {
    return "";
  }

  return date
    .replace(/-/g, "")
    .replace(/:/g, "")
    .slice(0, 14);
}


function buildMsh(
  request: CanonicalLabRequest
): string {

  const timestamp =
    formatDate(
      request.requestedAt
    ) ||
    new Date()
      .toISOString()
      .replace(/\D/g, "")
      .slice(0, 14);

  return [
    "MSH",
    "^~\\&",
    "RLT",
    request.requester?.organisationCode || "RLT001",
    "MOLIS",
    request.laboratory?.organisationCode || "LAB001",
    timestamp,
    "",
    "OML^O21",
    request.requestId,
    "P",
    "2.5"
  ].join("|");
}


function buildPid(
  request: CanonicalLabRequest
): string {

  const patient =
    request.patient;

  const dob =
    patient.dateOfBirth
      ? patient.dateOfBirth.replace(/-/g, "")
      : "";

  const gender =
    patient.gender
      ? patient.gender.charAt(0).toUpperCase()
      : "";

  return [
    "PID",
    "1",
    "",
    `${escapeHl7(patient.nhsNumber)}^^^NHS`,
    "",
    `${escapeHl7(patient.lastName)}^${escapeHl7(patient.firstName)}`,
    "",
    dob,
    gender
  ].join("|");
}


function buildOrc(
  request: CanonicalLabRequest
): string {

  return [
    "ORC",
    "NW",
    escapeHl7(request.requestId)
  ].join("|");
}


function buildObr(
  request: CanonicalLabRequest
): string {

  const test =
    request.test;

  return [
    "OBR",
    "1",
    escapeHl7(request.requestId),
    "",
    `${escapeHl7(test.code)}^${escapeHl7(test.display)}`
  ].join("|");
}


function buildSpm(
  request: CanonicalLabRequest
): string {

  const specimen =
    request.specimen;

  return [
    "SPM",
    "1",
    "",
    "",
    `${escapeHl7(specimen.code)}^${escapeHl7(specimen.type)}`
  ].join("|");
}


export function canonicalToHL7(
  request: CanonicalLabRequest
): string {

  if (!request) {
    throw new Error(
      "Canonical request is required"
    );
  }

  const segments = [

    buildMsh(request),

    buildPid(request),

    buildOrc(request),

    buildObr(request),

    buildSpm(request)

  ];

  return segments.join("\r");
}