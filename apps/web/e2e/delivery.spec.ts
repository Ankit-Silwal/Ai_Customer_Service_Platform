import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

test("delivery storefront, worker dispatch, refund approval and human support across real sessions", async ({
  page,
  browser,
}) => {
  test.setTimeout(150000);
  const unique = randomUUID().slice(0, 8),
    password = "Delivery-browser-password-123";
  const registration = await page.request.post("/api/auth/register", {
    data: {
      name: "Demo Administrator",
      company: "Parcel Studio " + unique,
      email: `delivery-admin-${unique}@example.test`,
      password,
    },
  });
  expect(registration.status()).toBe(201);
  await page.goto("/delivery");
  await page
    .getByRole("button", { name: "Launch for Parcel Studio " + unique })
    .click();
  await expect(
    page.getByRole("heading", { name: /Your daily dose/ }),
  ).toBeVisible();
  const storeUrl = page.url(),
    storeId = new URL(storeUrl).pathname.split("/")[2]!;
  await page.getByRole("button", { name: "Prepare demo", exact: true }).click();
  await expect(
    page.getByText("Your delivery demo, connected to Relay.", { exact: true }),
  ).not.toBeVisible({ timeout: 45000 });
  await mkdir(resolve("../../.platform-logs"), { recursive: true });
  await page.screenshot({
    path: resolve("../../.platform-logs/delivery-desktop.png"),
    fullPage: true,
  });
  await writeFile(
    resolve("../../.platform-logs/delivery-demo-url.txt"),
    storeUrl,
  );
  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();
  await customer.goto(storeUrl);
  await customer.getByRole("button", { name: "Sign in", exact: true }).click();
  await customer
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await customer.getByLabel("Your name", { exact: true }).fill("Maya Customer");
  await customer
    .getByLabel("Email address", { exact: true })
    .fill(`customer-${unique}@example.test`);
  await customer.getByLabel("Password", { exact: true }).fill(password);
  await customer
    .getByRole("button", { name: "Create customer account", exact: true })
    .click();
  await expect(customer.getByRole("dialog")).not.toBeVisible();
  await customer
    .getByRole("button", { name: "Add The green goddess", exact: true })
    .click();
  await customer.getByRole("button", { name: "Open basket, 1 items" }).click();
  await customer
    .getByLabel("Delivery address", { exact: true })
    .fill("12 Willow Road, Garden District");
  await customer
    .getByLabel(/Delivery instructions/)
    .fill("Please ring the bell.");
  await customer
    .getByRole("button", { name: "Place demo order", exact: true })
    .click();
  await expect(
    customer.getByRole("heading", { name: "Your little deliveries." }),
  ).toBeVisible();
  await expect(customer.locator(".delivery-order")).toHaveCount(1);
  await expect(customer.locator(".order-food")).toContainText("$18.00");
  await customer
    .getByRole("button", { name: "Get support", exact: true })
    .click();
  await customer
    .getByLabel("Your message")
    .fill("What is the late delivery refund policy?");
  await customer
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(customer.locator(".citation")).toBeVisible();
  await customer.getByRole("button", { name: /Prefer a person/ }).click();
  await expect(
    customer.getByText("Waiting for a teammate", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await expect(page.locator(".support-queue>button")).toHaveCount(1);
  await page.locator(".support-queue>button").click();
  await page
    .getByRole("button", { name: "Join conversation", exact: true })
    .click();
  await page
    .getByLabel("Reply as agent")
    .fill("Hi Maya, I have your order here. I can help personally.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    customer.getByText(
      "Hi Maya, I have your order here. I can help personally.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    customer.getByText("Connected to a person", { exact: true }),
  ).toBeVisible();
  await customer.screenshot({
    path: resolve("../../.platform-logs/delivery-handoff.png"),
    fullPage: true,
  });
  await customer
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  const workerContext = await browser.newContext();
  const worker = await workerContext.newPage();
  const workerEmail = `worker-${unique}@example.test`;
  const workerRegistration = await worker.request.post(
    `/api/delivery/stores/${storeId}/register`,
    { data: { name: "Alex Courier", email: workerEmail, password } },
  );
  expect(workerRegistration.status()).toBe(201);
  await page.getByRole("button", { name: "Team", exact: true }).click();
  await page.getByLabel("Email address", { exact: true }).fill(workerEmail);
  await page.getByRole("button", { name: "Update role", exact: true }).click();
  await expect(
    page.getByText("Delivery role updated.", { exact: true }),
  ).toBeVisible();
  await worker.goto(storeUrl);
  await expect(
    worker.getByRole("heading", { name: "Your delivery desk." }),
  ).toBeVisible();
  const delivery = worker
    .locator(".dispatch-card")
    .filter({ hasText: "Maya Customer" });
  await delivery
    .getByRole("button", { name: "Start preparing", exact: true })
    .click();
  await delivery
    .getByRole("button", { name: "Out for delivery", exact: true })
    .click();
  await delivery
    .getByRole("button", { name: "Mark delivered", exact: true })
    .click();
  await expect(customer.locator(".order-top .d-status")).toHaveText(
    "Delivered",
    { timeout: 15000 },
  );
  await customer
    .getByRole("button", { name: "Check refund eligibility", exact: true })
    .click();
  await customer.getByLabel("What happened?").selectOption("missing");
  await customer
    .getByLabel("Tell us a little more")
    .fill("The side of crispy chickpeas was missing from my bowl.");
  await customer
    .getByRole("button", { name: "Check my refund", exact: true })
    .click();
  await expect(customer.getByRole("dialog")).not.toBeVisible({
    timeout: 45000,
  });
  await expect(
    customer.getByText("A teammate should review", { exact: true }),
  ).toBeVisible();
  await customer.getByText("Policy source preview", { exact: true }).click();
  await expect(customer.locator(".refund-result blockquote")).toContainText(
    "Parcel & Plate refund policy.pdf",
  );
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await expect(page.locator(".refund-review")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Approve $18.00", exact: true })
    .click();
  await page
    .getByLabel("Review note", { exact: true })
    .fill(
      "Verified the missing item with the kitchen. Approved under policy R2.",
    );
  await page
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await expect(
    customer.getByText(
      "Verified the missing item with the kitchen. Approved under policy R2.",
      { exact: false },
    ),
  ).toBeVisible({ timeout: 15000 });
  await page.screenshot({
    path: resolve("../../.platform-logs/delivery-admin.png"),
    fullPage: true,
  });
  await customer.setViewportSize({ width: 390, height: 844 });
  await customer.getByRole("button", { name: "Discover", exact: true }).click();
  await customer.screenshot({
    path: resolve("../../.platform-logs/delivery-mobile.png"),
    fullPage: true,
  });
  expect(
    await customer.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await customer.getByLabel("Search menu").fill("doesnotexist");
  await expect(
    customer.getByRole("heading", { name: "No dishes found" }),
  ).toBeVisible();
  await worker.setViewportSize({ width: 390, height: 844 });
  expect(
    await worker.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const pdf = await page.request.get("/api/delivery/policy.pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  await customerContext.close();
  await workerContext.close();
});
