import { describe, expect, it } from "vitest";
import { computeBackoffSeconds } from "./retry";

describe("computeBackoffSeconds", () => {
  it("FIXED always waits the same delay regardless of attempt number", () => {
    expect(computeBackoffSeconds("FIXED", 1, 30, 3600)).toBe(30);
    expect(computeBackoffSeconds("FIXED", 5, 30, 3600)).toBe(30);
  });

  it("LINEAR grows proportionally to the attempt number", () => {
    expect(computeBackoffSeconds("LINEAR", 1, 30, 3600)).toBe(30);
    expect(computeBackoffSeconds("LINEAR", 2, 30, 3600)).toBe(60);
    expect(computeBackoffSeconds("LINEAR", 3, 30, 3600)).toBe(90);
  });

  it("EXPONENTIAL doubles each attempt", () => {
    expect(computeBackoffSeconds("EXPONENTIAL", 1, 30, 3600)).toBe(30);
    expect(computeBackoffSeconds("EXPONENTIAL", 2, 30, 3600)).toBe(60);
    expect(computeBackoffSeconds("EXPONENTIAL", 3, 30, 3600)).toBe(120);
    expect(computeBackoffSeconds("EXPONENTIAL", 4, 30, 3600)).toBe(240);
  });

  it("caps the delay at maxDelaySeconds for all strategies", () => {
    expect(computeBackoffSeconds("EXPONENTIAL", 10, 30, 3600)).toBe(3600);
    expect(computeBackoffSeconds("LINEAR", 1000, 30, 500)).toBe(500);
    expect(computeBackoffSeconds("FIXED", 1, 5000, 3600)).toBe(3600);
  });
});
