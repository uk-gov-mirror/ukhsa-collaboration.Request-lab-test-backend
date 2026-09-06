const originalHl7 =
  "MSH|^~\\&|RLT|RLT001|MOLIS|LAB001|20260820070000||OML^O21|RLT-10001|P|2.5\r" +
  "PID|1||9999999999^^^NHS||Smith^John||19750312|M\r" +
  "ORC|NW|RLT-10001\r" +
  "OBR|1|RLT-10001||43396009^Haemoglobin A1c measurement\r" +
  "SPM|1|||122555007^Venous blood specimen\r" +
  "OBX|1|NM|43396009^Haemoglobin A1c measurement||48|mmol/mol||||F";

async function main() {
  console.log("======================================");
  console.log("HL7 v2 → FHIR → HL7 v2 ROUND TRIP");
  console.log("======================================\n");

  // --------------------------------------------------
  // STEP 1
  // HL7 v2 → FHIR
  // --------------------------------------------------

  console.log("1. Sending HL7 v2 → FHIR...\n");

  const toFhirResponse = await fetch(
    "http://localhost:4006/hl7v2/to-fhir",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: originalHl7
      })
    }
  );

  const toFhir = await toFhirResponse.json();

  if (!toFhirResponse.ok) {
    throw new Error(
      `HL7 → FHIR failed: ${JSON.stringify(toFhir)}`
    );
  }

  console.log("HL7 → FHIR successful\n");

  // --------------------------------------------------
  // STEP 2
  // FHIR → HL7
  // --------------------------------------------------

  console.log("2. Sending FHIR → HL7 v2...\n");

  const fromFhirResponse = await fetch(
    "http://localhost:4006/hl7v2/from-fhir",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fhir: toFhir.fhir
      })
    }
  );

  const fromFhir = await fromFhirResponse.json();

  if (!fromFhirResponse.ok) {
    throw new Error(
      `FHIR → HL7 failed: ${JSON.stringify(fromFhir)}`
    );
  }

  console.log("FHIR → HL7 successful\n");

  // --------------------------------------------------
  // STEP 3
  // Display result
  // --------------------------------------------------

  console.log("======================================");
  console.log("ORIGINAL HL7");
  console.log("======================================\n");

  console.log(originalHl7.replace(/\r/g, "\n"));

  console.log("\n======================================");
  console.log("FHIR");
  console.log("======================================\n");

  console.log(
    JSON.stringify(toFhir.fhir, null, 2)
  );

  console.log("\n======================================");
  console.log("ROUND-TRIPPED HL7");
  console.log("======================================\n");

  console.log(
    fromFhir.message.replace(/\r/g, "\n")
  );

  // --------------------------------------------------
  // STEP 4
  // Compare important values
  // --------------------------------------------------

  console.log("\n======================================");
  console.log("ROUND-TRIP VALIDATION");
  console.log("======================================\n");

  validateRoundTrip(
    originalHl7,
    fromFhir.message
  );
}

function parseSegments(message) {
  return message
    .split(/\r?\n|\r/)
    .filter(Boolean);
}

function getSegment(
  segments,
  segmentName
) {
  return segments.find(
    segment => segment.startsWith(segmentName + "|")
  );
}

function getField(segment, index) {
  if (!segment) return "";

  return segment.split("|")[index] || "";
}

function validateRoundTrip(
  original,
  roundTripped
) {
  const originalSegments =
    parseSegments(original);

  const newSegments =
    parseSegments(roundTripped);

  const originalPid =
    getSegment(originalSegments, "PID");

  const newPid =
    getSegment(newSegments, "PID");

  const originalOrc =
    getSegment(originalSegments, "ORC");

  const newOrc =
    getSegment(newSegments, "ORC");

  const originalObr =
    getSegment(originalSegments, "OBR");

  const newObr =
    getSegment(newSegments, "OBR");

  const originalSpm =
    getSegment(originalSegments, "SPM");

  const newSpm =
    getSegment(newSegments, "SPM");

  const originalObx =
    getSegment(originalSegments, "OBX");

  const newObx =
    getSegment(newSegments, "OBX");

  const originalObxFields =
    originalObx?.split("|") || [];

  const newObxFields =
    newObx?.split("|") || [];

  const checks = [
    {
      name: "NHS Number",
      original: getField(originalPid, 3),
      roundTripped: getField(newPid, 3)
    },
    {
      name: "Patient Name",
      original: getField(originalPid, 5),
      roundTripped: getField(newPid, 5)
    },
    {
      name: "Date of Birth",
      original: getField(originalPid, 7),
      roundTripped: getField(newPid, 7)
    },
    {
      name: "Gender",
      original: getField(originalPid, 8),
      roundTripped: getField(newPid, 8)
    },
    {
      name: "Request ID",
      original: getField(originalOrc, 2),
      roundTripped: getField(newOrc, 2)
    },
    {
      name: "Test",
      original: getField(originalObr, 4),
      roundTripped: getField(newObr, 4)
    },
    {
      name: "Specimen",
      original: getField(originalSpm, 4),
      roundTripped: getField(newSpm, 4)
    },

    // ----------------------------------
    // RESULT / OBX
    // ----------------------------------

    {
      name: "Result Code",
      original: originalObxFields[3]?.split("^")[0] || "",
      roundTripped: newObxFields[3]?.split("^")[0] || ""
    },
    {
      name: "Result Display",
      original: originalObxFields[3]?.split("^")[1] || "",
      roundTripped: newObxFields[3]?.split("^")[1] || ""
    },
    {
      name: "Result Value",
      original: originalObxFields[5] || "",
      roundTripped: newObxFields[5] || ""
    },
    {
      name: "Result Unit",
      original: originalObxFields[6] || "",
      roundTripped: newObxFields[6] || ""
    },
    {
      name: "Result Status",
      original: originalObxFields[11] || "",
      roundTripped: newObxFields[11] || ""
    }
  ];

  let passed = 0;

  for (const check of checks) {
    const success =
      check.original === check.roundTripped;

    if (success) {
      passed++;

      console.log(`✓ ${check.name}`);
    } else {
      console.log(`✗ ${check.name}`);

      console.log(
        `    Original:      ${check.original}`
      );

      console.log(
        `    Round-tripped: ${check.roundTripped}`
      );
    }
  }

  console.log(
    `\n${passed}/${checks.length} checks passed`
  );

  if (passed === checks.length) {
    console.log(
      "\n✓ ROUND TRIP SUCCESSFUL"
    );
  } else {
    console.log(
      "\n✗ ROUND TRIP HAS DATA LOSS"
    );
  }
}

main().catch(error => {
  console.error("\nROUND TRIP FAILED");
  console.error(error);
  process.exit(1);
});