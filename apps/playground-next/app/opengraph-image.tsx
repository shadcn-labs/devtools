import { ImageResponse } from "next/og";

export const alt = "Shadcn Labs Playground";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

const Image = () =>
  new ImageResponse(
    <div
      style={{
        background: "#09090b",
        color: "#fafafa",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        padding: 80,
        width: "100%",
      }}
    >
      <div style={{ color: "#a1a1aa", fontSize: 32 }}>Shadcn Labs</div>
      <div style={{ fontSize: 88, fontWeight: 700 }}>Playground</div>
    </div>,
    size
  );

export default Image;
