import type { MolisOrder } from "./types.js";

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
  order: MolisOrder
): string {

  const messageControlId =
    `MOLIS-${order.accessionNumber}`;

  return [
    "MSH",
    "^~\\&",
    "MOLIS",
    order.laboratory?.organisationCode || "LAB001",
    "RLT",
    order.requester?.organisationCode || "RLT001",
    formatTimestamp(order.result?.issuedAt),
    "",
    "ORU^R01",
    messageControlId,
    "P",
    "2.5"
  ].join("|");
}

function buildPid(
  order: MolisOrder
): string {

  const patient =
    order.patient;

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
    formatDate(patient.dateOfBirth)
  ].join("|");
}

function buildOrc(
  order: MolisOrder
): string {

  return [
    "ORC",
    "RE",
    escapeHl7(order.requestId),
    escapeHl7(order.accessionNumber)
  ].join("|");
}

function buildObr(
  order: MolisOrder
): string {

  const test =
    order.test;

  return [
    "OBR",
    "1",
    escapeHl7(order.requestId),
    escapeHl7(order.accessionNumber),
    `${escapeHl7(test.code)}^${escapeHl7(test.display)}`
  ].join("|");
}

function buildObx(
  order: MolisOrder
): string {

  const result =
    order.result;

  if (!result) {
    throw new Error(
      "MOLIS result is not available"
    );
  }

  const resultCode =
    "999791000000106";

  const resultDisplay =
    "Haemoglobin A1c level - IFCC standardised";

  const valueType =
    typeof result.value === "number"
      ? "NM"
      : "ST";

  const referenceRange =
    result.referenceRange
      ? `${result.referenceRange.low ?? ""}-${result.referenceRange.high ?? ""}`
      : "";

  const abnormalFlag =
    result.interpretation === "ABNORMAL"
      ? "H"
      : "";

  return [
    "OBX",
    "1",
    valueType,
    `${resultCode}^${resultDisplay}`,
    "",
    escapeHl7(String(result.value)),
    escapeHl7(result.unit),
    escapeHl7(referenceRange),
    abnormalFlag,
    "",
    "",
    "F",
    "",
    formatTimestamp(result.issuedAt)
  ].join("|");
}

export function resultToHL7V2(
  order: MolisOrder
): string {

  if (!order) {
    throw new Error(
      "MOLIS order is required"
    );
  }

  if (
    order.status !==
    "RESULT_AVAILABLE"
  ) {
    throw new Error(
      `Result is not available for order ${order.accessionNumber}`
    );
  }

  if (!order.result) {
    throw new Error(
      `No result found for order ${order.accessionNumber}`
    );
  }

  const segments = [
    buildMsh(order),
    buildPid(order),
    buildOrc(order),
    buildObr(order),
    buildObx(order)
  ];

  return segments.join("\r");
}