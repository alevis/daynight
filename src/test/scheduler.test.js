"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getActiveSchedule,
  parseTimeString,
  validateSchedules
} = require("../scheduler");

test("parseTimeString accepts 24-hour times", () => {
  assert.equal(parseTimeString("00:15"), 15);
  assert.equal(parseTimeString("18:45"), 1125);
});

test("parseTimeString accepts 12-hour times", () => {
  assert.equal(parseTimeString("12 AM"), 0);
  assert.equal(parseTimeString("12:30 PM"), 750);
  assert.equal(parseTimeString("6:05 pm"), 1085);
});

test("getActiveSchedule matches overnight ranges", () => {
  const schedules = [
    { enabled: true, start: "22:00", end: "06:00", theme: "Night Owl" }
  ];

  const active = getActiveSchedule(
    schedules,
    new Date("2026-03-25T23:30:00")
  );

  assert.equal(active.theme, "Night Owl");
});

test("validateSchedules rejects overlap", () => {
  const result = validateSchedules([
    { enabled: true, start: "08:00", end: "12:00", theme: "Light" },
    { enabled: true, start: "11:00", end: "14:00", theme: "Dark" }
  ]);

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /overlap/i);
});

test("validateSchedules normalizes valid entries", () => {
  const result = validateSchedules([
    { enabled: true, start: "6:00 AM", end: "6:00 PM", theme: "Solarized Light" }
  ]);

  assert.equal(result.ok, true);
  assert.deepEqual(result.schedules[0], {
    id: "slot-1",
    enabled: true,
    start: "06:00",
    end: "18:00",
    theme: "Solarized Light"
  });
});
