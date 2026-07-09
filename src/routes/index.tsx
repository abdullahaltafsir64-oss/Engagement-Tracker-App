import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Apparel Ops Global — Ops Hub" },
      {
        name: "description",
        content:
          "Task board, timeline, meetings, and activity tracker for the Apparel Ops Global course launch team.",
      },
      { property: "og:title", content: "Apparel Ops Global — Ops Hub" },
      {
        property: "og:description",
        content:
          "Task board, timeline, meetings, and activity tracker for the Apparel Ops Global course launch team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace("/hub.html");
  }, []);
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F7F5F0",
        color: "#12181B",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <p>Loading Ops Hub…</p>
    </div>
  );
}
