type FhirBundle = {
  resourceType: "Bundle";
  type: string;
  entry?: Array<{
    fullUrl?: string;
    resource: any;
  }>;
};

function getResource(
  bundle: FhirBundle,
  resourceType: string
): any | undefined {
  return bundle.entry?.find(
    (entry) => entry.resource?.resourceType === resourceType
  )?.resource;
}

function getCoding(resource: any) {
  return resource?.code?.coding?.[0];
}

function escapeHl7(value: string | undefined): string {
  if (!value) return "";

  return value
    .replace(/\\/g, "\\E\\")
    .replace(/\|/g, "\\F\\")
    .replace(/\^/g, "\\S\\")
    .replace(/~/g, "\\R\\")
    .replace(/&/g, "\\T\\");
}

function formatDate(date?: string): string {
  if (!date) {
    return new Date()
      .toISOString()
      .replace(/\D/g, "")
      .slice(0, 14);
  }

  return date.replace(/\D/g, "").slice(0, 14);
}

function buildMsh(bundle: FhirBundle): string {
  const messageHeader = getResource(bundle, "MessageHeader");

  const messageId =
    messageHeader?.id ||
    `RLT-${Date.now()}`;

  const timestamp = formatDate(
    messageHeader?.timestamp
  );

  return [
    "MSH",
    "^~\\&",
    "RLT",
    "RLT001",
    "MOLIS",
    "LAB001",
    timestamp,
    "",
    "OML^O21",
    messageId,
    "P",
    "2.5"
  ].join("|");
}

function buildPid(patient: any): string {
  const identifier =
    patient?.identifier?.find(
      (item: any) =>
        item.system ===
        "https://fhir.nhs.uk/Id/nhs-number"
    ) || patient?.identifier?.[0];

  const nhsNumber = identifier?.value || "";

  const name = patient?.name?.[0];

  const family = name?.family || "";
  const given = name?.given?.[0] || "";

  const dob = patient?.birthDate
    ? patient.birthDate.replace(/-/g, "")
    : "";

  const gender = patient?.gender
    ? patient.gender.charAt(0).toUpperCase()
    : "";

  return [
    "PID",
    "1",
    "",
    `${escapeHl7(nhsNumber)}^^^NHS`,
    "",
    `${escapeHl7(family)}^${escapeHl7(given)}`,
    "",
    dob,
    gender
  ].join("|");
}

function buildOrc(serviceRequest: any): string {
  const requestId =
    serviceRequest?.identifier?.[0]?.value ||
    serviceRequest?.id ||
    "";

  return [
    "ORC",
    "NW",
    escapeHl7(requestId)
  ].join("|");
}

function buildObr(serviceRequest: any): string {
  const identifier =
    serviceRequest?.identifier?.[0]?.value ||
    serviceRequest?.id ||
    "";

  const coding = getCoding(serviceRequest);

  const code = coding?.code || "";
  const display = coding?.display || "";

  return [
    "OBR",
    "1",
    escapeHl7(identifier),
    "",
    `${escapeHl7(code)}^${escapeHl7(display)}`
  ].join("|");
}

function buildSpm(specimen: any): string {
  const coding = specimen?.type?.coding?.[0];

  const code = coding?.code || "";
  const display =
    coding?.display ||
    specimen?.type?.text ||
    "";

  return [
    "SPM",
    "1",
    "",
    "",
    `${escapeHl7(code)}^${escapeHl7(display)}`
  ].join("|");
}

function buildObx(observation: any): string | null {
  if (!observation) {
    return null;
  }

  const coding = getCoding(observation);

  const code = coding?.code || "";
  const display = coding?.display || "";

  const valueQuantity = observation?.valueQuantity;

  if (!valueQuantity) {
    return null;
  }

  const value = valueQuantity.value ?? "";
  const unit =
    valueQuantity.code ||
    valueQuantity.unit ||
    "";

  return [
    "OBX",
    "1",
    "NM",
    `${escapeHl7(code)}^${escapeHl7(display)}`,
    "",
    value,
    escapeHl7(unit),
    "",
    "",
    "",
    observation?.status === "final"
      ? "F"
      : "P"
  ].join("|");
}

export function fhirToHl7(
  bundle: FhirBundle
): string {
  if (!bundle || bundle.resourceType !== "Bundle") {
    throw new Error("Expected a FHIR Bundle");
  }

  const msh = buildMsh(bundle);

  const patient = getResource(bundle, "Patient");
  const serviceRequest = getResource(
    bundle,
    "ServiceRequest"
  );
  const specimen = getResource(
    bundle,
    "Specimen"
  );
  const observation = getResource(
    bundle,
    "Observation"
  );

  const segments: string[] = [];

  segments.push(msh);

  if (patient) {
    segments.push(buildPid(patient));
  }

  if (serviceRequest) {
    segments.push(buildOrc(serviceRequest));
    segments.push(buildObr(serviceRequest));
  }

  if (specimen) {
    segments.push(buildSpm(specimen));
  }

  const obx = buildObx(observation);

  if (obx) {
    segments.push(obx);
  }

  return segments.join("\r");
}