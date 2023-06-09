const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
// middleware
app.use(cors())
app.use(express.json())


// verify jwt
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next()
    })
}



const uri = `mongodb+srv://${process.env.DB_COLLECTION_NAME}:${process.env.DB_PASSWORD}@cluster0.ngmeevb.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const allClassCollection = client.db('ArtOfDefense').collection('allClasses')
        const usersCollection = client.db('ArtOfDefense').collection('users')
        const studentsCollection = client.db('ArtOfDefense').collection('studentsSelectClasses')


        // jwt token handle
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send(token)
        })


        // all classes api
        app.get('/popularClasses', async (req, res) => {
            const result = await allClassCollection.find().sort({ student_admit_number: -1 }).toArray();
            res.send(result)
        })

        app.get('/allClasses', async (req, res) => {
            const result = await allClassCollection.find().toArray();
            res.send(result)
        })

        //users api

        app.get('/instructors', async (req, res) => {
            const query = { role: 'instructor' }
            const result = await usersCollection.find(query).toArray();
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            // console.log(user)
            const existingUser = await usersCollection.findOne(query);
            // console.log("existing user", existingUser)
            if (existingUser) {
                return res.send({ message: 'user already' })
            }
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })


        // students api
        app.post('/studentSelectClasses', async (req, res) => {
            const user = req.body;
            const result = await studentsCollection.insertOne(user)
            res.send(result)
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Bistro Boss running')
})
app.listen(port, () => {
    console.log(`Bistro boss is running on port ${port}`)
})