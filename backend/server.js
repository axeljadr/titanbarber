import express from "express";
import cors from "cors";
import mssql from "mssql";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import multer from "multer";
import nodemailer from "nodemailer";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();
const app = express();
const PORT = 4000;
const SECRET = "barberpi_secret_2024";

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const storagePerfil = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/fotosdeperfil/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "perfil-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten imágenes JPG, PNG o WEBP"));
    }
  },
});

const uploadPerfil = multer({ storage: storagePerfil });
const dbConfig = {
  server: "thetitanbd.database.windows.net",
  port: 1433,
  database: "thetitanbd",
  user: "usuariotitan",
  password: "Usuario12345",
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

let pool = null;

async function conectarDB() {
  if (!pool) {
    pool = mssql
      .connect(dbConfig)
      .then((pool) => {
        console.log("Conectado a SQL Server");
        return pool;
      })
      .catch((err) => {
        console.error("Error al conectar: ", err);
        pool = null;
        throw err;
      });
  }
  return pool;
}

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Formato de token inválido" });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

const staticPath = path.resolve(__dirname, "..", "static");
const imagesPath = path.resolve(__dirname, "..", "images");

app.use("/static", express.static(staticPath));
app.use("/images", express.static(imagesPath));
app.get("/newaccount", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "newaccount.html"));
});
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "login.html"));
});
app.get("/perfil", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "perfil.html"));
});
app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "home.html"));
});
app.get("/homebarber", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "homebarber.html"));
});
app.get("/barber_agenda", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "barber_agenda.html"));
});
app.get("/agendar", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "agendar.html"));
});
app.get("/notibarbero", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "notibarbero.html"));
});
app.get("/notificacion", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "notificacion.html"));
});
app.get("/panel", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "panel.html"));
});
app.get("/admin/servicios", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "servicios.html"));
});
app.get("/admin/clientes", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "clientes.html"));
});
app.get("/admin/cliente/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "perfilc.html"));
});
app.get("/admin/horario", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "horario.html"));
});
app.get("/admin/citas", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "templates", "citas.html"));
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

