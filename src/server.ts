import fs from "fs";
import path from "path";
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// Read firebase credentials from the config file
const firebaseConfig = {
  projectId: "ordinal-coder-zn50x",
  apiKey: "AIzaSyBkB3BbA4V_4F4HeWj0PXVrekZZhPd5oho",
  firestoreDatabaseId: "ai-studio-teamsparknest-e698f13d-4245-4c8e-9e2e-48bd3d6d92e6",
};

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    firebaseConfig.projectId = parsed.projectId || firebaseConfig.projectId;
    firebaseConfig.apiKey = parsed.apiKey || firebaseConfig.apiKey;
    firebaseConfig.firestoreDatabaseId =
      parsed.firestoreDatabaseId || firebaseConfig.firestoreDatabaseId;
  }
} catch (e) {
  console.error("Failed to read firebase config:", e);
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // Handle the collaborative real-time state API server-side
      if (url.pathname === "/api/state") {
        if (request.method === "GET") {
          try {
            const fsUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/workspaces/default?key=${firebaseConfig.apiKey}`;
            const res = await fetch(fsUrl);
            if (res.status === 404) {
              return new Response(JSON.stringify({ state: null }), {
                headers: { "Content-Type": "application/json" },
              });
            }
            if (!res.ok) {
              throw new Error(`Firestore REST returned ${res.status}: ${await res.text()}`);
            }
            const doc = await res.json();
            const stateStr = doc.fields?.state?.stringValue;
            if (!stateStr) {
              return new Response(JSON.stringify({ state: null }), {
                headers: { "Content-Type": "application/json" },
              });
            }
            return new Response(JSON.stringify({ state: JSON.parse(stateStr) }), {
              headers: { "Content-Type": "application/json" },
            });
          } catch (err: unknown) {
            console.error("Server API GET error:", err);
            const msg = err instanceof Error ? err.message : "Unknown error";
            return new Response(JSON.stringify({ error: msg }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        if (request.method === "POST" || request.method === "PUT") {
          try {
            const body = await request.json();
            const stateStr = JSON.stringify(body);
            const fsUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/workspaces/default?key=${firebaseConfig.apiKey}&updateMask.fieldPaths=state`;

            const res = await fetch(fsUrl, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fields: {
                  state: { stringValue: stateStr },
                },
              }),
            });

            if (!res.ok) {
              throw new Error(`Firestore REST returned ${res.status}: ${await res.text()}`);
            }

            return new Response(JSON.stringify({ success: true }), {
              headers: { "Content-Type": "application/json" },
            });
          } catch (err: unknown) {
            console.error("Server API POST error:", err);
            const msg = err instanceof Error ? err.message : "Unknown error";
            return new Response(JSON.stringify({ error: msg }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
