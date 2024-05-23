require("dotenv").config();
const express = require("express");
const multerconfig = require("./config/multerconfig");
const upload = multerconfig;
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require("cookie-parser");
const user = require("./models/user");
const port = 3000;
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(cookieParser());

app.get("/", (req, res) => {
  res.render("index");
});

app.post("/register", async (req, res) => {
  let { email, password, name, age, username } = req.body;
  let user = await userModel.findOne({ email });
  if (user) {
    return res.status(500).send("User already exists");
  }
  bcrypt.genSalt(10, function (err, salt) {
    bcrypt.hash(password, salt, async function (err, hash) {
      let user = await userModel.create({
        email,
        password: hash,
        name,
        age,
        username,
      });
      let token = jwt.sign(
        { email: email, userid: user._id, name: user.name },
        process.env.JWT_SECRET
      );
      res.cookie("token", token);
      res.send("User registered successfully");
    });
  });
});

app.get("/login", (req, res) => {
  res.render("login");
});
app.get("/profile/upload", (req, res) => {
  res.render("profileupload");
});

app.post("/upload", isLoggedIn, upload.single("image"), async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  user.profilepic = req.file.filename;
  await user.save();
  res.redirect("/profile");
});
app.post("/login", async (req, res) => {
  let { email, password } = req.body;
  let user = await userModel.findOne({ email });
  if (!user) {
    return res.status(500).send("Something went wrong");
  }
  bcrypt.compare(password, user.password, function (err, result) {
    if (result) {
      let token = jwt.sign(
        { email: email, userid: user._id, name: user.name },
        process.env.JWT_SECRET
      );
      res.cookie("token", token);
      res.status(200).redirect("/profile");
    } else {
      res.redirect("/login");
    }
  });
});

app.get("/logout", (req, res) => {
  res.cookie("token", "");
  res.redirect("login");
});

app.get("/profile", isLoggedIn, async (req, res) => {
  let user = await userModel
    .findOne({ email: req.user.email })
    .populate("posts");
  res.render("profile", { user });
});

app.post("/post", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  let { content } = req.body;

  let existingPost = await postModel.findOne({
    user: user._id,
    content: content,
  });
  if (existingPost) {
    return res.redirect("/profile");
  }

  let post = await postModel.create({
    user: user._id,
    content: content,
  });
  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});

app.get("/like/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  if (post.likes.indexOf(req.user.userid) === -1) {
    post.likes.push(req.user.userid);
  } else {
    post.likes.splice(post.likes.indexOf(req.user.userid), 1);
  }

  await post.save();
  res.redirect("/profile");
});
app.get("/edit/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  res.render("edit", { post });
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOneAndUpdate(
    { _id: req.params.id },
    { content: req.body.content }
  );
  res.redirect("/profile");
});

function isLoggedIn(req, res, next) {
  if (!req.cookies.token) {
    return res.redirect("login");
  }
  let data = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
  req.user = data;
  next();
}

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
