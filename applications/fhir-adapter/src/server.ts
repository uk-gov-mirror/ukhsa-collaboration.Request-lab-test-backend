import Fastify from "fastify";
import cors from "@fastify/cors";

import {
  buildPathologyRequestBundle
} from "./mapper.js";

import type {
  FhirAdapterRequest
} from "./types.js";


const app = Fastify({
  logger: true
});


await app.register(cors, {
  origin: true
});


// --------------------------------------------------
// Health
// --------------------------------------------------

app.get("/health", async () => {

  return {
    status: "UP",
    service: "rlt-fhir-adapter"
  };
});


// --------------------------------------------------
// Build pathology FHIR request
// --------------------------------------------------

app.post<{
  Body: FhirAdapterRequest;
}>(
  "/fhir/requests",
  async (request, reply) => {

    try {

      const input =
        request.body;


      // --------------------------------------------
      // Basic validation
      // --------------------------------------------

      if (
        !input?.request ||
        !input?.terminology
      ) {

        return reply.code(400).send({

          status: "INVALID_REQUEST",

          message:
            "request and terminology are required"
        });
      }


      if (
        !input.terminology.test
          .palmRequestable
      ) {

        return reply.code(422).send({

          status:
            "TERMINOLOGY_INCOMPLETE",

          message:
            "PaLM requestable terminology is required"
        });
      }


      // --------------------------------------------
      // Build FHIR Bundle
      // --------------------------------------------

      const bundle =
        buildPathologyRequestBundle(input);

      
      console.log("\n==============================");
      console.log("FHIR REQUEST BUNDLE");
      console.log("==============================");
      console.log(JSON.stringify(bundle, null, 2));

      const MOLIS_URL =
        process.env.MOLIS_URL ??
        "http://localhost:4010";

      const molisResponse =
        await fetch(
            `${MOLIS_URL}/molis/orders`,
            {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(bundle)
            }
        );


        if (!molisResponse.ok) {

        const errorBody =
            await molisResponse.text();

        return reply
            .code(502)
            .send({

            status:
                "MOLIS_ERROR",

            message:
                "Fake MOLIS rejected the FHIR request",

            details:
                errorBody
            });
        }


        const molisResult = await molisResponse.json();


      // --------------------------------------------
      // Return FHIR
      // --------------------------------------------

      return reply.code(201).send({

        status: "CREATED",

        fhir: bundle,

        molis: molisResult

      });

    } catch (error) {

      request.log.error(error);

      return reply.code(500).send({

        status: "FHIR_MAPPING_ERROR",

        message:
          "Unable to create FHIR request"
      });
    }
  }
);


app.post(
  "/requests/to-fhir",
  async (
    request,
    reply
  ) => {

    try {

      const canonicalRequest =
        request.body as any;


    //   const fhirRequest =
    //     buildFhirRequest(
    //       canonicalRequest
    //     );

      const fhirRequest = buildPathologyRequestBundle(canonicalRequest);


      return reply
        .code(201)
        .send({

          status:
            "FHIR_CREATED",

          fhir:
            fhirRequest

        });

    } catch (error) {

      request.log.error(
        error
      );


      return reply
        .code(422)
        .send({

          status:
            "FHIR_MAPPING_ERROR",

          message:
            error instanceof Error
              ? error.message
              : "Unable to create FHIR request"

        });

    }

  }
);

// --------------------------------------------------
// Start
// --------------------------------------------------

try {

  await app.listen({
    port: 4002,
    host: "0.0.0.0"
  });

  console.log(
    "FHIR Adapter running on http://localhost:4002"
  );

} catch (error) {

  app.log.error(error);

  process.exit(1);
}