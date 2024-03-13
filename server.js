import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import mysql from "mysql";
import multer from "multer";
import dotenv from "dotenv";
import pkg from "nodemailer";
dotenv.config();
const app = express();
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: process.env.SQL_PASSWORD,
  database: "twitterDb",
});
var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + req.session.userid + "_" + file.originalname);
  },
});
var upload_detail = multer({ storage: storage });

const transporter = pkg.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: false,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

app.use(express.static("./public"));
app.use(session({ secret: "k6949!yel" }));
app.use(bodyParser.urlencoded());
app.set("view engine", "ejs");
app.get("/logout", (req, res) => {
  req.session.userid = "";
  res.redirect("/");
});
app.get("/", (req, res) => {
  var msg = "";
  if (req.session.msg != "") {
    msg = req.session.msg;
  }
  res.render("login", { msg: msg });
});
app.get("/home", (req, res) => {
  if (req.session.userid != "") {
    db.query(`select * from tweet where uid in (select follow_uid from user_follows where uid = ${req.session.userid})  order by datetime`,(err,result)=>{
      if(err) throw err;
      res.render("home", { data: req.session,result:result });
    })
    
  } else {
    req.session.msg = "please login to continue";
    res.redirect("/");
  }
});

app.get("/editprofile", async (req, res) => {
  if (req.session.userid) {
    db.query(
      `select fname,mname,lname,about,ppic,headerpic,status from user where uid = ${req.session.userid}`,
      (err, result, fields) => {
        if (err) throw err;
        res.render("editprofile", { result: result });
      }
    );
  } else {
    res.redirect("/");
  }
});
app.get("/verifyprofile", async (req, res) => {
  var otp = Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
  var res1 = "";
  try {
    // Wrap the db.query() call in a Promise
    const queryResult = await new Promise((resolve, reject) => {
      db.query(
        `SELECT email FROM user WHERE uid = ${req.session.userid}`,
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        }
      );
    });
    if (queryResult && queryResult.length > 0) {
      res1 = queryResult[0].email;
    } else {
      console.log("No email found for the user ID");
    }
  } catch (err) {
    console.error(err);
  }
  try {
    await transporter.sendMail(
      {
        from: "fakesteam26@gmail.com",
        to: res1,
        subject: "Test Email",
        text: `your verification otp is ${otp}`,
      },
      (error, info) => {
        if (error) {
          console.log(error);
          res.redirect("/");
        }
      }
    );
    await db.query(
      `update user set otp=${otp} where uid = ${req.session.userid}`,
      (err, result) => {
        if (err) throw err;
        res.render("insertotp");
      }
    );
  } catch (err) {
    res.render("/");
  }
});

app.post("/search", (req, res) => {
  const { sQuery } = req.body;
  db.query(
    `select username,uid,ppic from user where username like '%${sQuery}%' `,
    (err, result) => {
      if (err) throw err;
      res.render("followers", { result: result });
    }
  );
});
app.get("/follow/:id", (req, res) => {
  var uid = req.params.id;
  db.query(
    `insert into user_follows(follow_uid,uid) values (${uid},${req.session.userid})`,
    (err, result) => {
      if (err) throw err;
      res.redirect(`/profile/${uid}`);
    }
  );
});

app.post("/chkstatus", (req, res) => {
  const { otp } = req.body;
  var sql_q = `update user set status=1,otp=0 where uid = ${req.session.userid} AND otp=${otp}`;

  db.query(sql_q, (err, result) => {
    console.log(result);
    res.redirect("/home");
  });
});

app.get("/unfollow/:id", (req, res) => {
  var uid = req.params.id;
  db.query(
    `delete from user_follows where follow_uid = ${uid} and uid = ${req.session.userid}`,
    (err, result) => {
      if (err) throw err;
      res.redirect(`/profile/${uid}`);
    }
  );
});
app.post("/upHeader", upload_detail.single("headerpic"), (req, res) => {
  if (req.file != undefined) {
    db.query(
      `update user set headerpic='${req.file.filename}' where uid=${req.session.userid}`,
      (err, result) => {
        if (err) throw err;
      }
    );
  }
  res.redirect("/editprofile");
});
app.post("/edtprfl", upload_detail.single("ppic"), (req, res) => {
  const { fname, mname, lname, about } = req.body;
  if (req.file != undefined) {
    db.query(
      `update user set fname='${fname}' ,mname='${mname}',lname='${lname}',about='${about}',ppic='${req.file.filename}' where uid = ${req.session.userid}`,
      function (err, result) {
        if (err) throw err;
        res.redirect("/editprofile");
      }
    );
  } else {
    db.query(
      `update user set fname='${fname}' ,mname='${mname}',lname='${lname}',about='${about}' where uid = ${req.session.userid}`,
      function (err, result) {
        if (err) throw err;
        res.redirect("/editprofile");
      }
    );
  }
});

app.post("/login_submit", function (req, res) {
  const { email, pass } = req.body;
  let sql = "";
  if (isNaN(email)) {
    sql =
      "select * from user where email = '" +
      email +
      "' and password = '" +
      pass +
      "' and softdelete = 0";
  } else {
    sql =
      "select * from user where mobile = '" +
      email +
      "' and password = '" +
      pass +
      "' and softdelete = 0";
  }

  db.query(sql, function (err, result, fields) {
    if (err) throw err;
    if (result.length == 0) {
      res.render("login", { msg: "Invalid Credentials" });
    } else {
      req.session.userid = result[0].uid;
      req.session.uName = result[0].username;
      res.redirect("/home");
    }
  });
});

