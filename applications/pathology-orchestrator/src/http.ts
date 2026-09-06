export async function getJson<T>(
  url: string
): Promise<T> {

  const response =
    await fetch(url);


  const body =
    await response.text();


  let data: unknown;

  try {

    data =
      body
        ? JSON.parse(body)
        : undefined;

  } catch {

    data = body;

  }


  if (!response.ok) {

    throw new Error(

      `HTTP ${response.status}: ` +
      `${typeof data === "string"
        ? data
        : JSON.stringify(data)}`

    );

  }


  return data as T;
}


export async function postJson<T>(
  url: string,
  body: unknown
): Promise<T> {

  const response =
    await fetch(

      url,

      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify(body)

      }

    );


  const responseText =
    await response.text();


  let data: unknown;

  try {

    data =
      responseText
        ? JSON.parse(responseText)
        : undefined;

  } catch {

    data =
      responseText;

  }


  if (!response.ok) {

    throw new Error(

      `HTTP ${response.status}: ` +
      `${typeof data === "string"
        ? data
        : JSON.stringify(data)}`

    );

  }


  return data as T;
}

export async function postText<T>(
  url: string,
  body: string
): Promise<T> {

  const response =
    await fetch(
      url,
      {
        method: "POST",

        headers: {
          "Content-Type": "text/plain"
        },

        body
      }
    );

  const responseText =
    await response.text();

  let data: unknown;

  try {

    data =
      responseText
        ? JSON.parse(responseText)
        : undefined;

  } catch {

    data =
      responseText;

  }

  if (!response.ok) {

    throw new Error(

      `HTTP ${response.status}: ` +
      `${typeof data === "string"
        ? data
        : JSON.stringify(data)}`

    );

  }

  return data as T;
}