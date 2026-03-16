import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";

export async function checkOrUpdateFixture(
  fixtureDir: string,
  fixtureName: string,
  actualContent: string
) {
  const fixturePath = path.join(fixtureDir, fixtureName);

  if (process.env.UPDATE_FIXTURES === "true") {
    await mkdir(fixtureDir, { recursive: true });
    await writeFile(fixturePath, actualContent, "utf8");
    // console.log(`Updated fixture: ${fixturePath}`);
    return;
  }

  const expectedContent = await readFile(fixturePath, "utf8");
  expect(actualContent).toBe(expectedContent);
}
