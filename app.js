const express = require("express");
const cors = require("cors");
require("dotenv").config();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const imageToBase64 = require("image-to-base64");

const morganBody = require("morgan-body");

const bodyParser = require("body-parser");
const multer = require("multer");
const moment = require("moment");

const User = require("./models/User");
const Debts = require("./models/Debts");
const Revenues = require("./models/Revenues");


var app = express();
app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).send(err);
});


const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Servidor na porta ${port}`);
});

const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASS;

app.use(express.json());

const connect = () => {
  mongoose.connect(
    `mongodb+srv://${dbUser}:${dbPassword}@cluster0.0pjrpho.mongodb.net/MO`,
  );
  const connection = mongoose.connection;

  connection.on("error", () => {
    console.error("Erro ao se conectar ao mongo");
  });
  connection.on("open", () => {
    console.error("Conectamos ao mongo");
  });
};

connect();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(png|jpg|JPEG|PNG)$/)) {
      return cb(new Error("É permitido somente o envio de jpg ou png!"));
    }
    cb(undefined, true);
  },
});

var fs = require("fs");
const path = require("path");

const log = fs.createWriteStream(
  path.join(__dirname, "./logs", `express${moment().format("YYYY-MM-DD")}.log`),
  { flags: "a" }
);

morganBody(app, {
  noColors: true,
  stream: log,
});

app.get("/", function (req, res) {
  res.send({ message: "Bem vindo a nossa API!" });
});

app.get("/download/image", (req, res) => {
  const nameImage = req.headers["imgname"];
  imageToBase64(`./uploads/${nameImage}`)
    .then((response) => {
      res.send({ image: response });
    })
    .catch((error) => {
      console.log(error);
    });
});

function checkToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .json({ message: "Acesso negado! Verifique se o token foi passado!" });
  }

  try {
    const secret = process.env.SECRET;
    jwt.verify(token, secret);
    next();
  } catch (err) {
    res.status(400).json({ message: "Token inválido!" });
  }
}

app.get("/user/:id", checkToken, async (req, res) => {
  const id = req.params.id;

  const user = await User.findById(id, "-password");

  if (!user) {
    return res.status(404).json({ message: "Usuario nao encontado!" });
  }

  res.status(200).json({ user });
});

app.post("/auth/register/user", upload.single("image"), async (req, res) => {
  const { name, email, age, password, confirmPassword } = req.body;

  let image = "";

  if (req.file) {
    image = req.file.filename;
  }

  if (!name) {
    return res.status(422).json({ message: "O nome é obrigatório!" });
  }

  if (!email) {
    return res.status(422).json({ message: "O email é obrigatório!" });
  }

  if (!age) {
    return res.status(422).json({ message: "A Idade é obrigatório!" });
  }

  if (!image) {
    return res.status(422).json({ message: "A imagem é obrigatório!" });
  }

  if (!password) {
    return res.status(422).json({ message: "A senha é obrigatório!" });
  }

  if (password !== confirmPassword) {
    return res.status(422).json({ message: "As senhas não são iguais!" });
  }

  const userExist = await User.findOne({ email: email });

  if (userExist) {
    return res
      .status(422)
      .json({ message: "Já existe uma conta com esse e-mail!" });
  }

  //cria senha
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = new User({
    name,
    email,
    age,
    image,
    password: passwordHash,
  });

  try {
    await user.save();
    res.status(201).json({ message: "Usuario criado com sucesso!", user });
  } catch (error) {
    res.status(500).json({ message: "Erro no servidor.. tente mais tarde!" });
  }
});

app.post("/auth/debts", async (req, res) => {
  const title = req.body.user.month.title;
  const user = req.body.user.title;
  const date = req.body.user.date;

  const { debt, category, value, expirationDate } =
    req.body.user.month.listMonth;

  if (!debt) {
    return res.status(422).json({ message: "A dívida é obrigatório!" });
  }

  if (!category) {
    return res.status(422).json({ message: "A categoria é obrigatório!" });
  }

  if (!value) {
    return res.status(422).json({ message: "O valor é obrigatório!" });
  }

  if (!expirationDate) {
    return res.status(422).json({ message: "A data de entrada é obrigatório!" });
  }

  const debts = new Debts({
    user: {
      title: user,
      date,
      month: {
        title,
        listMonth: {
          debt,
          category,
          value,
          expirationDate,
        },
      },
    },
  });

  try {
    await debts.save();
    res.status(201).json({ message: "cadastro realizado com sucesso!" });
  } catch (error) {
    res.status(500).json({ message: "Erro no servidor.. tente mais tarde!" });
  }
});

