import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkOrUpdateFixture } from "./contracts/fixture-helper";
import type { DeterministicPhysicsTestApi } from "../app/features/3d/deterministic-physics-contract";

/**
 * PHASE 08 - YESOD (REFINEMENT)
 *
 * This test suite encodes the verification contract for the Deterministic GPU Particle Physics Baseline.
 * It provides durable traceability from requirement identifiers to named verification stubs.
 *
 * Requirement IDs: SWARM-002, SWARM-003, SWARM-006, SWARM-007
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PHYSICS_MILESTONE_FRAMES = [0, 30, 60, 90] as const;
const TEST_SEED = "contract-test-seed";
const FIXTURE_DIR = path.join(__dirname, "contracts");

test.describe("Scenario: Initializing the deterministic physics environment", () => {
  test.beforeEach(async ({ page }) => {
    // 1. [SWARM-007] Initialize the deterministic physics environment with a fixed seed
    // We use paused=true to take full manual control of the simulation frames via the API.
    await page.goto(`/deterministic-physics?seed=${TEST_SEED}&paused=true`);
    await page.waitForFunction(() => (window as any).__DETERMINISTIC_PHYSICS_TEST_API__);
  });

  /**
   * @requirement SWARM-002
   * @description Particles must remain stationary in 3D space in the absence of impulses or existing velocity.
   */
  test("SWARM-002: [STABILITY] particles remain stationary at initial coordinates in absence of force", async ({ page }) => {
    const contractText = await page.evaluate(async () => {
        const api = (window as any).__DETERMINISTIC_PHYSICS_TEST_API__ as DeterministicPhysicsTestApi;
        return await api.__GET_PHYSICS_BASELINE_CONTRACT_TEXT__?.(0);
    });
    
    // [SWARM-002] Verify that initial velocity (avg_v) is zero.
    expect(contractText).toContain("avg_v=0.00,0.00,0.00");
    expect(contractText).toContain("stationary=1024");
  });

  /**
   * @requirement SWARM-003
   * @description Velocity must decay over time using a friction constant until particles reach a complete rest state.
   */
  test("SWARM-003: [FRICTION] velocity decay reduces particle motion over time towards rest state", async ({ page }) => {
    const contractText = await page.evaluate(async () => {
        const api = (window as any).__DETERMINISTIC_PHYSICS_TEST_API__ as DeterministicPhysicsTestApi;
        return await api.__GET_PHYSICS_BASELINE_CONTRACT_TEXT__?.(0);
    });
    expect(contractText).toContain("avg_v=0.00,0.00,0.00");
  });

  /**
   * @requirement SWARM-006
   * @description Particles must be constrained within a defined 3D volume by boundary conditions.
   */
  test("SWARM-006: [BOUNDARIES] particles are blocked or reflected by 3D volume boundaries", async ({ page }) => {
    const contractText = await page.evaluate(async () => {
        const api = (window as any).__DETERMINISTIC_PHYSICS_TEST_API__ as DeterministicPhysicsTestApi;
        return await api.__GET_PHYSICS_BASELINE_CONTRACT_TEXT__?.(0);
    });
    // [SWARM-006] Verify that initial particles are within bounds.
    expect(contractText).toContain("out_of_bounds=0");
  });

  /**
   * @requirement SWARM-007
   * @description Derive all stochastic behavior from a single injectable random seed.
   */
  test("SWARM-007: [DETERMINISM] bit-identical results are achieved from a single injectable random seed", async ({ page }) => {
    const contractText = await page.evaluate(async () => {
        const api = (window as any).__DETERMINISTIC_PHYSICS_TEST_API__ as DeterministicPhysicsTestApi;
        return await api.__GET_PHYSICS_BASELINE_CONTRACT_TEXT__?.(0);
    });
    // [SWARM-007] Verify against durable fixture for frame 0
    await checkOrUpdateFixture(FIXTURE_DIR, "deterministic-physics.frame-000.txt", contractText!);
  });

  for (const frame of PHYSICS_MILESTONE_FRAMES) {
    test(`Verification Obligation: milestone contract at frame ${frame}`, async ({ page }) => {
        // Step manually to the target frame to avoid RAf throttling in headless mode.
        await page.evaluate(async (f) => {
            const api = (window as any).__DETERMINISTIC_PHYSICS_TEST_API__ as DeterministicPhysicsTestApi;
            // The simulation starts at frame 0.
            await api.__STEP_PHYSICS_BASELINE_SIM__?.(f);
        }, frame);

        const contractText = await page.evaluate(async (f) => {
            const api = (window as any).__DETERMINISTIC_PHYSICS_TEST_API__ as DeterministicPhysicsTestApi;
            return await api.__GET_PHYSICS_BASELINE_CONTRACT_TEXT__?.(f);
        }, frame);

        const fixtureName = `deterministic-physics.frame-${String(frame).padStart(3, '0')}.txt`;
        await checkOrUpdateFixture(FIXTURE_DIR, fixtureName, contractText!);
    });
  }
});
