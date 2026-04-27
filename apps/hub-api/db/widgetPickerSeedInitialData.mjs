const allowedSizesByWidget = {
  table: ['M', 'L'],
  kanban: ['M', 'L'],
  calendar: ['S', 'M', 'L'],
  tasks: ['S', 'M', 'L'],
  reminders: ['S', 'M', 'L'],
  timeline: ['S', 'M', 'L'],
};

const baseSeeds = {
  table: {
    fields: ['Name', 'Status', 'Vibe'],
    rows: [
      ['Your first record - look at you go', 'Thriving', 'Organize anything into rows'],
      ['Sort, filter, conquer', 'Pending world domination', 'Data behaving nicely'],
      ['Make this your own', 'Thriving', 'Tiny database, big main-character energy'],
    ],
  },
  kanban: {
    columns: [
      { title: 'To Do', cards: ['Your first task (exciting, right?)', 'Add more cards here'] },
      { title: 'On It', cards: ['Drag cards across - it feels great'] },
      { title: 'Nailed It', cards: ['Done. Champagne optional.'] },
    ],
  },
  calendar: {
    events: [
      { title: 'Your events live here', dayOffset: 0, hour: 10 },
      { title: "Drag to reschedule (we won't judge)", dayOffset: 2, hour: 14 },
      { title: 'Click to add details ✨', dayOffset: 4, hour: 11 },
    ],
  },
  tasks: {
    items: [
      { title: 'Your first task', checked: false },
      { title: "Check things off - it's therapeutic", checked: false },
      { title: "This one's already done, you're welcome", checked: true },
      { title: 'Add as many as your heart desires', checked: false },
    ],
  },
  reminders: {
    items: [
      { title: "Don't forget this (we've got you)", minutesFromNow: 60 },
      { title: 'Set your own schedule', minutesFromNow: 180 },
      { title: 'Future you will be grateful', minutesFromNow: 1440 },
    ],
  },
  timeline: {
    items: [
      { title: 'Activity shows up here - like a diary, but useful', minutesAgo: 12 },
      { title: 'See what changed and when', minutesAgo: 45 },
      { title: "Your team's story, one event at a time", minutesAgo: 120 },
    ],
  },
};

export const seedWidgetPickerSeedData = (db, nowIso) => {
  // Seed rows are first-install defaults; admin edits in this table should survive later deploys.
  const insertSeed = db.prepare(`
    INSERT OR IGNORE INTO widget_picker_seed_data (
      widget_type,
      size_tier,
      seed_data_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const now = nowIso();

  for (const [widgetType, sizes] of Object.entries(allowedSizesByWidget)) {
    for (const size of sizes) {
      insertSeed.run(widgetType, size, JSON.stringify(baseSeeds[widgetType]), now, now);
    }
  }
};
