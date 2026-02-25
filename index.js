require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;
const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173", 
      "http://localhost:5174",
      "https://job-portal-11371.web.app",
      "https://job-portal-11371.firebaseapp.com",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(cookieParser());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5jgflna.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Database Collections
    const jobCollection = client.db("job-portal").collection("jobs");
    const jobApplication = client.db("job-portal").collection("jobs_application");

    // --- Auth Related APIs (JWT) ---
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "10h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production", 
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          path: "/",
        })
        .send({ success: true });
    });

    app.post("/logout", (req, res) => { //
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          path: "/",
        })
        .send({ success: true });
    });

    // --- Middleware: Verify Token ---
    const verifyToken = (req, res, next) => {
      const token = req?.cookies?.token;
      console.log(token)
      if (!token) {
        return res.status(401).send({ message: "UnAuthorized access" });
      }

      jwt.verify(token, process.env.JWT_SECRET, (error, decode) => {
        if (error) {
          return res.status(401).send({ message: "UnAuthorized access" });
        }
        req.user = decode;
        next();
      });
    };

    // --- Job Related APIs ---
    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { hr_email: email };
      }
      const cursor = jobCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.findOne(query);
      res.send(result);
    });

    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobCollection.insertOne(newJob);
      res.send(result);
    });

    // --- Job Application APIs ---
    app.post("/job-application", async (req, res) => {
      const application = req.body;
      const result = await jobApplication.insertOne(application);
      res.send(result);
    });

    app.get("/job-application", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { applicant_email: email };

      // Token email vs query email verification
      if (req.user.email !== req.query.email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const result = await jobApplication.find(query).toArray();
      
      // Fetching job details for each application
      for (const application of result) {
        const query1 = { _id: new ObjectId(application.job_id) };
        const job = await jobCollection.findOne(query1);
        if (job) {
          application.title = job.title;
          application.company = job.company;
          application.company_logo = job.company_logo;
          application.location = job.location;
          application.category = job.category;
        }
      }
      res.send(result);
    });

    app.get("/job-application/jobs/:id", async (req, res) => {
      const jobId = req.params.id;
      const query = { job_id: jobId };
      const result = await jobApplication.find(query).toArray();
      res.send(result);
    });

    app.patch("/job-application/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: data.status,
        },
      };
      const result = await jobApplication.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.delete("/job-application/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobApplication.deleteOne(query);
      res.send(result);
    });

  } finally {
    // client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Job Portal Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});