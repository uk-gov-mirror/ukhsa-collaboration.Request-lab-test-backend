import type {
  CanonicalLabRequest
} from "./types.js";

function escapeHl7(value: string | undefined): string {
  if (!value) return "";

  return value
    .replace(/\\/g, "\\E\\")
    .replace(/\|/g, "\\F\\")
    .replace(/\^/g, "\\S\\")
    .replace(/~/g, "\\R\\")
    .replace(/&/g, "\\T\\");
}

function formatTimestamp(value?: string): string {
  if (!value) {
    return new Date()
      .toISOString()
      .replace(/\D/g, "")
      .slice(0, 14);
  }

  return value
    .replace(/\D/g, "")
    .slice(0, 14);
}

function formatDate(value?: string): string {
  if (!value) return "";

  return value
    .replace(/\D/g, "")
    .slice(0, 8);
}

function buildMsh(
  request: CanonicalLabRequest
): string {
  return [
    "MSH",
    "^~\\&",
    "RLT",
    request.requester?.organisationCode || "RLT001",
    "MOLIS",
    request.laboratory?.organisationCode || "LAB001",
    formatTimestamp(request.requestedAt),
    "",
    "OML^O21",
    escapeHl7(request.requestId),
    "P",
    "2.5"
  ].join("|");
}

function buildPid(
  request: CanonicalLabRequest
): string {
  const patient = request.patient;

  const patientName = [
    escapeHl7(patient.lastName),
    escapeHl7(patient.firstName)
  ].join("^");

  const nhsIdentifier =
    `${escapeHl7(patient.nhsNumber)}^^^NHS`;

  return [
    "PID",
    "1",
    "",
    nhsIdentifier,
    "",
    patientName,
    "",
    formatDate(patient.dateOfBirth),
    patient.gender
      ? patient.gender.charAt(0).toUpperCase()
      : ""
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
  const test = request.test;

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
  const specimen = request.specimen;

  const code = specimen.code || "";
  const display = specimen.type || "";

  return [
    "SPM",
    "1",
    "",
    "",
    `${escapeHl7(code)}^${escapeHl7(display)}`
  ].join("|");
}

export function canonicalToHL7(
  request: CanonicalLabRequest
): string {
  if (!request) {
    throw new Error("Canonical lab request is required");
  }

  if (!request.requestId) {
    throw new Error("Canonical requestId is required");
  }

  if (!request.patient) {
    throw new Error("Canonical patient is required");
  }

  if (!request.patient.nhsNumber) {
    throw new Error("Canonical NHS number is required");
  }

  if (!request.test) {
    throw new Error("Canonical test is required");
  }

  if (!request.test.code) {
    throw new Error("Canonical test code is required");
  }

  if (!request.specimen) {
    throw new Error("Canonical specimen is required");
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
