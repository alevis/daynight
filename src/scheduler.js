"use strict";

const MAX_SCHEDULES = 4;

function clampMinute(value) {
  return Math.max(0, Math.min(1439, value));
}

function normalizeTimeValue(totalMinutes) {
  const minutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function parseTimeString(input) {
  if (typeof input !== "string") {
    return null;
  }

  const value = input.trim().toUpperCase();
  if (!value) {
    return null;
  }

  const twelveHourMatch = value.match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]M)$/);
  if (twelveHourMatch) {
    const hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2] || "0");
    const meridiem = twelveHourMatch[3];

    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      return null;
    }

    const normalizedHours = hours % 12 + (meridiem === "PM" ? 12 : 0);
    return normalizedHours * 60 + minutes;
  }

  const twentyFourHourMatch = value.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHourMatch) {
    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    return hours * 60 + minutes;
  }

  return null;
}

function formatTime(totalMinutes, format) {
  const normalized = clampMinute(totalMinutes);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  if (format === "12h") {
    const meridiem = hours >= 12 ? "PM" : "AM";
    const hour = hours % 12 || 12;
    return `${hour}:${String(minutes).padStart(2, "0")} ${meridiem}`;
  }

  return normalizeTimeValue(normalized);
}

function normalizeSchedule(input, index) {
  const enabled = Boolean(input && input.enabled);
  const theme = typeof input?.theme === "string" ? input.theme.trim() : "";
  const startMinutes = parseTimeString(input?.start || "");
  const endMinutes = parseTimeString(input?.end || "");

  const base = {
    id: typeof input?.id === "string" ? input.id : `slot-${index + 1}`,
    slot: index + 1,
    enabled,
    theme,
    start: input?.start || "",
    end: input?.end || "",
    startMinutes,
    endMinutes
  };

  return base;
}

function overlaps(a, b) {
  const rangesA = expandSchedule(a);
  const rangesB = expandSchedule(b);

  return rangesA.some((rangeA) =>
    rangesB.some((rangeB) => rangeA.start < rangeB.end && rangeB.start < rangeA.end)
  );
}

function expandSchedule(schedule) {
  if (!schedule.enabled || schedule.startMinutes === null || schedule.endMinutes === null) {
    return [];
  }

  if (schedule.startMinutes === schedule.endMinutes) {
    return [{ start: 0, end: 1440 }];
  }

  if (schedule.startMinutes < schedule.endMinutes) {
    return [{ start: schedule.startMinutes, end: schedule.endMinutes }];
  }

  return [
    { start: schedule.startMinutes, end: 1440 },
    { start: 0, end: schedule.endMinutes }
  ];
}

function validateSchedules(rawSchedules) {
  const schedules = (Array.isArray(rawSchedules) ? rawSchedules : [])
    .slice(0, MAX_SCHEDULES)
    .map(normalizeSchedule);

  const errors = [];
  const enabledSchedules = schedules.filter((schedule) => schedule.enabled);

  enabledSchedules.forEach((schedule) => {
    const slot = schedule.slot;

    if (!schedule.theme) {
      errors.push(`Range ${slot}: select a theme.`);
    }

    if (schedule.startMinutes === null) {
      errors.push(`Range ${slot}: start time is invalid.`);
    }

    if (schedule.endMinutes === null) {
      errors.push(`Range ${slot}: end time is invalid.`);
    }
  });

  for (let index = 0; index < enabledSchedules.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < enabledSchedules.length; compareIndex += 1) {
      const left = enabledSchedules[index];
      const right = enabledSchedules[compareIndex];

      if (
        left.startMinutes !== null &&
        left.endMinutes !== null &&
        right.startMinutes !== null &&
        right.endMinutes !== null &&
        overlaps(left, right)
      ) {
        errors.push(
          `Ranges ${left.slot} and ${right.slot} overlap. Adjust the times so each moment maps to only one theme.`
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    schedules: schedules.map((schedule) => ({
      id: schedule.id,
      enabled: schedule.enabled,
      theme: schedule.theme,
      start: schedule.startMinutes === null ? schedule.start : normalizeTimeValue(schedule.startMinutes),
      end: schedule.endMinutes === null ? schedule.end : normalizeTimeValue(schedule.endMinutes)
    }))
  };
}

function containsMinute(schedule, minuteOfDay) {
  if (!schedule.enabled) {
    return false;
  }

  const start = parseTimeString(schedule.start);
  const end = parseTimeString(schedule.end);

  if (start === null || end === null) {
    return false;
  }

  if (start === end) {
    return true;
  }

  if (start < end) {
    return minuteOfDay >= start && minuteOfDay < end;
  }

  return minuteOfDay >= start || minuteOfDay < end;
}

function getActiveSchedule(rawSchedules, date = new Date()) {
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  const schedules = (Array.isArray(rawSchedules) ? rawSchedules : []).slice(0, MAX_SCHEDULES);
  return schedules.find((schedule) => containsMinute(schedule, minuteOfDay)) || null;
}

function getNextBoundaryDelay(rawSchedules, now = new Date()) {
  const schedules = (Array.isArray(rawSchedules) ? rawSchedules : []).slice(0, MAX_SCHEDULES);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowSeconds = now.getSeconds();
  const nowMilliseconds = now.getMilliseconds();
  const elapsedWithinMinute = nowSeconds * 1000 + nowMilliseconds;
  const candidates = [];

  schedules.forEach((schedule) => {
    if (!schedule.enabled) {
      return;
    }

    [schedule.start, schedule.end].forEach((value) => {
      const minutes = parseTimeString(value);
      if (minutes === null) {
        return;
      }

      let deltaMinutes = minutes - nowMinutes;
      if (deltaMinutes <= 0) {
        deltaMinutes += 1440;
      }
      candidates.push(deltaMinutes * 60 * 1000 - elapsedWithinMinute + 1000);
    });
  });

  if (candidates.length === 0) {
    return 15 * 60 * 1000;
  }

  return Math.max(1000, Math.min(...candidates));
}

function createDefaultSchedules() {
  return [
    {
      id: "slot-1",
      enabled: true,
      start: "06:30",
      end: "18:30",
      theme: ""
    },
    {
      id: "slot-2",
      enabled: true,
      start: "18:30",
      end: "06:30",
      theme: ""
    },
    {
      id: "slot-3",
      enabled: false,
      start: "",
      end: "",
      theme: ""
    },
    {
      id: "slot-4",
      enabled: false,
      start: "",
      end: "",
      theme: ""
    }
  ].slice(0, MAX_SCHEDULES);
}

module.exports = {
  MAX_SCHEDULES,
  createDefaultSchedules,
  formatTime,
  getActiveSchedule,
  getNextBoundaryDelay,
  normalizeTimeValue,
  parseTimeString,
  validateSchedules
};
