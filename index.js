const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const cors = require('cors');
const multer = require('multer');

dotenv.config();
const TOKEN_SECRET = process.env.TOKEN_SECRET;

const app = express();
const port = 3001;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

function generateAccessToken() {
  const token = jwt.sign({}, process.env.TOKEN_SECRET, { expiresIn: '3600s' });
  return token;
}

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'crud_barang',
});

connection.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database');
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, TOKEN_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        const newToken = generateAccessToken();
        res.setHeader('Authorization', newToken);
        next();
      } else {
        return res.sendStatus(403);
      }
    } else {
      req.user = user;
      next();
    }
  });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.mimetype.split('/')[1]);
  },
});

const upload = multer({ storage: storage });

app.get('/jwt', (req, res) => {
  const token = generateAccessToken();
  res.json({ token });
});

app.get('/api/items', authenticateToken, (req, res) => {
  const query = 'SELECT * FROM items';

  connection.query(query, (error, results) => {
    if (error) {
      console.error(error);
      return res.sendStatus(500);
    }

    res.json(results);
  });
});

app.get('/api/items/:id', authenticateToken, (req, res) => {
  const itemId = req.params.id;
  const query = 'SELECT * FROM items WHERE id = ?';

  connection.query(query, [itemId], (error, results) => {
    if (error) {
      console.error(error);
      return res.sendStatus(500);
    }

    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.sendStatus(404);
    }
  });
});

app.post('/api/items', authenticateToken, upload.single('foto'), (req, res) => {
  try {
    let foto = null;
    if (req.file) {
      foto = req.file.filename;
    }

    const { nama, hargaBeli, hargaJual, stok } = req.body;

    const query = 'INSERT IGNORE INTO items (foto, nama, harga_beli, harga_jual, stok) VALUES (?, ?, ?, ?, ?)';

    connection.query(query, [foto, nama, hargaBeli, hargaJual, stok], (error, results) => {
      if (error) {
        console.error(error);
        return res.sendStatus(500);
      }

      if (results.affectedRows === 0) {
        console.log('Item with the same name already exists');
      }

      res.sendStatus(201);
    });
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.put('/api/items/:id', authenticateToken, upload.single('foto'), async (req, res) => {
  try {
    const itemId = req.params.id;
    const { nama, hargaBeli, hargaJual, stok } = req.body;
    
    let foto = null;
    if (req.file) {
      foto = req.file.filename;
    }

    let updateFields = '';
    let params = [];

    if (foto) {
      updateFields += 'foto = ?, ';
      params.push(foto);
    }

    if (nama) {
      updateFields += 'nama = ?, ';
      params.push(nama);
    }

    if (hargaBeli !== undefined) {
      updateFields += 'harga_beli = ?, ';
      params.push(hargaBeli);
    }

    if (hargaJual !== undefined) {
      updateFields += 'harga_jual = ?, ';
      params.push(hargaJual);
    }

    if (stok !== undefined) {
      updateFields += 'stok = ?, ';
      params.push(stok);
    }

    if (updateFields.length === 0) {
      return res.sendStatus(200);
    }

    updateFields = updateFields.slice(0, -2);

    const query = `UPDATE items SET ${updateFields} WHERE id = ?`;
    params.push(itemId);

    await new Promise((resolve, reject) => {
      connection.query(query, params, (error, results) => {
        if (error) reject(error);
        else resolve(results);
      });
    });

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});


app.delete('/api/items/:id', authenticateToken, (req, res) => {
  const itemId = req.params.id;
  const query = 'DELETE FROM items WHERE id = ?';

  connection.query(query, [itemId], (error, results) => {
    if (error) {
      console.error(error);
      return res.sendStatus(500);
    }

    res.sendStatus(204);
  });
});

app.listen(process.env.PORT || port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