app.get("/list/debts", async (req, res) => {
  Debts.find({}).then((list) => {
    const { month } = req.headers;
    const { user } = req.headers;

    const novoArr = list.map((el) => {
      return {
        user: {
          title: el.user.title,
          month: {
            title: el.user.month.title,
            listMonth: {
              _id: el._id.toString(),
              debt: el.user.month.listMonth.debt,
              value: el.user.month.listMonth.value,
              category: el.user.month.listMonth.category,
              expirationDate: el.user.month.listMonth.expirationDate,
              actions: [
                "https://raw.githubusercontent.com/daniloagostinho/curso-angular15-na-pratica/main/src/assets/images/edit.png",
                "https://raw.githubusercontent.com/daniloagostinho/curso-angular15-na-pratica/main/src/assets/images/delete.png",
              ],
            },
          },
        },
      };
    });

    const result = month
      ? novoArr.filter(
          (item) =>
            user.includes(item.user.title) &&
            item.user.month.title.includes(month)
        )
      : list;

    res.status(200).json({ result });
  });
});

app.put("/update/debts/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const user = await Debts.findByIdAndUpdate(id, req.body, { new: true });

    res.status(200).json(user);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.put("/update/revenues/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const user = await Revenues.findByIdAndUpdate(id, req.body, { new: true });

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/delete/debt/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const deleteDebt = await Debts.findByIdAndRemove(id);

    if (deleteDebt) {
      res.status(200).json({ message: "Dívida excluída com sucesso!" });
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/delete/revenue/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const deleteRevenue = await Revenues.findByIdAndRemove(id);

    if (deleteRevenue) {
      res.status(200).json({ message: "Receita excluída com sucesso!" });
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(422).json({ message: "O email é obrigatório!" });
  }
  if (!password) {
    return res.status(422).json({ message: "A senha é obrigatório!" });
  }

  let user = null;

  try {
    user = await User.findOne({ email: email });
  } catch (err) {
    console.log(err);
    res.send("err --> ", err);
  }

  if (!user) {
    return res.status(404).json({ message: "Usuario não encontrado!" });
  }

  const checkpassword = await bcrypt.compare(password, user.password);

  if (!checkpassword) {
    return res.status(422).json({ message: "Senha inválida!" });
  }

  try {
    const secret = process.env.SECRET;
    const token = jwt.sign(
      {
        id: user._id,
      },
      secret
    );

    res.status(200).json({
      message: "Autenticação realizada com sucesso!",
      token,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Aconteceu um erro no servidor, tente mais tarde!",
    });
  }
});

app.post("/auth/revenues", async (req, res) => {
  const { typeRevenue, value, dateEntry } = req.body.user.month.listMonth;
  const title = req.body.user.month.title;
  const user = req.body.user.title;

  if (!typeRevenue) {
    return res.status(422).json({ message: "O tipoReceita é obrigatório!" });
  }
  if (!value) {
    return res.status(422).json({ message: "O valor é obrigatório!" });
  }
  if (!dateEntry) {
    return res.status(422).json({ message: "A dataEntrada é obrigatório!" });
  }

  const revenues = new Revenues({
    user: {
      title: user,
      month: {
        title,
        listMonth: {
          typeRevenue,
          value,
          dateEntry,
        },
      },
    },
  });

  try {
    await revenues.save();
    res.status(201).json({ message: "cadastro realizado com sucesso!" });
  } catch (error) {
    res.status(500).json({ message: "Erro no servidor.. tente mais tarde!" });
  }
});

app.get("/list/revenues", async (req, res) => {
  Revenues.find({}).then((list) => {
    const { month } = req.headers;
    const showMonth = month ? month : "";
    const { user } = req.headers;

    const novoArr = list.map((el) => {
      return {
        user: {
          title: el.user.title,
          month: {
            title: el.user.month.title,
            listMonth: {
              _id: el._id.toString(),
              typeRevenue: el.user.month.listMonth.typeRevenue,
              value: el.user.month.listMonth.value,
              dateEntry: el.user.month.listMonth.dateEntry,
              actions: [
                "https://raw.githubusercontent.com/daniloagostinho/curso-angular15-na-pratica/main/src/assets/images/edit.png",
                "https://raw.githubusercontent.com/daniloagostinho/curso-angular15-na-pratica/main/src/assets/images/delete.png",
              ],
            },
          },
        },
      };
    });
    const result = showMonth
      ? novoArr.filter(
          (item) =>
            user.includes(item.user.title) &&
            item.user.month.title.includes(month)
        )
      : list;
    res.status(200).json({ result });
  });
});

