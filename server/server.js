const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./users.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the users database.');
});

// User creation/lookup endpoint
app.post('/api/users', async (req, res) => {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
  
    db.serialize(() => {
      // First try to find existing user
      db.get('SELECT * FROM users WHERE deviceFingerprint = ?', [sessionId], (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
  
        if (user) {
          // User exists, return existing user data
          console.log('Returning existing user:', user.id);
          return res.json({
            userId: user.id,
            exists: true,
            xp: user.xp,
            tasksCompleted: user.tasksCompleted
          });
        }
  
        // If no user found, create new one with transaction
        db.run('BEGIN TRANSACTION');
        
        // Double-check no user exists (handle race condition)
        db.get('SELECT id FROM users WHERE deviceFingerprint = ?', [sessionId], (err, existingUser) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Internal server error' });
          }
  
          if (existingUser) {
            db.run('ROLLBACK');
            // User was created in the meantime, return that user
            db.get('SELECT * FROM users WHERE id = ?', [existingUser.id], (err, user) => {
              if (err) {
                return res.status(500).json({ error: 'Internal server error' });
              }
              return res.json({
                userId: user.id,
                exists: true,
                xp: user.xp,
                tasksCompleted: user.tasksCompleted
              });
            });
            return;
          }
  
          // Create new user
          const userId = uuidv4();
          db.run(
            'INSERT INTO users (id, deviceFingerprint, xp, tasksCompleted) VALUES (?, ?, 0, 0)',
            [userId, sessionId],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                console.error('Error creating new user:', err);
                return res.status(500).json({ error: 'Failed to create new user' });
              }
              
              db.run('COMMIT');
              console.log('Successfully created new user:', userId);
              res.json({ 
                userId: userId,
                exists: false,
                xp: 0,
                tasksCompleted: 0
              });
            }
          );
        });
      });
    });
  });


// User lookup endpoint
app.get('/api/users/:id', (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, user) => {
    if (err) {
      return handleDbError(res, err);
    }
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    res.json(user);
  });
});

// User update endpoint
app.put('/api/users/:id', (req, res) => {
  const { xp, tasksCompleted } = req.body;
  
  if (typeof xp !== 'number' || typeof tasksCompleted !== 'number') {
    return res.status(400).json({ error: 'Invalid xp or tasksCompleted value' });
  }

  db.run(
    'UPDATE users SET xp = ?, tasksCompleted = ? WHERE id = ?',
    [xp, tasksCompleted, req.params.id],
    function(err) {
      if (err) {
        return handleDbError(res, err);
      }
      if (this.changes === 0) {
        return res.status(404).json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }
      res.json({ message: 'User updated successfully' });
    }
  );
});

// Leaderboard endpoint
app.get('/api/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  
  db.all(
    'SELECT * FROM users ORDER BY xp DESC LIMIT ? OFFSET ?',
    [limit, offset],
    (err, rows) => {
      if (err) {
        return handleDbError(res, err);
      }
      res.json(rows);
    }
  );
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});