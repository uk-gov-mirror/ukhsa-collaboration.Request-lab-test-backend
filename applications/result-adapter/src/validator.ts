import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

const VALIDATOR_JAR =
  process.env.FHIR_VALIDATOR_JAR ??
  "../tools/fhir-validator/validator_cli.jar";

const FHIR_VERSION = "4.0.1";

const PATHOLOGY_IG =
  process.env.PATHOLOGY_FHIR_IG ??
  "fhir.r4.nhsengland.pathology#0.3.1-alpha";

export interface FhirValidationIssue {
  severity?: string;
  code?: string;
  diagnostics?: string;
  location?: string[];
}

export interface FhirValidationResult {
  valid: boolean;
  issues: FhirValidationIssue[];
  raw: string;
}

export async function validateFhirBundle(
  bundle: unknown
): Promise<FhirValidationResult> {

  const workingDirectory = await mkdtemp(
    path.join(tmpdir(), "rlt-fhir-validation-")
  );

  const inputFile = path.join(
    workingDirectory,
    "bundle.json"
  );

  const outputFile = path.join(
    workingDirectory,
    "validation.json"
  );

  try {

    await writeFile(
      inputFile,
      JSON.stringify(bundle, null, 2),
      "utf8"
    );

    const args = [
      inputFile,
      "-version",
      FHIR_VERSION,
      "-ig",
      PATHOLOGY_IG,
      "-output",
      outputFile
    ];

    let stdout = "";
    let stderr = "";

    try {

      const result = await execFileAsync(
        "java",
        [
          "-jar",
          VALIDATOR_JAR,
          ...args
        ],
        {
          maxBuffer: 10 * 1024 * 1024
        }
      );

      stdout = result.stdout;
      stderr = result.stderr;

      const raw =
        `${stdout}\n${stderr}`.trim();

        if (hasValidatorStartupFailure(raw)) {
            return {
                valid: false,
                issues: [
                {
                    severity: "error",
                    code: "validator-startup",
                    diagnostics:
                    "FHIR validation could not be completed because the requested Implementation Guide could not be loaded."
                }
                ],
                raw
            };
        }

    } catch (error: any) {

      stdout = error?.stdout ?? "";
      stderr = error?.stderr ?? "";

    }

    let issues: FhirValidationIssue[] = [];

    try {

      const validationJson =
        await import("node:fs/promises")
          .then(fs =>
            fs.readFile(outputFile, "utf8")
          );

      const parsed =
        JSON.parse(validationJson);

      issues =
        extractIssues(parsed);

    } catch {
      issues =
        parseIssuesFromText(
          `${stdout}\n${stderr}`
        );
    }

    const hasErrors =
      issues.some(
        issue =>
          issue.severity === "error"
      );

    return {
      valid: !hasErrors,
      issues,
      raw: `${stdout}\n${stderr}`.trim()
    };

  } finally {

    await rm(
      workingDirectory,
      {
        recursive: true,
        force: true
      }
    );

  }
}


function extractIssues(
  value: any
): FhirValidationIssue[] {

  if (!value) {
    return [];
  }

  if (
    Array.isArray(value.issue)
  ) {
    return value.issue;
  }

  if (
    value.resourceType === "OperationOutcome" &&
    Array.isArray(value.issue)
  ) {
    return value.issue;
  }

  if (Array.isArray(value)) {

    return value.flatMap(
      extractIssues
    );

  }

  return [];
}


function parseIssuesFromText(
  text: string
): FhirValidationIssue[] {

  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => ({
      severity:
        line.toLowerCase().includes("error")
          ? "error"
          : line.toLowerCase().includes("warning")
            ? "warning"
            : "information",

      diagnostics: line
    }));

}

function hasValidatorStartupFailure(
  text: string
): boolean {
  const failurePatterns = [
    "Unable to resolve package id",
    "Unable to load validationEngine",
    "Error loading ImplementationGuide",
    "Failed to load ImplementationGuide",
    "Cannot load ImplementationGuide",
    "Exception:"
  ];

  return failurePatterns.some(pattern =>
    text.includes(pattern)
  );
}