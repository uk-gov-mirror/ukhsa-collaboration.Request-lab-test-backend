const canonicalRequest = {
  requestId: "RLT-10001",
  patient: {
    nhsNumber: "9999999999",
    firstName: "John",
    lastName: "Smith",
    dateOfBirth: "1975-03-12",
    gender: "male"
  },
  requester: {
    practitionerId: "PRACT-001",
    name: "Dr John Doe",
    organisationCode: "RLT001"
  },
  laboratory: {
    organisationCode: "LAB001",
    name: "MOLIS Laboratory"
  },
  test: {
    code: "43396009",
    display: "Haemoglobin A1c measurement",
    system: "http://snomed.info/sct"
  },
  specimen: {
    type: "Venous blood specimen",
    code: "122555007",
    system: "http://snomed.info/sct"
  },
  clinicalInformation: "Routine diabetes monitoring",
  requestedAt: "2026-09-03T07:00:00Z"
};

async function main() {
  const response = await fetch(
    "http://localhost:4006/hl7v2/from-canonical",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        request: canonicalRequest
      })
    }
  );

  const body = await response.json();

  console.log("HTTP status:", response.status);
  console.log(JSON.stringify(body, null, 2));

  if (!response.ok) {
    process.exit(1);
  }

  const message = body.message;

  const segments = message
    .split(/\r\n|\r|\n/)
    .map(segment => segment.trim())
    .filter(Boolean);

  const requiredSegments = ["MSH", "PID", "ORC", "OBR", "SPM"];

  for (const segmentType of requiredSegments) {
    if (!segments.some(segment => segment.startsWith(`${segmentType}|`))) {
      throw new Error(`Missing ${segmentType}| segment`);
    }
  }

  console.log("✓ MSH segment present");
  console.log("✓ PID segment present");
  console.log("✓ ORC segment present");
  console.log("✓ OBR segment present");
  console.log("✓ SPM segment present");

  console.log("\nCANONICAL → HL7 v2 TEST SUCCESSFUL");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
