const fs = require('fs');
const path = require('path');

const minutesPerDay = 24 * 60;

function parseScheduleDuration(value) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (parsed <= 0 || parsed >= minutesPerDay) {
    return null;
  }
  return Math.round(parsed);
}

function loadScheduleDurationFromParams() {
  const paramPath = path.join(
    __dirname,
    '../../backend/infrastructure/params/production.json'
  );
  if (!fs.existsSync(paramPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(paramPath, 'utf8');
    const data = JSON.parse(raw);
    return parseScheduleDuration(
      data.AdminWebScheduleDefaultDurationMinutes
    );
  } catch (error) {
    return null;
  }
}

const scheduleDurationFromParams = loadScheduleDurationFromParams();
if (
  !process.env.NEXT_PUBLIC_SCHEDULE_DEFAULT_DURATION_MINUTES &&
  scheduleDurationFromParams !== null
) {
  process.env.NEXT_PUBLIC_SCHEDULE_DEFAULT_DURATION_MINUTES = String(
    scheduleDurationFromParams
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
