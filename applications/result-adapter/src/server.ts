import Fastify from "fastify";
import cors from "@fastify/cors";

import {
  mapFhirResultToCanonical
} from "./mapper.js";

import {
  buildFhirResultBundle
} from "./fhir-result.js";

import {
  buildPathologyDocument
} from "./document-bundle.js";

import {
  validateFhirBundle
} from "./validator.js";

const app =
  Fastify({
    logger: true
  });


await app.register(cors, {
  origin: true
});


// ==================================================
// HEALTH
// ==================================================

app.get(
  "/health",
  async () => {

    return {

      status: "UP",

      service:
        "rlt-result-adapter"
    };
  }
);


// ==================================================
// FHIR → CANONICAL
// ==================================================

app.post<{
  Body: any;
}>(
  "/results/from-fhir",
  async (
    request,
    reply
  ) => {

    try {

      const bundle =
        request.body;


      const result =
        mapFhirResultToCanonical(
          bundle
        );


      return reply
        .code(200)
        .send({

          status:
            "CONVERTED",

          result
        });

    } catch (error) {

      request.log.error(
        error
      );


      return reply
        .code(422)
        .send({

          status:
            "RESULT_MAPPING_ERROR",

          message:
            error instanceof Error
              ? error.message
              : "Unable to map FHIR result"

        });
    }
  }
);


// ==================================================
// CANONICAL RESULT → FHIR
// ==================================================

app.post<{
  Body: any;
}>(
  "/results/to-fhir",
  async (
    request,
    reply
  ) => {

    try {

      const canonicalResult =
        request.body;
    
      console.log("\n==============================");
      console.log("CANONICAL RESULT");
      console.log("==============================");
      console.log(JSON.stringify(canonicalResult, null, 2));


      if (
        !canonicalResult
      ) {

        return reply
          .code(400)
          .send({

            status:
              "INVALID_REQUEST",

            message:
              "Canonical result is required"

          });
      }


      const bundle =
        buildFhirResultBundle(
          canonicalResult
        );


      return reply
        .code(201)
        .send({

          status:
            "FHIR_CREATED",

          fhir:
            bundle

        });

    } catch (error) {

      request.log.error(
        error
      );


      return reply
        .code(422)
        .send({

          status:
            "FHIR_RESULT_MAPPING_ERROR",

          message:
            error instanceof Error
              ? error.message
              : "Unable to create FHIR result"

        });
    }
  }
);


// ==================================================
// CANONICAL RESULT → PATHOLOGY DOCUMENT BUNDLE
// ==================================================

app.post<{
  Body: any;
}>(
  "/results/to-document",
  async (
    request,
    reply
  ) => {

    try {

      const canonicalResult =
        request.body;


      if (!canonicalResult) {

        return reply
          .code(400)
          .send({

            status:
              "INVALID_REQUEST",

            message:
              "Canonical result is required"

          });
      }


      const bundle =
        buildPathologyDocument(
          canonicalResult
        );


      return reply
        .code(201)
        .send({
          status:
            "DOCUMENT_CREATED",
          document:
            bundle

        });

    } catch (error) {

      request.log.error(
        error
      );


      return reply
        .code(422)
        .send({

          status:
            "DOCUMENT_MAPPING_ERROR",

          message:
            error instanceof Error
              ? error.message
              : "Unable to create document"

        });
    }
  }
);

app.post<{ Body: any }>(
  "/results/validate",
  async (request, reply) => {

    try {

      const bundle = request.body;

      if (!bundle) {

        return reply
          .code(400)
          .send({
            status: "INVALID_REQUEST",
            message:
              "FHIR Bundle is required"
          });

      }

      if (
        bundle.resourceType !==
        "Bundle"
      ) {

        return reply
          .code(400)
          .send({
            status: "INVALID_FHIR",
            message:
              "FHIR Bundle resource is required"
          });

      }

      const validation =
        await validateFhirBundle(
          bundle
        );

      return reply
        .code(
          validation.valid
            ? 200
            : 422
        )
        .send({
          status:
            validation.valid
              ? "FHIR_VALID"
              : "FHIR_INVALID",

          valid:
            validation.valid,

          issues:
            validation.issues,

          raw:
            validation.raw
        });

    } catch (error: any) {

      request.log.error(error);

      return reply
        .code(500)
        .send({
          status:
            "FHIR_VALIDATION_ERROR",

          message:
            error?.message ??
            "Unable to validate FHIR Bundle"
        });

    }

  }
);


// ==================================================
// START
// ==================================================

try {

  await app.listen({

    port:
      4003,

    host:
      "0.0.0.0"
  });


  console.log(
    "Result Adapter running on http://localhost:4003"
  );

} catch (error) {

  app.log.error(
    error
  );

  process.exit(1);
}