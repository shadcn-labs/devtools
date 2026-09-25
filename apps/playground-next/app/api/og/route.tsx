import { ImageResponse } from "next/og";

export const GET = (request: Request) => {
  const title =
    new URL(request.url).searchParams.get("title")?.slice(0, 80) ??
    "Shadcn Labs";
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#fafafa",
        color: "#09090b",
        display: "flex",
        fontSize: 96,
        fontWeight: 700,
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      {title}
    </div>,
    { height: 630, width: 1200 }
  );
};
