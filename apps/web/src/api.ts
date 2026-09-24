export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    credentials: "same-origin",
  });
  const body: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      typeof body === "object" && body && "error" in body
        ? String(body.error)
        : "Request failed.",
    );
  return body as T;
}
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const sampleText =
  "# Northstar customer support guide\n\nReturns and refunds\nCustomers can return unused products within 30 days of delivery. Keep the original packaging and order number. Refunds are processed to the original payment method within 5–7 business days after the returned item is received. To start a return, email support@northstar.example.\n\nShipping\nStandard shipping takes 3–5 business days. Shipping is free for orders over $75. Express shipping takes 1–2 business days and costs $12. We currently ship within the United States.\n\nSupport hours\nOur support team is available Monday through Friday, 9 AM to 6 PM Eastern Time. Ask to speak with a person in the chat to join the support queue.\n\nSubscriptions\nYou can cancel a subscription at any time from Account > Subscription > Cancel. Access remains active until the end of the current billing period. We do not charge a cancellation fee.";
export async function fileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]!);
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.readAsDataURL(file);
  });
}
