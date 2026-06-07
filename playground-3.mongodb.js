// MongoDB Playground — SMASH Badminton Event App
// Make sure you are connected to your MongoDB cluster before running.
// Run each block individually with the ▶ button, or run all at once.

use('badminton_app');

// ─── 1. DROP existing collections (clean slate) ───────────────────────────
db.attendees.drop();
db.food_items.drop();
db.food_claims.drop();
db.results.drop();
db.event_config.drop();

// ─── 2. CREATE collections with schema validation ─────────────────────────

db.createCollection('attendees', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['external_id', 'name'],
      properties: {
        external_id: { bsonType: 'string' },
        name:        { bsonType: 'string' },
        email:       { bsonType: ['string', 'null'] },
        phone:       { bsonType: ['string', 'null'] },
        company:     { bsonType: ['string', 'null'] },
        category:    { enum: ['Basic', 'Expert', 'Substitute', 'Spectator', null] },
        role:        { enum: ['athlete', 'spectator', null] },
        checked_in:  { bsonType: 'bool' },
        walk_in:     { bsonType: 'bool' },
        created_at:  { bsonType: 'date' },
      }
    }
  }
});

db.createCollection('food_items');
db.createCollection('food_claims');
db.createCollection('results');
db.createCollection('event_config');

// ─── 3. INDEXES ───────────────────────────────────────────────────────────

db.attendees.createIndex({ external_id: 1 }, { unique: true });
db.food_claims.createIndex({ attendee_external_id: 1, item_id: 1 });
db.results.createIndex({ rank: 1 });

// ─── 4. INSERT food_items ─────────────────────────────────────────────────

db.food_items.insertMany([
  { _id: 'wrap',       name: 'Wrap',             quota: 1 },
  { _id: 'mc_chicken', name: 'McChicken',         quota: 1 },
  { _id: 'croffle',    name: 'Croffle',           quota: 1 },
  { _id: 'icecream',   name: 'Ice Cream',         quota: 1 },
  { _id: 'fruits',     name: 'Fruits',            quota: 1 },
  { _id: 'energy_bar', name: 'Energy Bar',        quota: 1 },
  { _id: 'bbq',        name: 'BBQ',               quota: 3 },
  { _id: 'beer',       name: 'Beer',              quota: 3 },
  { _id: 'soft_drink', name: 'Soft Drink',        quota: 1 },
  { _id: 'hydration',  name: 'Hydration Drink',   quota: 1 },
  { _id: 'water',      name: 'Water',             quota: 3 },
]);

// ─── 5. INSERT event_config ───────────────────────────────────────────────

db.event_config.insertMany([
  { key: 'motm_name',       value: '' },
  { key: 'motm_team',       value: '' },
  { key: 'motm_image_url',  value: '' },
  { key: 'announcement',    value: '' },
  { key: 'seating_map_url', value: '' },
]);

// ─── 6. INSERT sample attendees ───────────────────────────────────────────

db.attendees.insertMany([
  {
    external_id:    'ATH001',
    name:           'Somchai Rakdee',
    email:          'somchai@example.com',
    phone:          '0812345678',
    company:        'Team Alpha',
    category:       'Expert',
    role:           'athlete',
    checked_in:     false,
    check_in_time:  null,
    walk_in:        false,
    created_at:     new Date(),
  },
  {
    external_id:    'ATH002',
    name:           'Nattapon Srisuk',
    email:          'nattapon@example.com',
    phone:          '0823456789',
    company:        'Team Beta',
    category:       'Basic',
    role:           'athlete',
    checked_in:     true,
    check_in_time:  new Date(),
    walk_in:        false,
    created_at:     new Date(),
  },
  {
    external_id:    'SPE001',
    name:           'Malee Jaidee',
    email:          'malee@example.com',
    phone:          null,
    company:        null,
    category:       'Spectator',
    role:           'spectator',
    checked_in:     false,
    check_in_time:  null,
    walk_in:        true,
    created_at:     new Date(),
  },
]);

// ─── 7. INSERT sample results ─────────────────────────────────────────────

db.results.insertMany([
  { rank: 1, team: 'Team Alpha', win: 5, lose: 0, points: 15 },
  { rank: 2, team: 'Team Beta',  win: 3, lose: 2, points: 9  },
  { rank: 3, team: 'Team Gamma', win: 1, lose: 4, points: 3  },
]);

// ─── 8. VERIFY — check what was created ───────────────────────────────────

db.getCollectionNames();
