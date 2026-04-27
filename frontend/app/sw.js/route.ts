import { createSerwistRoute } from "@serwist/turbopack";
import path from "path";

const { GET: serwistGET } = createSerwistRoute({
  swSrc: path.join(process.cwd(), "app/sw.ts"),
  globDirectory: path.join(process.cwd(), "public"),
});

export const GET = async (request: Request) => {
  return serwistGET(request, { params: Promise.resolve({ path: "sw.js" }) });
};

export const generateStaticParams = async () => {
  return [{ path: "sw.js" }];
};
