import { readFile } from "node:fs/promises";
export const readDeliveryPolicy = () =>
  readFile(
    new URL("../assets/parcel-plate-refund-policy.pdf", import.meta.url),
  );
