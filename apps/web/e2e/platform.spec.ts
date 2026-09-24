import { test, expect } from "@playwright/test";
test("company knowledge, citations, customer chat and human takeover", async ({
  page,
  browser,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make yourself at home." }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("signup-desktop.png"),
    fullPage: true,
  });
  await page.getByLabel("Your name", { exact: true }).fill("Alex Morgan");
  await page.getByLabel("Company name", { exact: true }).fill("Northstar");
  await page
    .getByLabel("Work email", { exact: true })
    .fill("browser-" + Date.now() + "@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Browser-test-password-123");
  await page.getByRole("button", { name: "Create your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "A good day for great support." }),
  ).toBeVisible();
  await expect(page.getByLabel("Select assistant")).toContainText(
    "Northstar Assistant",
  );
  await page.screenshot({
    path: testInfo.outputPath("dashboard-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Knowledge base", exact: true })
    .click();
  await page.getByRole("button", { name: "Add sample knowledge" }).click();
  await expect(
    page.getByRole("cell", { name: "Ready", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.screenshot({
    path: testInfo.outputPath("knowledge-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Playground", exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "What is your return policy?" })
    .click();
  await expect(page.getByRole("log")).toContainText("30 days");
  await page.getByRole("button", { name: "1 source", exact: true }).click();
  await expect(page.getByRole("log")).toContainText(
    "Northstar support guide.md",
  );
  await page.screenshot({
    path: testInfo.outputPath("playground-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Prefer a person? Talk to our team" })
    .click();
  await expect(page.getByRole("log")).toContainText(
    "Automated replies are paused.",
  );
  await page.getByRole("button", { name: "Team inbox", exact: false }).click();
  await page
    .getByRole("button", { name: /What is your return policy.*Needs a person/ })
    .click();
  await page.getByRole("button", { name: "Join conversation" }).click();
  await expect(page.getByRole("log")).toContainText("A support agent joined");
  await page
    .getByLabel("Reply as agent")
    .fill("Hi, Alex here. I can help you with that return.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Hi, Alex here.");
  await page.screenshot({
    path: testInfo.outputPath("inbox-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Bot settings", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("link", { name: "Open customer chat" }),
  ).toBeVisible();
  const link = await page
    .getByRole("link", { name: "Open customer chat" })
    .getAttribute("href");
  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();
  await customer.goto(link!);
  await customer
    .getByLabel("Your message")
    .fill("How long does shipping take?");
  await customer
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(customer.getByRole("log")).toContainText("3–5 business days");
  await customer
    .getByRole("button", { name: "Prefer a person? Talk to our team" })
    .click();
  await expect(customer.getByRole("log")).toContainText(
    "Automated replies are paused.",
  );
  await page.getByRole("button", { name: "Team inbox", exact: false }).click();
  await expect(
    page.getByRole("button", {
      name: /How long does shipping take.*Needs a person/,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: /How long does shipping take.*Needs a person/,
    })
    .click();
  await page.getByRole("button", { name: "Join conversation" }).click();
  await page
    .getByLabel("Reply as agent")
    .fill("Hello from your live support team!");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(customer.getByRole("log")).toContainText(
    "Hello from your live support team!",
  );
  await customer
    .getByLabel("Your message")
    .fill("Thank you. Can you help with tracking?");
  await customer
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(page.getByRole("log")).toContainText(
    "Can you help with tracking?",
  );
  await customer.setViewportSize({ width: 390, height: 844 });
  await customer.screenshot({
    path: testInfo.outputPath("customer-mobile.png"),
    fullPage: true,
  });
  expect(
    await customer.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("dashboard-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Knowledge base", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little knowledge goes a long way." }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
  await page
    .context()
    .storageState({ path: "../../.platform-logs/browser-state.json" });
  await customerContext.close();
});
