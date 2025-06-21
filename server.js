const express = require('express');
const cors = require('cors');
const { faker } = require('@faker-js/faker');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// In-memory candidate store
let candidates = [];
let nextId = 1;

const politicalParties = [
  'Democratic Party',
  'Republican Party',
  'Independent',
  'Green Party',
  'Libertarian Party',
  'Progressive Party',
  'Constitution Party',
  'Reform Party',
  'Socialist Party',
  'Conservative Party',
  'Liberal Party',
  'Centrist Party'
];

function generateRandomCandidate() {
  const party = faker.helpers.arrayElement(politicalParties);
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const name = `${firstName} ${lastName}`;
  const background = faker.person.jobTitle();
  const platform = faker.company.catchPhrase();
  const description = `${name} is a ${background} with a strong commitment to public service. ${faker.person.gender() === 'male' ? 'He' : 'She'} has dedicated ${faker.number.int({ min: 5, max: 25 })} years to their field and has been a vocal advocate for ${platform}.`;
  return {
    id: nextId++,
    name,
    politicalParty: party,
    description,
    imageUrl: faker.image.avatar()
  };
}

// Pre-populate with 5 random candidates
for (let i = 0; i < 5; i++) {
  candidates.push(generateRandomCandidate());
}

function broadcastCandidates() {
  const data = JSON.stringify({ type: 'candidates', candidates });
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

// REST API
app.get('/api/candidates', (req, res) => {
  res.json(candidates);
});

app.post('/api/candidates', (req, res) => {
  const { name, politicalParty, description, imageUrl } = req.body;
  const candidate = {
    id: nextId++,
    name,
    politicalParty,
    description,
    imageUrl
  };
  candidates.push(candidate);
  broadcastCandidates();
  res.status(201).json(candidate);
});

app.post('/api/candidates/generate', (req, res) => {
  const candidate = generateRandomCandidate();
  candidates.push(candidate);
  broadcastCandidates();
  res.status(201).json(candidate);
});

app.put('/api/candidates/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = candidates.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  candidates[idx] = { ...candidates[idx], ...req.body, id };
  broadcastCandidates();
  res.json(candidates[idx]);
});

app.delete('/api/candidates/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = candidates.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const removed = candidates.splice(idx, 1)[0];
  broadcastCandidates();
  res.json(removed);
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

// WebSocket server
const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'candidates', candidates }));
}); 