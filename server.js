const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware to check JWT
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Register or login
app.post('/api/register', async (req, res) => {
  const { cnp, name } = req.body;
  if (!/^[0-9]{13}$/.test(cnp)) return res.status(400).json({ error: 'CNP must be 13 digits' });
  let user = (await pool.query('SELECT * FROM "user" WHERE cnp=$1', [cnp])).rows[0];
  if (!user) {
    user = (await pool.query('INSERT INTO "user"(cnp, name) VALUES($1, $2) RETURNING *', [cnp, name])).rows[0];
  }
  const token = jwt.sign({ id: user.id, cnp: user.cnp, name: user.name }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token, user: { id: user.id, cnp: user.cnp, name: user.name } });
});

// Login (just by CNP)
app.post('/api/login', async (req, res) => {
  const { cnp } = req.body;
  const user = (await pool.query('SELECT * FROM "user" WHERE cnp=$1', [cnp])).rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  const token = jwt.sign({ id: user.id, cnp: user.cnp, name: user.name }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token, user: { id: user.id, cnp: user.cnp, name: user.name } });
});

// List candidates
app.get('/api/candidates', async (req, res) => {
  const candidates = (await pool.query('SELECT * FROM candidate')).rows;
  res.json(candidates);
});

// Vote (one vote per user)
app.post('/api/vote', auth, async (req, res) => {
  const { candidate_id } = req.body;
  const user_id = req.user.id;
  // Check if user already voted
  const existing = (await pool.query('SELECT * FROM vote WHERE user_id=$1', [user_id])).rows[0];
  if (existing) return res.status(400).json({ error: 'User already voted' });
  // Check candidate exists
  const candidate = (await pool.query('SELECT * FROM candidate WHERE id=$1', [candidate_id])).rows[0];
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  // Insert vote
  await pool.query('INSERT INTO vote(user_id, candidate_id) VALUES($1, $2)', [user_id, candidate_id]);
  res.json({ success: true });
});

// Get vote counts
app.get('/api/votes', async (req, res) => {
  const result = await pool.query(`
    SELECT candidate_id, COUNT(*) as votes
    FROM vote
    GROUP BY candidate_id
  `);
  res.json(result.rows);
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
}); 