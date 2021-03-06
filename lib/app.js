const express = require('express');
const cors = require('cors');
const client = require('./client.js');
const app = express();
const morgan = require('morgan');
const ensureAuth = require('./auth/ensure-auth');
const request = require('superagent');
const createAuthRoutes = require('./auth/create-auth-routes');
const { mungedVideos, mungeRandom } = require('../utils.js');


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev')); // http logging

const authRoutes = createAuthRoutes();

// setup authentication routes to give user an auth token
// creates a /auth/signin and a /auth/signup POST route. 
// each requires a POST body with a .email and a .password
app.use('/auth', authRoutes);

// everything that starts with "/api" below here requires an auth token!
app.use('/api', ensureAuth);

// and now every request that has a token in the Authorization header will have a `req.userId` property for us to see who's talking
app.get('/api/test', (req, res) => {
  res.json({
    message: `in this protected route, we get the user's id like so: ${req.userId}`
  });
});

app.get('/api/favorites', async(req, res) => {
  try {
    const data = await client.query(`
    SELECT * 
    FROM favorites
    WHERE favorites.owner_id = $1
    `, [req.userId]);

    res.json(data.rows);
  } catch(e) {

    res.status(500).json({ error: e.message });
  }
});

app.get('/api/favorites/:id', async(req, res) => {
  try {
    const favoritesId = req.params.id;
    const data = await client.query(`
    SELECT *
    FROM favorites
    WHERE favorites.id = $1
    favorites.owner_id = $2
    `, [req.usedId, favoritesId]);
    res.json(data.rows[0]);
  } catch(e) {

    res.status(500).json({ error: e.message });
  }
});


app.post('/api/favorites', async(req, res) => {
  try {
    // we add the current user if and the selected movie id to SQL
    const data = await client.query(`
      INSERT into favorites ( videoId, title, thumbnails, owner_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `, [req.body.videoId, req.body.title, req.body.thumbnails, req.userId]);

    res.json(data.rows[0]);
  } catch(e) {

    res.status(500).json({ error: e.message });
  }
});

app.put('/api/favorites/:id', async(req, res) => {
  try {
    const data = await client.query(`
      UPDATE favorites
      WHERE favorites.owner_id = $1
      AND favorites.videoId = $2
      RETURNING *;
      `, [req.userId, req.params.id]);

    res.json(data.rows);
  } catch(e) {

    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/favorites/:id', async(req, res) => {
  try {


    const data = await client.query(`
      DELETE from favorites 
      WHERE favorites.owner_id = $1
      AND favorites.id=$2
      RETURNING *
    `,
    [req.userId, req.params.id]);

    res.json(data.rows[0]);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});






app.get('/api/videos', async(req, res) => {
  try {
    const response = await request.get(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=karaoke%20${req.query.search}%20karaoke%20version&type=video&videoEmbeddable=true&key=${process.env.YOUTUBE_API_KEY}`);
    const munged = mungedVideos(response.body);

    res.json(munged);
  } catch(e) {

    res.status(500).json({ error: e.message });
  }
});

app.get('/api/random-videos', async(req, res) => {
  try {
    const URL = (`https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=100&q=karaoke%20popular"%20karaoke%20version"&type=video&videoEmbeddable=true&key=${process.env.YOUTUBE_API_KEY}`);

    const response = await request.get(URL);
    const munged = mungeRandom(response.body);

    res.json(munged);
  } catch(e) {

    res.status(500).json({ error: e.message });
  }
});

app.get('/random-name', async(req, res) => {
  try {
    const data = await client.query(`
    SELECT *
    FROM names
     `);

    res.json(data.rows);

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});


app.get('/api/random-name', async(req, res) => {
  try {
    const data = await client.query('SELECT * FROM names ');
    res.json(data.rows[Math.floor(Math.random() * (data.rows.length - 1))]);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});


app.get('/api/random-name/:id', async(req, res) => {
  try {
    const nameId = req.params.id;
    const data = await client.query(`
    SELECT *
    FROM names
    WHERE names.id = $1
    `, [nameId]);
    res.json(data.rows);

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});


app.use(require('./middleware/error'));



module.exports = app;
