require('dotenv').config();
const express = require('express');
const AWS = require('aws-sdk');
const app = express();
const port = process.env.PORT || 3000;

const mysql = require('mysql2');
const connection = mysql.createConnection(process.env.DATABASE_URL);

const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer().single('imagen');
app.use(bodyParser.urlencoded({ extended: true }));

// Configurar el cliente de S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

connection.connect();

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  connection.query('SELECT * FROM productoss', (error, results, fields) => {
    if (error) throw error;
    res.render('index', { data: results });
  });
});

app.get('/delete/:id', (req, res) => {
  const id = req.params.id;
  connection.query('DELETE FROM productoss WHERE id = ?', [id], (error, results) => {
    if (error) throw error;
    res.redirect('/');
  });
});

app.get('/add', (req, res) => {
  res.render('Agregar');
});

app.post('/save', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error al cargar el archivo');
      return;
    }
    if (!req.file) {
      res.status(400).send('Archivo no encontrado');
      return;
    }
    const nombre = req.body.nombre;
    const descripcion = req.body.descripcion;
    const precio = req.body.precio;
    const imagen = req.file;

    // Código para subir la imagen a S3
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `${Date.now()}_${imagen.originalname}`,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ContentDisposition: 'inline',
    };

    s3.upload(params, (error, data) => {
      if (error) {
        console.error(error);
      } else {
        const imagenURL = data.Location;
        console.log(params);

        connection.query(
          'INSERT INTO productoss SET ?',
          { nombre: nombre, descripcion: descripcion, precio: precio, imagen: imagenURL },
          (error, results) => {
            if (error) {
              console.log(error);
            } else {
              res.redirect('/');
              console.log(`Producto ${nombre} creado`);
            }
          }
        );
      }
    });
  });
});

app.get('/up/:id', (req, res) => {
  const id = req.params.id;
  connection.query('SELECT * FROM productoss WHERE id = ?', [id], (error, results, fields) => {
    if (error) throw error;
    res.render('Editar.ejs', { data: results[0] });
  });
});

app.post('/update/:id', (req, res) => {
  const id = req.params.id;
  const nombre = req.body.nombre;
  const descripcion = req.body.descripcion;
  const precio = req.body.precio;
  const imagen = req.body.imagen;

  connection.query(
    'UPDATE productoss SET nombre = ?, descripcion = ?, precio = ?, imagen = ? WHERE id = ?',
    [nombre, descripcion, precio, imagen, id],
    (error, results) => {
      if (error) throw error;
      res.redirect('/');
    }
  );
});

// Middleware para servir imágenes estáticas desde S3
app.use('/static', express.static('public'));

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
