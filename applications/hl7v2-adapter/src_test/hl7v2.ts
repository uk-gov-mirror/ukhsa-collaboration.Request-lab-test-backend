export function fhirToHL7(
  bundle: any
): string {

  if (
    !bundle ||
    bundle.resourceType !== "Bundle"
  ) {
    throw new Error(
      "Expected FHIR Bundle"
    );
  }

  const resources =
    bundle.entry?.map(
      (entry: any) => entry.resource
    ) ?? [];

  const patient =
    resources.find(
      (r: any) =>
        r.resourceType === "Patient"
    );

  const serviceRequest =
    resources.find(
      (r: any) =>
        r.resourceType === "ServiceRequest"
    );

  const specimen =
    resources.find(
      (r: any) =>
        r.resourceType === "Specimen"
    );

  const observation =
    resources.find(
      (r: any) =>
        r.resourceType === "Observation"
    );

  const patientIdentifier =
    patient?.identifier?.find(
      (id: any) =>
        id.system ===
        "https://fhir.nhs.uk/Id/nhs-number"
    )?.value ??
    patient?.identifier?.[0]?.value ??
    "";

  const family =
    patient?.name?.[0]?.family ?? "";

  const given =
    patient?.name?.[0]?.given?.[0] ?? "";

  const dob =
    patient?.birthDate?.replace(/-/g, "") ??
    "";

  const gender =
    patient?.gender ?? "";

  const testCoding =
    serviceRequest?.code?.coding?.[0];

  const testCode =
    testCoding?.code ?? "";

  const testDisplay =
    testCoding?.display ?? "";

  const requestId =
    serviceRequest?.identifier?.[0]?.value ??
    serviceRequest?.id ??
    crypto.randomUUID();

  const specimenType =
    specimen?.type?.coding?.[0] ??
    specimen?.type?.text;

  const segments: string[] = [];

  segments.push(
    [
      "MSH",
      "^~\\&",
      "RLT",
      "RLT001",
      "MOLIS",
      "LAB001",
      formatHL7Date(new Date()),
      "",
      "OML^O21",
      requestId,
      "P",
      "2.5"
    ].join("|")
  );

  segments.push(
    [
      "PID",
      "1",
      "",
      `${patientIdentifier}^^^NHS`,
      "",
      `${family}^${given}`,
      "",
      dob,
      gender
    ].join("|")
  );

  segments.push(
    [
      "ORC",
      "NW",
      requestId
    ].join("|")
  );

  segments.push(
    [
      "OBR",
      "1",
      requestId,
      "",
      `${testCode}^${testDisplay}`
    ].join("|")
  );

  if (specimenType) {

    const typeCode =
      specimenType.code ?? "";

    const typeDisplay =
      specimenType.display ??
      specimenType.text ??
      "";

    segments.push(
      [
        "SPM",
        "1",
        "",
        "",
        `${typeCode}^${typeDisplay}`
      ].join("|")
    );
  }

  if (observation) {

    const valueQuantity =
      observation.valueQuantity;

    let value =
      valueQuantity?.value ??
      observation.valueString ??
      "";

    const unit =
      valueQuantity?.unit ?? "";

    const referenceRange =
      observation.referenceRange?.[0];

    let range = "";

    if (
      referenceRange?.low?.value !== undefined &&
      referenceRange?.high?.value !== undefined
    ) {
      range =
        `${referenceRange.low.value}-${referenceRange.high.value}`;
    }

    const interpretation =
      observation.interpretation?.[0]?.text ??
      "";

    const status =
      observation.status === "final"
        ? "F"
        : "";

    segments.push(
      [
        "OBX",
        "1",
        typeof value === "number"
          ? "NM"
          : "ST",
        `${testCode}^${testDisplay}`,
        "",
        value,
        unit,
        range,
        interpretation,
        "",
        "",
        status
      ].join("|")
    );
  }

  return segments.join("\r") + "\r";
}

function formatHL7Date(
  date: Date
): string {

  const pad =
    (value: number) =>
      value.toString().padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}