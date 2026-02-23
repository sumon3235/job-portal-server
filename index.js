require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 5000;
const app = express();

// Midleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Database Code

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5jgflna.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );

    // job related apis
    const jobCollection = client.db("job-portal").collection("jobs");
    const jobApplication = client
      .db("job-portal")
      .collection("jobs_application");

    // Json Web token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "1h" });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
          sameSite: 'lax'
        })
        .send({ success: true });
    });

    const logger = (req, res, next) => {
      console.log('logger call')
      next();
    }

    const verifyToken = (req, res, next) => {
      console.log('token calling')
      const token = req?.cookies?.token;

      if(!token) {
        return res.status(401).send({message: 'unAuthorized token'})
      }

      jwt.verify(token, process.env.JWT_SECRET, (error,decode) => {
        if (error) {
          res.status(401).send('UnAuthorized Token')
        }
      })
      next();
    }

    app.get("/jobs", logger, async (req, res) => {
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

    // job application
    app.post("/job-application", async (req, res) => {
      const application = req.body;
      const result = await jobApplication.insertOne(application);
      res.send(result);
    });

    app.get("/job-application", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { applicant_email: email };
      
      console.log(req.cookies)

      const result = await jobApplication.find(query).toArray();
      for (const application of result) {
        const query1 = { _id: new ObjectId(application.job_id) };
        const job = await jobCollection.findOne(query1);

        if (job) {
          application.title = job.title;
          ((application.company = job.company),
            (application.company_logo = job.company_logo),
            (application.location = job.location),
            (application.category = job.category));
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
      const result = await jobCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.delete("/job-application/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobApplication.deleteOne(query);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Job Server Is Running");
});

app.listen(port, () => {
  console.log(`app is runnign port: ${port}`);
});