app.get("/signup", function (req, res) {
  res.render("signup", { errmsg: "" });
});

app.post("/reg_submit", (req, res) => {
  const { fname, mname, lname, email, username, pass, cpass, dob, gender } =
    req.body;
  let sql_check = "";

  if (isNaN(email)) {
    sql_check = "select email from user where email ='" + email + "';";
  } else {
    sql_check = "select mobile from user where mobile =" + email;
  }
  db.query(sql_check, function (err, result, fields) {
    if (err) {
      throw err;
    }
    if (result.length == 1) {
      let errmsg = "";
      if (isNaN(email)) {
        errmsg = "Email already exists !";
      } else {
        errmsg = "Mobile No. already exists !";
      }

      res.render("signup", { errmsg: errmsg });
    } else {
      let sql = "";
      if (isNaN(email))
        sql =
          "insert into user(fname,mname,lname,email,username,password,gender,dor,dob) values(?,?,?,?,?,?,?,?,?)";
      else {
        sql =
          "insert into user(fname,mname,lname,mobile,username,password,gender,dor,dob) values(?,?,?,?,?,?,?,?,?)";
      }
      let t = new Date();
      let m = t.getMonth() + 1;
      let dor = t.getFullYear() + "-" + m + "-" + t.getDate();
      db.query(
        sql,
        [fname, mname, lname, email, username, pass, gender, dob, dor],
        function (err, result) {
          if (err) throw err;

          if (result.insertId > 0) {
            req.session.msg =
              "Account created, please check mail to verify email";
            res.redirect("/");
          } else {
            res.render("signup", {
              errmsg: "cannot complete signup try again",
            });
          }
        }
      );
    }
  });
});
app.post("/tweet_post", upload_detail.single("tweet_image"), (req, res) => {
  const { post } = req.body;
  const datetime = new Date().toISOString().slice(0, 19).replace("T", " ");
  console.log(req.file);
  if (req.file != undefined) {
    db.query(
      `insert into tweet(uid,post,uname,datetime,tweetimgvdeo,file_type) values ('${req.session.userid}','${post}','${req.session.uName}','${datetime}','${req.file.filename}','${req.file.mimetype}')`,
      (err, result) => {
        if (err) throw err;
        res.redirect("/mytweets");
      }
    );
  } else {
    db.query(
      `insert into tweet(uid,post,uname,datetime) values ('${req.session.userid}','${post}','${req.session.uName}','${datetime}')`,
      (err, result) => {
        if (err) throw err;
        res.redirect("/mytweets");
      }
    );
  }
});
app.get("/followers", (req, res) => {
  db.query(
    `select uid,username from user where uid in (select uid from user_follows where follow_uid = ${req.session.userid})`,
    (err, result) => {
      if (err) throw err;
      res.render("followers", { result: result });
    }
  );
});
app.get("/mytweets", (req, res) => {
  db.query(
    `select * from tweet where uid = ${req.session.userid}`,
    (err, result) => {
      if (err) throw err;

      res.render("mytweets", { result: result });
    }
  );
});
app.get("/following", (req, res) => {
  db.query(
    `select uid,username from user where uid in (select follow_uid from user_follows where uid = ${req.session.userid})`,
    (err, result) => {
      if (err) throw err;
      res.render("following", { result: result });
    }
  );
});
app.get("/profile/:id", (req, res) => {
  const uid = req.params.id;
  if (uid == req.session.userid) {
    res.redirect("/selfprofile");
  } else {
    db.query(
      `select uid,username,fname,about,ppic,headerpic from user where uid = ${uid}`,
      (err, result) => {
        if (err) throw err;
        var res1 = result;
        db.query(`select * from tweet where uid = ${uid}`, (err, result) => {
          if (err) throw err;
          var res2 = result;
          db.query(
            `select * from user_follows where follow_uid =${uid} AND uid = ${req.session.userid}`,
            (err, result) => {
              if (err) throw err;
              res.render("profile", { res1: res1, result: res2, res2: result });
            }
          );
        });
      }
    );
  }
});
app.get("/selfprofile", (req, res) => {
  db.query(
    `select uid,username,fname,about,ppic,headerpic from user where uid = ${req.session.userid}`,
    (err, result) => {
      if (err) throw err;
      var res1 = result;
      db.query(
        `select * from tweet where uid = ${req.session.userid}`,
        (err, result) => {
          if (err) throw err;
          res.render("selfprofile", { res1: res1, result: result });
        }
      );
    }
  );
});
app.get('/chngPswd',(req,res)=>{
  res.render('changepswd',{msg:""});
});
app.post('/password',async (req,res)=>{
  const{opass,npass,cpass} = req.body;
  if(cpass != npass)
  {
    res.render('changepswd',{msg:"passwords donot match"});
  }
  else
  {
    db.query(`select password from user where uid = ${req.session.userid}`,(err,result)=>{
      if(err) throw err;

      if(opass != result[0].password)
      {
        res.render('changepswd',{msg:"old password is not correct"});
      }
      else
      {
        db.query(`update user set password = '${npass}' where uid = ${req.session.userid}`,(err,result)=>{
            if(err) throw err;

            res.render('changepswd',{msg:"password changed"});
        });
      }
  });
  }
})
app.listen(2663, (err) => {
  console.log("server started");
});