app.post("/api/auth/registro", async (req, res) => {
  const { nombre, email, contraseña } = req.body;

  if (!nombre || !email || !contraseña)
    return res.status(400).json({ error: "Faltan datos obligatorios" });

  try {
    const pool = await conectarDB();

    const existe = await pool
      .request()
      .input("email", mssql.NVarChar, email)
      .query("SELECT id_usuario FROM usuarios WHERE email = @email");

    if (existe.recordset.length > 0)
      return res.status(400).json({ error: "El email ya está registrado" });

    const hashed = await bcrypt.hash(contraseña, 10);

    const tokenConfirm = jwt.sign(
      { nombre, email, contraseña: hashed },
      SECRET,
      { expiresIn: "1h" },
    );

    const confirmUrl = `${process.env.APP_URL}/api/auth/confirmar?token=${tokenConfirm}`;

    await transporter.sendMail({
      from: `"The Titan Barbershop" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Confirma tu cuenta - The Titan",
      html: `
        <div style="background:#0d0b0e;padding:20px;font-family:sans-serif;color:#e8d5a0;text-align:center;">
          <div style="background:#16121c;border:1px solid #b8860b;padding:30px;border-radius:15px;">
            <h1 style="color:#b8860b;">¡Bienvenido a The Titan!</h1>
            <p>Hola <strong>${nombre}</strong>, haz clic abajo para confirmar tu registro:</p>
            <a href="${confirmUrl}"
               style="background:#b8860b;color:#000;padding:12px 25px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;margin:20px 0;">
              CONFIRMAR CUENTA
            </a>
            <p style="color:rgba(232,213,160,0.4);font-size:0.8rem;">Este enlace expira en 1 hora.</p>
          </div>
        </div>`,
    });

    res.json({ mensaje: "Correo enviado" });
  } catch (error) {
    console.error("Error en /registro:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});
app.post("/api/auth/login", async (req, res) => {
  const { email, contraseña } = req.body;

  if (!email || !contraseña) {
    return res
      .status(400)
      .json({ error: "Email y contraseña son obligatorios" });
  }

  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("email", mssql.NVarChar, email)
      .query("SELECT * FROM usuarios WHERE email = @email");

    const usuario = result.recordset[0];
    if (!usuario) {
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    const isMatch = await bcrypt.compare(contraseña, usuario.contraseña);
    if (!isMatch) {
      return res.status(400).json({ error: "Contraseña incorrecta" });
    }

    const token = jwt.sign(
      { id: usuario.id_usuario, email: usuario.email, rol: usuario.rol },
      SECRET,
      { expiresIn: "40m" },
    );

    res.json({
      mensaje: "Login exitoso",
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error("Error en /login:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/api/auth/confirmar", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect("/?error=token_invalido");

  try {
    const datos = jwt.verify(token, SECRET);

    const pool = await conectarDB();

    const existe = await pool
      .request()
      .input("email", mssql.NVarChar, datos.email)
      .query("SELECT id_usuario FROM usuarios WHERE email = @email");

    if (existe.recordset.length > 0) return res.redirect("/?cuenta=creada");

    await pool
      .request()
      .input("nombre", mssql.NVarChar, datos.nombre)
      .input("email", mssql.NVarChar, datos.email)
      .input("contraseña", mssql.NVarChar, datos.contraseña)
      .query(
        "INSERT INTO usuarios (nombre, email, contraseña) VALUES (@nombre, @email, @contraseña)",
      );

    res.redirect("/?cuenta=creada");
  } catch (err) {
    console.error("Error en /confirmar:", err);
    res.redirect("/?error=token_expirado");
  }
});
app.post("/api/auth/recuperar", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido" });

  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("email", mssql.NVarChar, email)
      .query("SELECT id_usuario FROM usuarios WHERE email = @email");

    if (result.recordset.length === 0) {
      return res.json({ mensaje: "Si el correo existe, recibirás un link" });
    }

    const tokenReset = jwt.sign({ email, tipo: "reset" }, SECRET, {
      expiresIn: "30m",
    });
    const resetUrl = `${process.env.APP_URL}/?reset=${tokenReset}`;

    await transporter.sendMail({
      from: `"The Titan Barbershop" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Recupera tu contraseña - The Titan",
      html: `
        <div style="background:#0d0b0e;padding:20px;font-family:sans-serif;color:#e8d5a0;text-align:center;">
          <div style="background:#16121c;border:1px solid #b8860b;padding:30px;border-radius:15px;max-width:480px;margin:0 auto;">
            <h1 style="color:#b8860b;">The Titan Barbershop</h1>
            <p>Recibimos una solicitud para restablecer tu contraseña.</p>
            <p>Haz clic en el botón para crear una nueva (expira en 30 minutos):</p>
            <a href="${resetUrl}"
               style="background:#b8860b;color:#000;padding:12px 25px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;margin:20px 0;">
              RESTABLECER CONTRASEÑA
            </a>
            <p style="color:rgba(232,213,160,0.4);font-size:0.8rem;">Si no solicitaste esto, ignora este correo.</p>
          </div>
        </div>`,
    });

    res.json({ mensaje: "Correo enviado" });
  } catch (error) {
    console.error("Error en /recuperar:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.post("/api/auth/nueva-password", async (req, res) => {
  const { token, contraseña } = req.body;
  if (!token || !contraseña)
    return res.status(400).json({ error: "Datos incompletos" });

  try {
    const datos = jwt.verify(token, SECRET);

    if (datos.tipo !== "reset")
      return res.status(400).json({ error: "Token inválido" });

    const hashed = await bcrypt.hash(contraseña, 10);

    const pool = await conectarDB();
    await pool
      .request()
      .input("email", mssql.NVarChar, datos.email)
      .input("contraseña", mssql.NVarChar, hashed)
      .query(
        "UPDATE usuarios SET contraseña = @contraseña WHERE email = @email",
      );

    res.json({ mensaje: "Contraseña actualizada" });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res
        .status(400)
        .json({ error: "El link expiró. Solicita uno nuevo." });
    }
    res.status(400).json({ error: "Token inválido" });
  }
});
app.get("/api/auth/perfil", verificarToken, async (req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("id_usuario", mssql.Int, req.usuario.id).query(`
        SELECT 
          id_usuario, nombre, apellidoP, apellidoM,
          edad, email, telefono, rol
        FROM usuarios
        WHERE id_usuario = @id_usuario
      `);

    if (result.recordset.length === 0)
      return res.status(404).json({ error: "Usuario no encontrado" });

    const user = result.recordset[0];
    user.foto_perfil = `/api/auth/perfil/foto/${user.id_usuario}`;
    res.json(user);
  } catch (error) {
    console.error("Error en GET /perfil:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/api/auth/perfil/foto/:id", async (req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("id_usuario", mssql.Int, parseInt(req.params.id)).query(`
        SELECT foto_perfil FROM usuarios WHERE id_usuario = @id_usuario
      `);

    const foto = result.recordset[0]?.foto_perfil;

    if (!foto || foto.length === 0) {
      return res.redirect("/images/default-avatar.jpg");
    }

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(foto);
  } catch (error) {
    console.error("Error al obtener foto:", error);
    res.redirect("/images/default-avatar.jpg");
  }
});

app.put(
  "/api/auth/perfil/foto",
  verificarToken,
  upload.single("foto"),
  async (req, res) => {
    if (!req.file)
      return res.status(400).json({ error: "No se recibió ninguna imagen" });

    try {
      const pool = await conectarDB();
      await pool
        .request()
        .input("id_usuario", mssql.Int, req.usuario.id)
        .input("foto_perfil", mssql.VarBinary(mssql.MAX), req.file.buffer)
        .query(`
          UPDATE usuarios
          SET foto_perfil = @foto_perfil
          WHERE id_usuario = @id_usuario
        `);

      const fotoUrl = `/api/auth/perfil/foto/${req.usuario.id}`;
      res.json({
        mensaje: "Foto de perfil actualizada correctamente",
        foto_perfil: fotoUrl,
      });
    } catch (error) {
      console.error("Error al actualizar foto de perfil:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  },
);

app.put("/api/auth/perfil", verificarToken, async (req, res) => {
  const { nombre, apellidoP, apellidoM, edad, email, telefono, rol } = req.body;

  try {
    const pool = await conectarDB();
    await pool
      .request()
      .input("id", mssql.Int, req.usuario.id)
      .input("nombre", mssql.NVarChar, nombre)
      .input("apellidoP", mssql.NVarChar, apellidoP || null)
      .input("apellidoM", mssql.NVarChar, apellidoM || null)
      .input("edad", mssql.Int, edad || null)
      .input("email", mssql.NVarChar, email)
      .input("telefono", mssql.NVarChar, telefono || null)
      .input("rol", mssql.NVarChar, rol || "cliente").query(`
        UPDATE usuarios
        SET 
          nombre = @nombre,
          apellidoP = @apellidoP,
          apellidoM = @apellidoM,
          edad = @edad,
          email = @email,
          telefono = @telefono,
          rol = @rol
        WHERE id_usuario = @id
      `);

    res.json({ mensaje: "Perfil actualizado correctamente" });
  } catch (error) {
    console.error("Error en PUT /perfil:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.post(
  "/api/catalogo",
  verificarToken,
  upload.single("imagen"),
  async (req, res) => {
    if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
      return res
        .status(403)
        .json({ error: "Solo barberos y admins pueden subir imágenes" });
    }

    const { nombre, descripcion, nombre_barber, nombre_barber_ref } = req.body;

    if (!nombre || !descripcion) {
      return res
        .status(400)
        .json({ error: "Nombre y descripción son obligatorios" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Debes seleccionar una imagen" });
    }

    try {
      const pool = await conectarDB();
      console.log("Archivo recibido:", req.file);

      const usuarioResult = await pool
        .request()
        .input("id_usuario", mssql.Int, req.usuario.id)
        .query(`SELECT nombre FROM usuarios WHERE id_usuario = @id_usuario`);

      const nombreUsuario =
        usuarioResult.recordset[0]?.nombre || "Usuario desconocido";

      let nombre_barber_final;
      if (req.usuario.rol === "barbero") {
        nombre_barber_final = nombreUsuario;
      } else {
        nombre_barber_final =
          (nombre_barber && nombre_barber.trim()) ||
          (nombre_barber_ref && nombre_barber_ref.trim()) ||
          nombreUsuario;
      }

      const result = await pool
        .request()
        .input("nombre", mssql.NVarChar(100), nombre)
        .input("descripcion", mssql.Text, descripcion)
        .input("nombre_barber", mssql.NVarChar(100), nombre_barber_final)
        .input("imagen_data", mssql.VarBinary(mssql.MAX), req.file.buffer)
        .input("mime_type", mssql.NVarChar(100), req.file.mimetype).query(`
          INSERT INTO ImagenCatalogo (nombre, descripcion, nombre_barber, imagen_data, mime_type)
          OUTPUT INSERTED.id_foto, INSERTED.fecha_subida
          VALUES (@nombre, @descripcion, @nombre_barber, @imagen_data, @mime_type)
        `);

      const inserted = result.recordset[0];

      res.json({
        mensaje: "Imagen subida correctamente",
        imagen: {
          id_foto: inserted.id_foto,
          nombre,
          descripcion,
          nombre_barber: nombre_barber_final,
          fecha_subida: inserted.fecha_subida,
          imagen_id: inserted.id_foto,
        },
      });
    } catch (error) {
      console.error("Error al subir imagen:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  },
);

app.get("/api/imagenes/:id", async (req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("id_foto", mssql.Int, req.params.id)
      .query(
        `SELECT imagen_data, mime_type FROM ImagenCatalogo WHERE id_foto = @id_foto`,
      );

    if (!result.recordset.length || !result.recordset[0].imagen_data) {
      return res.status(404).send("No encontrada");
    }

    const img = result.recordset[0];
    res.setHeader("Content-Type", img.mime_type || "image/jpeg");
    res.send(img.imagen_data);
  } catch (error) {
    res.status(500).send("Error");
  }
});

app.get("/api/catalogo/mis-trabajos", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
    return res
      .status(403)
      .json({ error: "Solo barberos y admins pueden ver este catálogo" });
  }

  try {
    const pool = await conectarDB();

    const result = await pool.request().query(`
      SELECT 
        id_foto,
        nombre,
        descripcion,
        nombre_barber,
        fecha_subida,
        mime_type,
        CASE WHEN imagen_data IS NOT NULL THEN 1 ELSE 0 END AS tiene_imagen
      FROM ImagenCatalogo
      ORDER BY fecha_subida DESC
    `);

    const data = result.recordset.map((item) => ({
      ...item,
      imagen_id: item.tiene_imagen ? item.id_foto : null,
    }));

    res.json(data);
  } catch (error) {
    console.error("Error al obtener catálogo:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.post(
  "/api/catalogo",
  verificarToken,
  upload.single("imagen"),
  async (req, res) => {
    if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
      return res
        .status(403)
        .json({ error: "Solo barberos y admins pueden subir imágenes" });
    }

    const { nombre, descripcion, nombre_barber_ref } = req.body;

    if (!nombre || !descripcion) {
      return res
        .status(400)
        .json({ error: "Nombre y descripción son obligatorios" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Debes seleccionar una imagen" });
    }

    try {
      const pool = await conectarDB();

      const usuarioResult = await pool
        .request()
        .input("id_usuario", mssql.Int, req.usuario.id)
        .query(`SELECT nombre FROM usuarios WHERE id_usuario = @id_usuario`);

      const nombreUsuario = usuarioResult.recordset[0]?.nombre || null;

      let nombre_barber;
      if (req.usuario.rol === "barbero") {
        nombre_barber = nombreUsuario;
      } else {
        nombre_barber =
          nombre_barber_ref && nombre_barber_ref.trim() !== ""
            ? nombre_barber_ref.trim()
            : "Referencia de internet";
      }

      await pool
        .request()
        .input("nombre", mssql.NVarChar(100), nombre)
        .input("descripcion", mssql.Text, descripcion)
        .input("nombre_barber", mssql.NVarChar(100), nombre_barber)
        .input("imagen_data", mssql.VarBinary(mssql.MAX), req.file.buffer)
        .input("mime_type", mssql.NVarChar(100), req.file.mimetype).query(`
          INSERT INTO ImagenCatalogo (nombre, descripcion, nombre_barber, imagen_data, mime_type, fecha_subida)
          VALUES (@nombre, @descripcion, @nombre_barber, @imagen_data, @mime_type, GETDATE())
        `);

      res.json({ success: true, mensaje: "Trabajo guardado correctamente" });
    } catch (error) {
      console.error("Error al subir imagen:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  },
);

app.put(
  "/api/catalogo/:id_foto",
  verificarToken,
  upload.single("imagen"),
  async (req, res) => {
    if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
      return res
        .status(403)
        .json({ error: "Solo barberos y admins pueden actualizar imágenes" });
    }

    const { id_foto } = req.params;
    const { nombre, descripcion, nombre_barber_ref } = req.body;

    if (!nombre || !descripcion) {
      return res
        .status(400)
        .json({ error: "Nombre y descripción son obligatorios" });
    }

    try {
      const pool = await conectarDB();

      const usuarioResult = await pool
        .request()
        .input("id_usuario", mssql.Int, req.usuario.id)
        .query(`SELECT nombre FROM usuarios WHERE id_usuario = @id_usuario`);

      const nombreUsuario = usuarioResult.recordset[0]?.nombre || null;

      const check = await pool
        .request()
        .input("id_foto", mssql.Int, id_foto)
        .query(
          `SELECT nombre_barber FROM ImagenCatalogo WHERE id_foto = @id_foto`,
        );

      if (!check.recordset.length) {
        return res.status(404).json({ error: "Imagen no encontrada" });
      }

      const registro = check.recordset[0];

      if (
        req.usuario.rol === "barbero" &&
        registro.nombre_barber !== nombreUsuario
      ) {
        return res
          .status(403)
          .json({ error: "No estás autorizado para editar este trabajo" });
      }

      let nombre_barber = registro.nombre_barber;
      if (req.usuario.rol === "barbero") {
        nombre_barber = nombreUsuario;
      } else if (req.usuario.rol === "admin" && nombre_barber_ref?.trim()) {
        nombre_barber = nombre_barber_ref.trim();
      }

      if (req.file) {
        await pool
          .request()
          .input("id_foto", mssql.Int, id_foto)
          .input("nombre", mssql.NVarChar(100), nombre)
          .input("descripcion", mssql.Text, descripcion)
          .input("nombre_barber", mssql.NVarChar(100), nombre_barber)
          .input("imagen_data", mssql.VarBinary(mssql.MAX), req.file.buffer)
          .input("mime_type", mssql.NVarChar(100), req.file.mimetype).query(`
            UPDATE ImagenCatalogo
            SET nombre        = @nombre,
                descripcion   = @descripcion,
                nombre_barber = @nombre_barber,
                imagen_data   = @imagen_data,
                mime_type     = @mime_type
            WHERE id_foto = @id_foto
          `);
      } else {
        await pool
          .request()
          .input("id_foto", mssql.Int, id_foto)
          .input("nombre", mssql.NVarChar(100), nombre)
          .input("descripcion", mssql.Text, descripcion)
          .input("nombre_barber", mssql.NVarChar(100), nombre_barber).query(`
            UPDATE ImagenCatalogo
            SET nombre        = @nombre,
                descripcion   = @descripcion,
                nombre_barber = @nombre_barber
            WHERE id_foto = @id_foto
          `);
      }

      res.json({ success: true, mensaje: "Trabajo actualizado correctamente" });
    } catch (error) {
      console.error("Error al actualizar imagen:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  },
);

app.delete("/api/catalogo/:id_foto", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
    return res
      .status(403)
      .json({ error: "Solo barberos y admins pueden eliminar imágenes" });
  }

  const { id_foto } = req.params;

  try {
    const pool = await conectarDB();

    const usuarioResult = await pool
      .request()
      .input("id_usuario", mssql.Int, req.usuario.id)
      .query(`SELECT nombre FROM usuarios WHERE id_usuario = @id_usuario`);

    const nombreUsuario = usuarioResult.recordset[0]?.nombre || null;

    const check = await pool
      .request()
      .input("id_foto", mssql.Int, id_foto)
      .query(
        `SELECT nombre_barber FROM ImagenCatalogo WHERE id_foto = @id_foto`,
      );

    if (!check.recordset.length) {
      return res.status(404).json({ error: "Imagen no encontrada" });
    }

    const registro = check.recordset[0];

    if (
      req.usuario.rol === "barbero" &&
      registro.nombre_barber !== nombreUsuario
    ) {
      return res
        .status(403)
        .json({ error: "No estás autorizado para eliminar este trabajo" });
    }

    await pool
      .request()
      .input("id_foto", mssql.Int, id_foto)
      .query(`DELETE FROM ImagenCatalogo WHERE id_foto = @id_foto`);

    res.json({ success: true, mensaje: "Imagen eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar imagen:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.post("/api/mensajes", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
    return res
      .status(403)
      .json({ error: "Solo barberos y admins pueden crear mensajes" });
  }

  const { mensaje, tipo } = req.body;
  const tiposPermitidos = ["info", "ocupado", "trabajando"];

  if (!mensaje || !mensaje.trim()) {
    return res.status(400).json({ error: "El mensaje no puede estar vacío" });
  }

  const tipoFinal = tiposPermitidos.includes(tipo) ? tipo : "info";

  try {
    const pool = await conectarDB();

    const result = await pool
      .request()
      .input("id_barbero", mssql.Int, req.usuario.id)
      .input("mensaje", mssql.NVarChar(700), mensaje.trim())
      .input("tipo", mssql.VarChar(20), tipoFinal).query(`
        INSERT INTO Mensajes (id_barbero, mensaje, tipo, activo)
        OUTPUT INSERTED.id_mensaje, INSERTED.creado_en
        VALUES (@id_barbero, @mensaje, @tipo, 1)
      `);

    const inserted = result.recordset[0];

    res.json({
      mensaje: "Mensaje creado",
      data: {
        id_mensaje: inserted.id_mensaje,
        id_barbero: req.usuario.id,
        mensaje: mensaje.trim(),
        tipo: tipoFinal,
        activo: true,
        creado_en: inserted.creado_en,
      },
    });
  } catch (error) {
    console.error("Error al crear mensaje:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/api/mensajes/mis-mensajes", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
    return res
      .status(403)
      .json({ error: "Solo barberos y admins pueden ver estos mensajes" });
  }

  try {
    const pool = await conectarDB();

    const result = await pool
      .request()
      .input("id_barbero", mssql.Int, req.usuario.id).query(`
        SELECT id_mensaje, id_barbero, mensaje, tipo, activo, creado_en
        FROM Mensajes
        WHERE id_barbero = @id_barbero and activo = 1
        ORDER BY creado_en DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Error al obtener mensajes:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.put("/api/mensajes/:id_mensaje", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
    return res
      .status(403)
      .json({ error: "Solo barberos y admins pueden editar mensajes" });
  }

  const id_mensaje = parseInt(req.params.id_mensaje, 10);
  if (isNaN(id_mensaje)) {
    return res.status(400).json({ error: "id_mensaje inválido" });
  }

  const { mensaje, tipo } = req.body;
  const tiposPermitidos = ["info", "ocupado", "trabajando"];

  if (!mensaje || !mensaje.trim()) {
    return res.status(400).json({ error: "El mensaje no puede estar vacío" });
  }

  const tipoFinal = tiposPermitidos.includes(tipo) ? tipo : "info";

  try {
    const pool = await conectarDB();

    const result = await pool
      .request()
      .input("id_mensaje", mssql.Int, id_mensaje)
      .input("id_barbero", mssql.Int, req.usuario.id)
      .input("mensaje", mssql.NVarChar(700), mensaje.trim())
      .input("tipo", mssql.VarChar(20), tipoFinal).query(`
        UPDATE Mensajes
        SET mensaje = @mensaje,
            tipo = @tipo
        WHERE id_mensaje = @id_mensaje
          AND id_barbero = @id_barbero;

        SELECT id_mensaje, id_barbero, mensaje, tipo, activo, creado_en
        FROM Mensajes
        WHERE id_mensaje = @id_mensaje
          AND id_barbero = @id_barbero;
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ error: "Mensaje no encontrado" });
    }

    res.json({ mensaje: "Mensaje actualizado", data: result.recordset[0] });
  } catch (error) {
    console.error("Error al actualizar mensaje:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.patch(
  "/api/mensajes/:id_mensaje/activo",
  verificarToken,
  async (req, res) => {
    if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
      return res.status(403).json({
        error: "Solo barberos y admins pueden cambiar estado de mensajes",
      });
    }

    const id_mensaje = parseInt(req.params.id_mensaje, 10);
    if (isNaN(id_mensaje)) {
      return res.status(400).json({ error: "id_mensaje inválido" });
    }

    const { activo } = req.body;
    const activoBool = Boolean(activo);

    try {
      const pool = await conectarDB();

      const result = await pool
        .request()
        .input("id_mensaje", mssql.Int, id_mensaje)
        .input("id_barbero", mssql.Int, req.usuario.id)
        .input("activo", mssql.Bit, activoBool).query(`
        UPDATE Mensajes
        SET activo = @activo
        WHERE id_mensaje = @id_mensaje
          AND id_barbero = @id_barbero;

        SELECT id_mensaje, id_barbero, mensaje, tipo, activo, creado_en
        FROM Mensajes
        WHERE id_mensaje = @id_mensaje
          AND id_barbero = @id_barbero;
      `);

      if (!result.recordset.length) {
        return res.status(404).json({ error: "Mensaje no encontrado" });
      }

      res.json({
        mensaje: "Estado de mensaje actualizado",
        data: result.recordset[0],
      });
    } catch (error) {
      console.error("Error al cambiar estado de mensaje:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  },
);

app.get("/api/mensajes/publico", verificarToken, async (req, res) => {
  try {
    const pool = await conectarDB();

    const result = await pool.request().query(`
      SELECT m.id_mensaje,
             m.id_barbero,
             u.nombre AS nombre_barber,
             m.mensaje,
             m.tipo,
             m.activo,
             m.creado_en
      FROM Mensajes m
      JOIN Usuarios u ON m.id_barbero = u.id_usuario
      WHERE m.activo = 1
      ORDER BY m.creado_en DESC
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Error al obtener mensajes públicos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});
app.get("/api/catalogo/imagen/:id", async (req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("id_foto", mssql.Int, parseInt(req.params.id)).query(`
        SELECT imagen_data, mime_type FROM ImagenCatalogo WHERE id_foto = @id_foto
      `);

    const row = result.recordset[0];

    if (!row || !row.imagen_data)
      return res.status(404).json({ error: "Imagen no encontrada" });

    res.setHeader("Content-Type", row.mime_type || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(row.imagen_data);
  } catch (error) {
    console.error("Error al servir imagen catálogo:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});
app.get("/api/catalogo/por-barber", verificarToken, async (req, res) => {
  let nombre_barber = req.query.nombre_barber;

  if (!nombre_barber)
    return res.status(400).json({ error: "nombre_barber es requerido" });

  nombre_barber = String(nombre_barber).trim().substring(0, 100);

  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("nombre_barber", mssql.NVarChar(100), nombre_barber).query(`
        SELECT id_foto, nombre, descripcion, nombre_barber, fecha_subida, mime_type
        FROM ImagenCatalogo
        WHERE nombre_barber = @nombre_barber
        ORDER BY fecha_subida DESC
      `);

    const data = result.recordset.map((row) => ({
      ...row,
      url_imagen: `/api/catalogo/imagen/${row.id_foto}`,
    }));

    return res.json(data);
  } catch (error) {
    console.error("Error al obtener catálogo por barbero:", error);
    return res
      .status(500)
      .json({ error: "Error interno del servidor", detalle: String(error) });
  }
});

app.get("/api/catalogo/historial", verificarToken, async (req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool.request().query(`
      SELECT TOP 40 id_foto, nombre, descripcion, nombre_barber, fecha_subida, mime_type
      FROM ImagenCatalogo
      ORDER BY fecha_subida DESC
    `);

    const data = result.recordset.map((row) => ({
      ...row,
      url_imagen: `/api/catalogo/imagen/${row.id_foto}`,
    }));

    res.json(data);
  } catch (error) {
    console.error("Error al obtener historial catálogo:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/api/horario-semanal", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("id_barbero", mssql.Int, req.usuario.id).query(`
      SELECT dia_semana, hora_inicio, hora_fin, duracion_minutos, activo
      FROM HorarioSemanalBarbero
      WHERE id_barbero = @id_barbero
      ORDER BY dia_semana
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error al obtener horario semanal:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/api/horario-dia", verificarToken, async (req, res) => {
  try {
    const { fecha } = req.query;
    if (!fecha) {
      return res.status(400).json({ error: "Se requiere fecha" });
    }

    const id_barbero = req.usuario.id;
    const pool = await conectarDB();

    const fechaObj = new Date(fecha + "T00:00:00");
    const diaSemana = fechaObj.getDay();

    const sem = await pool
      .request()
      .input("id_barbero", mssql.Int, id_barbero)
      .input("dia_semana", mssql.TinyInt, diaSemana).query(`
        SELECT hora_inicio, hora_fin, duracion_minutos
        FROM HorarioSemanalBarbero
        WHERE id_barbero = @id_barbero 
          AND dia_semana = @dia_semana 
          AND activo = 1
      `);

    const bloques = sem.recordset;

    if (bloques.length === 0) {
      return res.json({
        horarioTipo: "semanal",
        slots: [],
      });
    }

    const slots = [];

    for (const b of bloques) {
      const dur = b.duracion_minutos || 45;

      const inicioStr = (b.hora_inicio || "").slice(0, 5);
      const finStr = (b.hora_fin || "").slice(0, 5);

      if (!inicioStr || !finStr || inicioStr.length < 4 || finStr.length < 4) {
        continue;
      }

      const [hIni, mIni] = inicioStr.split(":").map((n) => parseInt(n));
      const [hFin, mFin] = finStr.split(":").map((n) => parseInt(n));

      let inicioMin = hIni * 60 + mIni;
      const finMin = hFin * 60 + mFin;

      while (inicioMin < finMin) {
        const hh = String(Math.floor(inicioMin / 60)).padStart(2, "0");
        const mm = String(inicioMin % 60).padStart(2, "0");
        slots.push({
          hora: `${hh}:${mm}`,
          disponible: true,
        });
        inicioMin += dur;
      }
    }

    const citasRes = await pool
      .request()
      .input("id_barbero", mssql.Int, id_barbero)
      .input("fecha", mssql.Date, fecha).query(`
        SELECT hora, estado, id_usuario, servicio
        FROM Citas
        WHERE id_barbero = @id_barbero
          AND fecha = @fecha   
          AND estado NOT IN ('cancelada')
      `);

    const citas = citasRes.recordset || [];

    const citasPorHora = new Map();
    for (const c of citas) {
      const horaCita = c.hora.slice(0, 5);
      citasPorHora.set(horaCita, c);
    }

    const slotsFinal = slots.map((s) => {
      const cita = citasPorHora.get(s.hora);
      return {
        ...s,
        disponible: !cita,
      };
    });

    res.json({
      horarioTipo: "semanal",
      slots: slotsFinal,
    });
  } catch (err) {
    console.error("Error en /api/horario-dia:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.get("/api/citas-dia", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  const { fecha } = req.query;

  if (!fecha) {
    return res.status(400).json({ error: "Fecha requerida" });
  }

  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("id_barbero", mssql.Int, req.usuario.id)
      .input("fecha", mssql.Date, fecha).query(`
        SELECT c.id_cita, c.hora, c.estado,
        s.nombre AS servicio_nombre, 
        c.notas,
      u.nombre AS cliente_nombre
    FROM Citas c
    LEFT JOIN Usuarios u ON c.id_usuario = u.id_usuario
    LEFT JOIN Servicios s ON c.servicio = s.id_servicio
    WHERE c.id_barbero = @id_barbero AND c.fecha = @fecha
          AND c.estado NOT IN ('cancelada')
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error al obtener citas del día:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.post("/api/marcar-dia", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  const { fecha, tipo, mensaje } = req.body;

  if (!fecha || !tipo) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  try {
    const pool = await conectarDB();

    await pool
      .request()
      .input("id_barbero", mssql.Int, req.usuario.id)
      .input("fecha", mssql.Date, fecha)
      .input("mensaje", mssql.NVarChar(500), mensaje || tipo)
      .input("tipo", mssql.VarChar(20), tipo).query(`
        INSERT INTO MensajesCalendario (id_barbero, fecha, mensaje, tipo, activo)
        VALUES (@id_barbero, @fecha, @mensaje, @tipo, 1)
      `);

    res.json({ mensaje: "Día marcado correctamente" });
  } catch (err) {
    console.error("Error al marcar día:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.post("/api/marcar-slot", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  const { fecha, hora, tipo } = req.body;

  if (!fecha || !hora) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  try {
    const pool = await conectarDB();
    const idUsuario = req.usuario.id;
    const idBarbero = req.usuario.id;
    const servicioResult = await pool.request().query(`
      SELECT TOP 1 id_servicio FROM Servicios ORDER BY id_servicio
    `);
    if (servicioResult.recordset.length === 0) {
      return res.status(500).json({ error: "No hay servicios definidos" });
    }

    const idServicio = servicioResult.recordset[0].id_servicio;

    await pool
      .request()
      .input("id_usuario", mssql.Int, idUsuario)
      .input("id_barbero", mssql.Int, idBarbero)
      .input("fecha", mssql.Date, fecha)
      .input("hora", mssql.VarChar(8), hora)
      .input("servicio", mssql.Int, idServicio)
      .input("estado", mssql.VarChar(20), "confirmada").query(`
        INSERT INTO Citas (id_usuario, id_barbero, fecha, hora, servicio, estado)
        VALUES (@id_usuario, @id_barbero, @fecha, @hora, @servicio, @estado)
      `);

    res.json({ mensaje: "Slot marcado" });
  } catch (err) {
    console.error("Error al marcar slot:", err);
    res
      .status(500)
      .json({ error: "Error interno del servidor", detalle: err.message });
  }
});

app.post("/api/liberar-slot", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  const { id_cita } = req.body;
  const id_barbero = req.usuario.id;

  if (!id_cita) {
    return res.status(400).json({ error: "id_cita requerido" });
  }

  try {
    const pool = await conectarDB();

    const result = await pool
      .request()
      .input("id_cita", mssql.Int, id_cita)
      .input("id_barbero", mssql.Int, id_barbero).query(`
        DELETE FROM Citas
        WHERE id_cita = @id_cita AND id_barbero = @id_barbero
      `);

    if (!result.rowsAffected || result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Slot no encontrado" });
    }

    res.json({ mensaje: "Slot liberado" });
  } catch (err) {
    console.error("Error al liberar slot:", err);
    res
      .status(500)
      .json({ error: "Error interno del servidor", detalle: err.message });
  }
});

app.get("/api/notificaciones-cliente", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "cliente") {
    return res.status(403).json({ error: "Solo clientes" });
  }

  const idCliente = req.usuario.id;

  try {
    const pool = await conectarDB();

    const proximaResult = await pool
      .request()
      .input("id_usuario", mssql.Int, idCliente).query(`
        SELECT TOP 1
          id_cita,
          fecha,
          hora,
          estado
        FROM Citas
        WHERE id_usuario = @id_usuario
          AND fecha >= CAST(GETDATE() AS DATE)
          AND estado IN ('pendiente', 'confirmada')
        ORDER BY fecha ASC, hora ASC
      `);

    const ultimaResult = await pool
      .request()
      .input("id_usuario", mssql.Int, idCliente).query(`
        SELECT TOP 1
          id_cita,
          fecha,
          hora,
          estado
        FROM Citas
        WHERE id_usuario = @id_usuario
          AND fecha < CAST(GETDATE() AS DATE)
        ORDER BY fecha DESC, hora DESC
      `);

    const notificaciones = [];
    const hoy = new Date();
    const hoysolo = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    if (proximaResult.recordset.length > 0) {
      const cita = proximaResult.recordset[0];
      const fechaCita = new Date(cita.fecha);
      const citasolo = new Date(
        fechaCita.getFullYear(),
        fechaCita.getMonth(),
        fechaCita.getDate(),
      );
      const diffMs = citasolo - hoysolo;
      const diffDias = diffMs / (1000 * 60 * 60 * 24);

      notificaciones.push({
        tipo: "proxima_cita",
        id_cita: cita.id_cita,
        fecha: cita.fecha,
        hora: cita.hora,
        estado: cita.estado,
      });

      if (diffDias === 1) {
        notificaciones.push({
          tipo: "recordatorio_un_dia_antes",
          id_cita: cita.id_cita,
          fecha: cita.fecha,
          hora: cita.hora,
          estado: cita.estado,
        });
      }
    }

    if (ultimaResult.recordset.length > 0) {
      const ultima = ultimaResult.recordset[0];
      const fechaUltima = new Date(ultima.fecha);

      const diffMs =
        hoysolo -
        new Date(
          fechaUltima.getFullYear(),
          fechaUltima.getMonth(),
          fechaUltima.getDate(),
        );
      const diffDias = diffMs / (1000 * 60 * 60 * 24);

      if (diffDias >= 30) {
        notificaciones.push({
          tipo: "ultima_hace_mes",
          id_cita: ultima.id_cita,
          fecha: ultima.fecha,
          hora: ultima.hora,
          estado: ultima.estado,
        });
      }
    }

    res.json(notificaciones);
  } catch (err) {
    console.error("Error obteniendo notificaciones cliente:", err);
    res
      .status(500)
      .json({ error: "Error interno del servidor", detalle: err.message });
  }
});
app.get("/api/notificaciones/barbero", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin") {
    return res
      .status(403)
      .json({ error: "Solo barberos pueden ver estas notificaciones" });
  }

  try {
    const pool = await conectarDB();

    const result = await pool
      .request()
      .input("id_barbero", mssql.Int, req.usuario.id).query(`
        SELECT 
          c.id_cita,
          c.fecha,
          c.hora,
          c.estado,
          c.creado_en,
          u.nombre AS nombre_cliente,
          s.nombre AS nombre_servicio
        FROM Citas c
        JOIN Usuarios u ON c.id_usuario = u.id_usuario
        JOIN Servicios s ON c.servicio = s.id_servicio
        WHERE c.id_barbero = @id_barbero
          AND c.creado_en >= DATEADD(DAY, -7, GETDATE())
        ORDER BY c.creado_en DESC
      `);

    const citas = result.recordset;

    const notificaciones = citas.map((c) => {
      let tipo;
      let titulo;
      let mensaje;

      switch (c.estado) {
        case "pendiente":
          tipo = "nueva";
          titulo = "Nueva cita agendada";
          mensaje = `El cliente ${c.nombre_cliente} ha agendado una cita para ${c.nombre_servicio}`;
          break;
        case "cancelada":
          tipo = "cancelada";
          titulo = "Cita cancelada";
          mensaje = `${c.nombre_cliente} ha cancelado su cita para ${c.nombre_servicio}`;
          break;
        case "confirmada":
          tipo = "confirmada";
          titulo = "Cita confirmada";
          mensaje = `${c.nombre_cliente} ha confirmado su cita para ${c.nombre_servicio}`;
          break;
        case "completada":
          tipo = "completada";
          titulo = "Cita completada";
          mensaje = `Cita con ${c.nombre_cliente} para ${c.nombre_servicio} ha sido completada`;
          break;
        default:
          tipo = "nueva";
          titulo = "Actualización de cita";
          mensaje = `Cambio en la cita de ${c.nombre_cliente} para ${c.nombre_servicio}`;
      }

      return {
        id_cita: c.id_cita,
        tipo,
        titulo,
        mensaje,
        fecha_cita: c.fecha,
        hora_inicio: c.hora,
        nombre_cliente: c.nombre_cliente,
        nombre_servicio: c.nombre_servicio,
        timestamp: c.creado_en,
      };
    });

    res.json(notificaciones);
  } catch (error) {
    console.error("Error al obtener notificaciones barbero:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

function timeToHHMM(t) {
  if (!t) return null;

  if (typeof t === "string") {
    return t.slice(0, 5);
  }

  if (t instanceof Date) {
    const hh = String(t.getHours()).padStart(2, "0");
    const mm = String(t.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  const s = String(t);
  return s.slice(0, 5);
}
app.get("/api/horario-dia", verificarToken, async (req, res) => {
  try {
    const { fecha } = req.query;
    if (!fecha) {
      return res.status(400).json({ error: "Se requiere fecha" });
    }

    const id_barbero = req.usuario.id;
    const pool = await conectarDB();

    const fechaObj = new Date(fecha + "T00:00:00");
    const diaSemana = fechaObj.getDay();

    const sem = await pool
      .request()
      .input("id_barbero", mssql.Int, id_barbero)
      .input("dia_semana", mssql.TinyInt, diaSemana).query(`
        SELECT hora_inicio, hora_fin, duracion_minutos
        FROM HorarioSemanalBarbero
        WHERE id_barbero = @id_barbero 
          AND dia_semana = @dia_semana 
          AND activo = 1
      `);

    const bloques = sem.recordset;

    if (bloques.length === 0) {
      return res.json({
        horarioTipo: "semanal",
        slots: [],
      });
    }

    const slots = [];
    for (const b of bloques) {
      const dur = b.duracion_minutos || 45;

      const inicioStr = timeToHHMM(b.hora_inicio);
      const finStr = timeToHHMM(b.hora_fin);

      if (!inicioStr || !finStr) continue;

      let [hIni, mIni] = inicioStr.split(":").map((n) => parseInt(n));
      let [hFin, mFin] = finStr.split(":").map((n) => parseInt(n));

      let inicioMin = hIni * 60 + mIni;
      const finMin = hFin * 60 + mFin;

      while (inicioMin < finMin) {
        const hh = String(Math.floor(inicioMin / 60)).padStart(2, "0");
        const mm = String(inicioMin % 60).padStart(2, "0");
        slots.push({
          hora: `${hh}:${mm}`,
          disponible: true,
        });
        inicioMin += dur;
      }
    }

    const citasRes = await pool
      .request()
      .input("id_barbero", mssql.Int, id_barbero)
      .input("fecha", mssql.Date, fecha).query(`
        SELECT hora, estado, cliente_nombre, servicio
        FROM Citas
        WHERE id_barbero = @id_barbero
          AND fecha = @fecha
          AND estado NOT IN ('cancelada')
      `);

    const citas = citasRes.recordset || [];

    const citasPorHora = new Map();
    for (const c of citas) {
      const horaCita = c.hora.slice(0, 5);
      citasPorHora.set(horaCita, c);
    }

    const slotsFinal = slots.map((s) => {
      const cita = citasPorHora.get(s.hora);
      return {
        ...s,
        disponible: !cita,
      };
    });

    res.json({
      horarioTipo: "semanal",
      slots: slotsFinal,
    });
  } catch (err) {
    console.error("Error en /api/horario-dia:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

function formatTime(dOrStr) {
  if (typeof dOrStr === "string") {
    return dOrStr.slice(0, 5);
  }
  const h = String(dOrStr.getHours()).padStart(2, "0");
  const m = String(dOrStr.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

const storageRef = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/referencias"),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "ref-" + unique + path.extname(file.originalname));
  },
});

const uploadReferencia = multer({
  storage: storageRef,
  limits: { fileSize: 5 * 1024 * 1024 },
});
app.get("/api/barberos", verificarToken, async (req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool.request().query(`
      SELECT id, nombre
      FROM Usuarios
      WHERE rol = 'barbero' AND activo = 1
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error en /api/barberos:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.get("/api/servicios", verificarToken, async (req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool.request().query(`
      SELECT id_servicio, nombre, precio
      FROM Servicios
      ORDER BY nombre
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error en GET /api/servicios:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

function requireBarberoOrAdmin(req, res, next) {
  const rol = req.usuario.rol;
  if (rol === "barbero" || rol === "admin") return next();
  return res.status(403).json({ error: "No autorizado" });
}

app.patch(
  "/api/citas/:id_cita/estado",
  verificarToken,
  requireBarberoOrAdmin,
  async (req, res) => {
    try {
      const { id_cita } = req.params;
      const { estado } = req.body;

      const estadosPermitidos = [
        "pendiente",
        "confirmada",
        "cancelada",
        "completada",
      ];

      if (!estado) {
        return res
          .status(400)
          .json({ error: "El campo 'estado' es requerido" });
      }

      if (!estadosPermitidos.includes(estado)) {
        return res.status(400).json({
          error: "Estado no válido",
          estadosPermitidos,
          recibido: estado,
        });
      }

      const pool = await conectarDB();

      const result = await pool
        .request()
        .input("id_cita", mssql.Int, parseInt(id_cita, 10))
        .input("estado", mssql.VarChar(14), estado).query(`
          UPDATE Citas
          SET estado = @estado
          WHERE id_cita = @id_cita
        `);

      console.log("rowsAffected:", result.rowsAffected);

      if (!result.rowsAffected || result.rowsAffected[0] === 0) {
        return res.status(404).json({ error: "Cita no encontrada" });
      }

      return res.json({ message: "Estado actualizado correctamente" });
    } catch (err) {
      console.error("Error en PATCH /api/citas/:id_cita/estado:", err);
      return res
        .status(500)
        .json({ error: "Error en el servidor", detalle: err.message });
    }
  },
);

app.patch(
  "/api/citas/:id_cita/reagendar",
  verificarToken,
  requireBarberoOrAdmin,
  async (req, res) => {
    try {
      const { id_cita } = req.params;
      const { fecha, hora } = req.body;

      if (!fecha || !hora) {
        return res.status(400).json({ error: "Fecha y hora son obligatorias" });
      }

      const pool = await conectarDB();

      const citaRes = await pool.request().input("id_cita", mssql.Int, id_cita)
        .query(`
          SELECT id_barbero
          FROM Citas
          WHERE id_cita = @id_cita
        `);

      if (citaRes.recordset.length === 0) {
        return res.status(404).json({ error: "Cita no encontrada" });
      }

      const id_barbero = citaRes.recordset[0].id_barbero;

      const check = await pool
        .request()
        .input("id_barbero", mssql.Int, id_barbero)
        .input("fecha", mssql.Date, fecha)
        .input("hora", mssql.VarChar(8), hora)
        .input("id_cita", mssql.Int, id_cita).query(`
          SELECT COUNT(*) AS total
          FROM Citas
          WHERE id_barbero = @id_barbero
            AND fecha = @fecha
            AND hora = @hora
            AND estado NOT IN ('cancelada')
            AND id_cita <> @id_cita
        `);

      if (check.recordset[0].total > 0) {
        return res
          .status(400)
          .json({ error: "El nuevo horario ya está ocupado" });
      }

      const upd = await pool
        .request()
        .input("id_cita", mssql.Int, id_cita)
        .input("fecha", mssql.Date, fecha)
        .input("hora", mssql.VarChar(8), hora).query(`
          UPDATE Citas
          SET fecha = @fecha,
              hora  = @hora
          WHERE id_cita = @id_cita
        `);

      if (upd.rowsAffected[0] === 0) {
        return res.status(404).json({ error: "Cita no encontrada" });
      }

      res.json({ message: "Cita reagendada correctamente" });
    } catch (err) {
      console.error("Error en PATCH /api/citas/:id_cita/reagendar:", err);
      res.status(500).json({ error: "Error en el servidor" });
    }
  },
);

app.post(
  "/api/servicios",
  verificarToken,
  requireBarberoOrAdmin,
  async (req, res) => {
    try {
      const { id_servicio, nombre, precio } = req.body;
      const pool = await conectarDB();

      if (!nombre || !precio) {
        return res.status(400).json({ error: "Faltan datos de servicio" });
      }

      if (id_servicio) {
        await pool
          .request()
          .input("id_servicio", mssql.Int, id_servicio)
          .input("nombre", mssql.VarChar(50), nombre)
          .input("precio", mssql.Decimal(5, 2), precio).query(`
          UPDATE Servicios
          SET nombre = @nombre,
              precio = @precio
          WHERE id_servicio = @id_servicio
        `);
      } else {
        await pool
          .request()
          .input("nombre", mssql.VarChar(50), nombre)
          .input("precio", mssql.Decimal(5, 2), precio).query(`
          INSERT INTO Servicios (nombre, precio)
          VALUES (@nombre, @precio)
        `);
      }

      res.json({ message: "Servicio guardado" });
    } catch (err) {
      console.error("Error en POST /api/servicios:", err);
      res.status(500).json({ error: "Error en el servidor" });
    }
  },
);

app.get("/api/horario-dia-barbero", verificarToken, async (req, res) => {
  try {
    const { fecha, id_barbero } = req.query;

    if (!fecha || !id_barbero) {
      return res.status(400).json({ error: "Se requiere fecha e id_barbero" });
    }

    const pool = await conectarDB();

    const fechaObj = new Date(fecha + "T00:00:00");
    const diaSemana = fechaObj.getDay();

    console.log("DEBUG /api/horario-dia-barbero:", {
      fecha,
      id_barbero,
      diaSemana,
    });

    const sem = await pool
      .request()
      .input("id_barbero", mssql.Int, id_barbero)
      .input("dia_semana", mssql.TinyInt, diaSemana).query(`
        SELECT hora_inicio, hora_fin, duracion_minutos
        FROM HorarioSemanalBarbero
        WHERE id_barbero = 1
          AND dia_semana = @dia_semana 
          AND activo = 1
      `);

    const bloques = sem.recordset;

    console.log("DEBUG bloques encontrados:", bloques);

    if (bloques.length === 0) {
      return res.json({ horarioTipo: "semanal", slots: [] });
    }

    const slots = [];

    for (const b of bloques) {
      const dur = b.duracion_minutos || 45;
      const inicioStr = (b.hora_inicio || "").slice(0, 5);
      const finStr = (b.hora_fin || "").slice(0, 5);

      if (!inicioStr || !finStr || inicioStr.length < 4 || finStr.length < 4) {
        continue;
      }

      const [hIni, mIni] = inicioStr.split(":").map((n) => parseInt(n));
      const [hFin, mFin] = finStr.split(":").map((n) => parseInt(n));

      let inicioMin = hIni * 60 + mIni;
      const finMin = hFin * 60 + mFin;

      while (inicioMin < finMin) {
        const hh = String(Math.floor(inicioMin / 60)).padStart(2, "0");
        const mm = String(inicioMin % 60).padStart(2, "0");
        slots.push({ hora: `${hh}:${mm}`, disponible: true });
        inicioMin += dur;
      }
    }

    console.log("DEBUG slots generados:", slots.length);

    const citasRes = await pool
      .request()
      .input("id_barbero", mssql.Int, id_barbero)
      .input("fecha", mssql.Date, fecha).query(`
        SELECT hora
        FROM Citas
        WHERE id_barbero = @id_barbero
          AND fecha = @fecha
          AND estado NOT IN ('cancelada')
      `);

    const citas = citasRes.recordset || [];
    console.log("DEBUG citas encontradas:", citas);

    const citasPorHora = new Set(citas.map((c) => c.hora.slice(0, 5)));

    const slotsFinal = slots.map((s) => ({
      ...s,
      disponible: !citasPorHora.has(s.hora),
    }));

    console.log("DEBUG slots finales:", slotsFinal);

    res.json({ horarioTipo: "semanal", slots: slotsFinal });
  } catch (err) {
    console.error("Error en /api/horario-dia-barbero:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.get("/api/citas/puede-agendar", verificarToken, async (req, res) => {
  try {
    const id_usuario = req.usuario.id;
    const pool = await conectarDB();

    const checkRango = await pool
      .request()
      .input("id_usuario", mssql.Int, id_usuario).query(`
        SELECT TOP 1 fecha, hora, servicio
        FROM Citas
        WHERE id_usuario = @id_usuario
          AND estado IN ('pendiente','confirmada')
          AND fecha >= CAST(GETDATE() AS DATE)
          AND fecha < DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
        ORDER BY fecha, hora
      `);

    if (checkRango.recordset.length > 0) {
      return res.json({
        puede_agendar: false,
        cita: checkRango.recordset[0],
      });
    }

    res.json({ puede_agendar: true });
  } catch (err) {
    console.error("Error en GET /api/citas/puede-agendar:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});
app.post(
  "/api/citas",
  verificarToken,
  upload.single("referencia_foto"),
  async (req, res) => {
    const { id_barbero, fecha, hora, id_servicio, notas, precio_estimado } =
      req.body;

    if (!id_barbero || !fecha || !hora || !id_servicio)
      return res.status(400).json({ error: "Datos incompletos" });

    try {
      const pool = await conectarDB();

      const existe = await pool
        .request()
        .input("id_barbero", mssql.Int, parseInt(id_barbero))
        .input("fecha", mssql.Date, fecha)
        .input("hora", mssql.VarChar(8), hora).query(`
        SELECT id_cita FROM Citas
        WHERE id_barbero = @id_barbero AND fecha = @fecha AND hora = @hora
          AND estado NOT IN ('cancelada')
      `);

      if (existe.recordset.length > 0)
        return res.status(409).json({ error: "Este horario ya está ocupado" });

      const fotoBuffer = req.file ? req.file.buffer : null;
      const fotoMime = req.file ? req.file.mimetype : null;

      await pool
        .request()
        .input("id_usuario", mssql.Int, req.usuario.id)
        .input("id_barbero", mssql.Int, parseInt(id_barbero))
        .input("fecha", mssql.Date, fecha)
        .input("hora", mssql.VarChar(8), hora)
        .input("servicio", mssql.Int, parseInt(id_servicio))
        .input("notas", mssql.Text, notas || null)
        .input(
          "precio_estimado",
          mssql.Decimal(5, 2),
          parseFloat(precio_estimado) || 0,
        )
        .input("referencia_foto", mssql.VarBinary(mssql.MAX), fotoBuffer)
        .input("referencia_mime", mssql.NVarChar(50), fotoMime).query(`
        INSERT INTO Citas 
          (id_usuario, id_barbero, fecha, hora, servicio, notas, precio_estimado, referencia_foto, referencia_foto_mime, estado)
        VALUES 
          (@id_usuario, @id_barbero, @fecha, @hora, @servicio, @notas, @precio_estimado, @referencia_foto, @referencia_mime, 'pendiente')
      `);

      res.json({ mensaje: "Cita agendada correctamente" });
    } catch (err) {
      console.error("Error al agendar cita:", err);
      res
        .status(500)
        .json({ error: "Error interno del servidor", detalle: err.message });
    }
  },
);
app.get("/api/citas/:id/referencia-foto", verificarToken, async (req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("id_cita", mssql.Int, parseInt(req.params.id))
      .query(
        `SELECT referencia_foto, referencia_foto_mime FROM Citas WHERE id_cita = @id_cita`,
      );

    const row = result.recordset[0];
    if (!row || !row.referencia_foto)
      return res.status(404).json({ error: "Sin foto de referencia" });

    res.setHeader("Content-Type", row.referencia_foto_mime || "image/jpeg");
    res.send(row.referencia_foto);
  } catch (err) {
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/api/citas/:id/detalle", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "barbero" && req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso denegado" });

  try {
    const pool = await conectarDB();
    const id_cita = parseInt(req.params.id);

    const citaResult = await pool.request().input("id_cita", mssql.Int, id_cita)
      .query(`
        SELECT 
          c.precio_estimado, c.notas, c.estado,
          CASE WHEN c.referencia_foto IS NOT NULL THEN 1 ELSE 0 END AS tiene_foto,
          s.nombre AS servicio_nombre,
          u.nombre AS cliente_nombre,
          u.email,
          u.telefono
        FROM Citas c
        LEFT JOIN Usuarios u ON c.id_usuario = u.id_usuario
        LEFT JOIN Servicios s ON c.servicio = s.id_servicio
        WHERE c.id_cita = @id_cita
      `);

    if (!citaResult.recordset.length)
      return res.status(404).json({ error: "Cita no encontrada" });

    const cita = citaResult.recordset[0];

    const statsResult = await pool
      .request()
      .input("id_cita", mssql.Int, id_cita).query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) AS completadas,
          SUM(CASE WHEN estado IN ('pendiente','confirmada') THEN 1 ELSE 0 END) AS pendientes
        FROM Citas
        WHERE id_usuario = (SELECT id_usuario FROM Citas WHERE id_cita = @id_cita)
      `);

    res.json({
      ...cita,
      stats: statsResult.recordset[0],
    });
  } catch (err) {
    console.error("Error en /api/citas/:id/detalle:", err);
    res
      .status(500)
      .json({ error: "Error interno del servidor", detalle: err.message });
  }
});
app.post("/api/citas/:id_cita/confirmar", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "cliente")
    return res.status(403).json({ error: "Solo clientes" });

  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("id_cita", mssql.Int, req.params.id_cita)
      .input("id_usuario", mssql.Int, req.usuario.id)
      .query(
        `UPDATE Citas SET estado = 'confirmada' WHERE id_cita = @id_cita AND id_usuario = @id_usuario`,
      );

    if (!result.rowsAffected[0])
      return res.status(404).json({ error: "Cita no encontrada" });

    res.json({ mensaje: "Cita confirmada" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Error interno del servidor", detalle: err.message });
  }
});

app.post("/api/citas/:id_cita/cancelar", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "cliente")
    return res.status(403).json({ error: "Solo clientes" });

  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("id_cita", mssql.Int, req.params.id_cita)
      .input("id_usuario", mssql.Int, req.usuario.id)
      .query(
        `UPDATE Citas SET estado = 'cancelada' WHERE id_cita = @id_cita AND id_usuario = @id_usuario`,
      );

    if (!result.rowsAffected[0])
      return res.status(404).json({ error: "Cita no encontrada" });

    res.json({ mensaje: "Cita cancelada" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Error interno del servidor", detalle: err.message });
  }
});

app.post("/api/citas/:id_cita/reagendar", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "cliente")
    return res.status(403).json({ error: "Solo clientes" });

  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("id_cita", mssql.Int, req.params.id_cita)
      .input("id_usuario", mssql.Int, req.usuario.id)
      .query(
        `UPDATE Citas SET estado = 'cancelada' WHERE id_cita = @id_cita AND id_usuario = @id_usuario`,
      );

    if (!result.rowsAffected[0])
      return res.status(404).json({ error: "Cita no encontrada" });

    res.json({ mensaje: "Cita liberada para reagendar" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Error interno del servidor", detalle: err.message });
  }
});
const soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso denegado" });
  next();
};

app.get("/api/admin/citas", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso denegado" });

  const { busqueda, estado, rango } = req.query;

  try {
    const pool = await conectarDB();
    let query = `
      SELECT
        c.id_cita,
        c.fecha,
        c.hora,
        c.estado,
        c.precio_estimado,
        c.notas,
        c.creado_en,
        CASE WHEN c.evidencia_foto IS NOT NULL THEN 1 ELSE 0 END AS tiene_evidencia,
        CASE WHEN c.referencia_foto IS NOT NULL THEN 1 ELSE 0 END AS tiene_referencia,
        s.nombre AS servicio_nombre,
        u.nombre AS cliente_nombre,
        u.email  AS cliente_email,
        u.telefono AS cliente_telefono,
        u.id_usuario,
        b.nombre AS barbero_nombre
      FROM Citas c
      LEFT JOIN Usuarios u ON c.id_usuario   = u.id_usuario
      LEFT JOIN Servicios s ON c.servicio    = s.id_servicio
      LEFT JOIN Usuarios b ON c.id_barbero   = b.id_usuario
      WHERE 1=1
    `;

    const request = pool.request();

    if (busqueda) {
      query += ` AND (
        CAST(c.id_cita AS NVARCHAR)    LIKE @busqueda OR
        u.nombre                        LIKE @busqueda OR
        CAST(u.id_usuario AS NVARCHAR) LIKE @busqueda
      )`;
      request.input("busqueda", mssql.NVarChar, `%${busqueda}%`);
    }

    if (estado && estado !== "todos") {
      query += ` AND c.estado = @estado`;
      request.input("estado", mssql.NVarChar, estado);
    }

    if (rango === "hoy") {
      query += ` AND CAST(c.fecha AS DATE) = CAST(GETDATE() AS DATE)`;
    } else if (rango === "semana") {
      query += ` AND c.fecha >= DATEADD(DAY, -7, GETDATE())`;
    } else if (rango === "mes") {
      query += ` AND c.fecha >= DATEADD(MONTH, -1, GETDATE())`;
    }

    query += ` ORDER BY c.fecha DESC, c.hora DESC`;

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error al obtener citas admin:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

app.patch("/api/admin/citas/:id_cita", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso denegado" });

  const { estado, precio_estimado, servicio, fecha, hora, notas } = req.body;

  try {
    const pool = await conectarDB();
    await pool
      .request()
      .input("id_cita", mssql.Int, parseInt(req.params.id_cita))
      .input("estado", mssql.NVarChar, estado)
      .input("precio_estimado", mssql.Decimal, precio_estimado ?? null)
      .input("servicio", mssql.Int, servicio ?? null)
      .input("fecha", mssql.Date, fecha ?? null)
      .input("hora", mssql.NVarChar, hora ?? null)
      .input("notas", mssql.NVarChar, notas ?? null).query(`
        UPDATE Citas SET
          estado          = @estado,
          precio_estimado = COALESCE(@precio_estimado, precio_estimado),
          servicio        = COALESCE(@servicio,        servicio),
          fecha           = COALESCE(@fecha,           fecha),
          hora            = COALESCE(@hora,            hora),
          notas           = COALESCE(@notas,           notas)
        WHERE id_cita = @id_cita
      `);

    res.json({ ok: true, mensaje: "Cita actualizada" });
  } catch (err) {
    console.error("Error al editar cita:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

app.post(
  "/api/citas/:id_cita/evidencia-foto",
  verificarToken,
  upload.single("foto"),
  async (req, res) => {
    if (req.usuario.rol !== "admin" && req.usuario.rol !== "barbero")
      return res.status(403).json({ error: "Acceso denegado" });

    if (!req.file)
      return res.status(400).json({ error: "No se recibió ninguna foto" });

    try {
      const pool = await conectarDB();
      await pool
        .request()
        .input("id_cita", mssql.Int, parseInt(req.params.id_cita))
        .input("foto", mssql.VarBinary, req.file.buffer)
        .input("mime", mssql.NVarChar, req.file.mimetype).query(`
        UPDATE Citas
        SET evidencia_foto      = @foto,
            evidencia_foto_mime = @mime
        WHERE id_cita = @id_cita
      `);

      res.json({ ok: true, mensaje: "Foto de evidencia guardada" });
    } catch (err) {
      console.error("Error al guardar evidencia:", err);
      res.status(500).json({ error: "Error del servidor" });
    }
  },
);

app.get(
  "/api/citas/:id_cita/evidencia-foto",
  verificarToken,
  async (req, res) => {
    if (req.usuario.rol !== "admin" && req.usuario.rol !== "barbero")
      return res.status(403).json({ error: "Acceso denegado" });

    try {
      const pool = await conectarDB();
      const result = await pool
        .request()
        .input("id_cita", mssql.Int, parseInt(req.params.id_cita)).query(`
        SELECT evidencia_foto, evidencia_foto_mime
        FROM Citas
        WHERE id_cita = @id_cita
      `);

      const row = result.recordset[0];
      if (!row || !row.evidencia_foto)
        return res.status(404).json({ error: "Sin foto de evidencia" });

      res.setHeader("Content-Type", row.evidencia_foto_mime || "image/jpeg");
      res.send(row.evidencia_foto);
    } catch (err) {
      console.error("Error al obtener evidencia:", err);
      res.status(500).json({ error: "Error del servidor" });
    }
  },
);

app.get("/api/admin/clientes/:id", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso denegado" });
  try {
    const pool = await conectarDB();
    const id = parseInt(req.params.id);

    const clienteResult = await pool.request().input("id", mssql.Int, id)
      .query(`
        SELECT id_usuario, nombre, apellidoP, apellidoM, email, telefono, edad, rol, fecha_registro,
               CASE WHEN foto_perfil IS NOT NULL THEN 1 ELSE 0 END AS foto_perfil
        FROM Usuarios WHERE id_usuario = @id
      `);

    if (!clienteResult.recordset.length)
      return res.status(404).json({ error: "Cliente no encontrado" });

    const citasResult = await pool.request().input("id", mssql.Int, id).query(`
        SELECT c.id_cita, c.fecha, c.hora, c.estado, c.precio_estimado,
               CASE WHEN c.evidencia_foto IS NOT NULL THEN 1 ELSE 0 END AS tiene_evidencia,
               s.nombre AS servicio_nombre,
               b.nombre AS barbero_nombre
        FROM Citas c
        LEFT JOIN Servicios s ON c.servicio   = s.id_servicio
        LEFT JOIN Usuarios  b ON c.id_barbero = b.id_usuario
        WHERE c.id_usuario = @id
        ORDER BY c.fecha DESC, c.hora DESC
      `);

    res.json({
      cliente: clienteResult.recordset[0],
      citas: citasResult.recordset,
    });
  } catch (err) {
    console.error("Error perfil cliente:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

app.put("/api/admin/clientes/:id/editar", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso denegado" });
  const { nombre, apellidoP, apellidoM, email, telefono, edad, rol } = req.body;
  try {
    const pool = await conectarDB();
    await pool
      .request()
      .input("id", mssql.Int, parseInt(req.params.id))
      .input("n", mssql.NVarChar, nombre)
      .input("ap", mssql.NVarChar, apellidoP)
      .input("am", mssql.NVarChar, apellidoM)
      .input("e", mssql.NVarChar, email)
      .input("t", mssql.NVarChar, telefono)
      .input("ed", mssql.Int, edad ? parseInt(edad) : null)
      .input("r", mssql.NVarChar, rol).query(`
        UPDATE Usuarios
        SET nombre=@n, apellidoP=@ap, apellidoM=@am,
            email=@e, telefono=@t, edad=@ed, rol=@r
        WHERE id_usuario=@id
      `);
    res.json({ message: "Actualizado correctamente" });
  } catch (err) {
    console.error("Error al editar cliente:", err);
    res.status(500).json({ error: "Error al actualizar" });
  }
});

app.get(
  "/api/admin/clientes/:id/password",
  verificarToken,
  async (req, res) => {
    if (req.usuario.rol !== "admin")
      return res.status(403).json({ error: "No autorizado" });

    try {
      const pool = await conectarDB();
      const result = await pool
        .request()
        .input("id", mssql.Int, req.params.id)
        .query("SELECT contrasena FROM Usuarios WHERE id_usuario = @id");

      res.json({ password: result.recordset[0].contrasena });
    } catch (err) {
      res.status(500).json({ error: "Error al obtener contraseña" });
    }
  },
);

app.put(
  "/api/admin/clientes/:id/password",
  verificarToken,
  async (req, res) => {
    if (req.usuario.rol !== "admin")
      return res.status(403).json({ error: "No autorizado" });

    const { nuevaPassword } = req.body;
    try {
      const pool = await conectarDB();
      await pool
        .request()
        .input("id", mssql.Int, req.params.id)
        .input("p", mssql.NVarChar, nuevaPassword)
        .query("UPDATE Usuarios SET contrasena = @p WHERE id_usuario = @id");

      res.json({ message: "Contraseña actualizada" });
    } catch (err) {
      res.status(500).json({ error: "Error al cambiar contraseña" });
    }
  },
);
app.get("/api/usuarios/:id/foto-perfil", async (req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("id", mssql.Int, req.params.id)
      .query("SELECT foto_perfil FROM Usuarios WHERE id_usuario = @id");

    if (result.recordset.length > 0 && result.recordset[0].foto_perfil) {
      res.set("Content-Type", "image/jpeg");
      res.send(result.recordset[0].foto_perfil);
    } else {
      res.status(404).send("No hay foto");
    }
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.get("/api/servicios", verificarToken, async (req, res) => {
  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .query(
        `SELECT id_servicio, nombre, precio FROM Servicios ORDER BY nombre`,
      );
    res.json(result.recordset);
  } catch (err) {
    console.error("Error al obtener servicios:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});
app.get("/api/admin/horarios/:id", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso denegado" });
  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .input("id", mssql.Int, parseInt(req.params.id)).query(`
        SELECT dia_semana, hora_inicio, hora_fin, duracion_minutos, activo
        FROM HorarioSemanalBarbero
        WHERE id_barbero = @id
        ORDER BY dia_semana
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error horario:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

app.put("/api/admin/horarios/:id", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso denegado" });
  const { horario } = req.body;
  const id_barbero = parseInt(req.params.id);

  try {
    const pool = await conectarDB();

    for (const dia of horario) {
      const existe = await pool
        .request()
        .input("id", mssql.Int, id_barbero)
        .input("dia", mssql.Int, dia.dia_semana)
        .query(
          "SELECT 1 FROM HorarioSemanalBarbero WHERE id_barbero=@id AND dia_semana=@dia",
        );

      if (existe.recordset.length) {
        await pool
          .request()
          .input("id", mssql.Int, id_barbero)
          .input("dia", mssql.Int, dia.dia_semana)
          .input("hi", mssql.VarChar, dia.hora_inicio)
          .input("hf", mssql.VarChar, dia.hora_fin)
          .input("dur", mssql.Int, dia.duracion_minutos)
          .input("act", mssql.Bit, dia.activo).query(`
            UPDATE HorarioSemanalBarbero
            SET hora_inicio=@hi, hora_fin=@hf, duracion_minutos=@dur, activo=@act
            WHERE id_barbero=@id AND dia_semana=@dia
          `);
      } else {
        await pool
          .request()
          .input("id", mssql.Int, id_barbero)
          .input("dia", mssql.Int, dia.dia_semana)
          .input("hi", mssql.VarChar, dia.hora_inicio)
          .input("hf", mssql.VarChar, dia.hora_fin)
          .input("dur", mssql.Int, dia.duracion_minutos)
          .input("act", mssql.Bit, dia.activo).query(`
            INSERT INTO HorarioSemanalBarbero (id_barbero,dia_semana,hora_inicio,hora_fin,duracion_minutos,activo)
            VALUES (@id,@dia,@hi,@hf,@dur,@act)
          `);
      }
    }

    res.json({ message: "Horario actualizado" });
  } catch (err) {
    console.error("Error guardando horario:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

app.get("/api/admin/servicios", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso denegado" });
  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .query(
        "SELECT id_servicio, nombre, precio FROM Servicios ORDER BY id_servicio",
      );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

app.post("/api/admin/servicios", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso denegado" });
  const { nombre, precio } = req.body;
  if (!nombre || precio === undefined)
    return res.status(400).json({ error: "Datos incompletos" });
  try {
    const pool = await conectarDB();
    await pool
      .request()
      .input("nombre", mssql.VarChar, nombre)
      .input("precio", mssql.Decimal(10, 2), precio)
      .query(
        "INSERT INTO Servicios (nombre, precio) VALUES (@nombre, @precio)",
      );
    res.json({ message: "Servicio creado" });
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

app.put("/api/admin/servicios/:id", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso denegado" });
  const { nombre, precio } = req.body;
  try {
    const pool = await conectarDB();
    await pool
      .request()
      .input("id", mssql.Int, parseInt(req.params.id))
      .input("nombre", mssql.VarChar, nombre)
      .input("precio", mssql.Decimal(10, 2), precio)
      .query(
        "UPDATE Servicios SET nombre=@nombre, precio=@precio WHERE id_servicio=@id",
      );
    res.json({ message: "Servicio actualizado" });
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

app.delete("/api/admin/servicios/:id", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso denegado" });
  try {
    const pool = await conectarDB();
    await pool
      .request()
      .input("id", mssql.Int, parseInt(req.params.id))
      .query("DELETE FROM Servicios WHERE id_servicio=@id");
    res.json({ message: "Servicio eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
});
app.get("/api/admin/barberos", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso denegado" });
  try {
    const pool = await conectarDB();
    const result = await pool
      .request()
      .query(
        "SELECT id_usuario, nombre, apellidoP FROM Usuarios WHERE rol in ('barbero','admin')",
      );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

app.get("/api/admin/clientes", verificarToken, async (req, res) => {
  if (req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso denegado" });
  try {
    const pool = await conectarDB();
    const result = await pool.request().query(`
      SELECT
        u.id_usuario, u.nombre, u.apellidoP, u.telefono, u.email, u.rol,
        COUNT(CASE WHEN c.estado = 'completada' THEN 1 END) AS citas_completadas
      FROM Usuarios u
      LEFT JOIN Citas c ON c.id_usuario = u.id_usuario
      GROUP BY u.id_usuario, u.nombre, u.apellidoP, u.telefono, u.email, u.rol
      ORDER BY u.nombre
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error clientes:", err.message);
    res.status(500).json({ error: err.message });
  }
});
conectarDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor en el puerto ${PORT}`));
  })
  .catch((err) => {
    console.error("No se pudo iniciar el servidor por error en la BD");
  });
