// MongoDB Playground 2 — Query & Search
// SMASH Badminton Event App
// Run each block with ▶ or select a block and run individually

use('badminton_app');

// ─── ATTENDEES ────────────────────────────────────────────────────────────

// All attendees
db.attendees.find({});

// Find by external_id (used for QR scan lookup)
// db.attendees.findOne({ external_id: 'ATH001' });

// Find by name (case-insensitive search)
// db.attendees.find({ name: { $regex: 'somchai', $options: 'i' } });

// All checked-in attendees
// db.attendees.find({ checked_in: true });

// All athletes (not checked in yet)
// db.attendees.find({ role: 'athlete', checked_in: false });

// Walk-in attendees only
// db.attendees.find({ walk_in: true });

// Filter by category
// db.attendees.find({ category: 'Expert' });

// ─── FOOD CLAIMS ─────────────────────────────────────────────────────────

// All food claims
// db.food_claims.find({});

// Claims for a specific attendee
// db.food_claims.find({ attendee_external_id: 'ATH001' });

// Claims for a specific food item
// db.food_claims.find({ item_id: 'bbq' });

// Check if attendee already claimed a specific item
// db.food_claims.findOne({ attendee_external_id: 'ATH001', item_id: 'bbq' });

// ─── FOOD ITEMS ───────────────────────────────────────────────────────────

// All food items and their quotas
// db.food_items.find({});

// ─── RESULTS ─────────────────────────────────────────────────────────────

// Full leaderboard sorted by rank
// db.results.find({}).sort({ rank: 1 });

// Top 3 teams
// db.results.find({}).sort({ points: -1 }).limit(3);

// ─── EVENT CONFIG ─────────────────────────────────────────────────────────

// All config values
// db.event_config.find({});

// Get a specific config key
// db.event_config.findOne({ key: 'announcement' });
