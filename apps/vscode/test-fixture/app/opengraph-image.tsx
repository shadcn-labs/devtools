import { ImageResponse } from "next/og";

export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

const Image = () => new ImageResponse(<div>Fixture</div>, size);

export default Image;
