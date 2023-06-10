const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
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
        const paymentCollection = client.db('ArtOfDefense').collection('payment')


        // jwt token handle
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send(token)
        })


        // ----------- all classes api   ---------

        app.get('/popularClasses', async (req, res) => {
            const result = await allClassCollection.find().sort({ student_admit_number: -1 }).toArray();
            res.send(result)
        })

        app.get('/allClasses', async (req, res) => {
            const result = await allClassCollection.find().toArray();
            res.send(result)
        })


        app.post('/newClass', async (req, res) => {
            const newClass = req.body;
            const result = await allClassCollection.insertOne(newClass)
            res.send(result)
        })

        app.patch('/updateSeatNumbers', async (req, res) => {
            const data = req.body;
            const id = data.id
            const seatNum = req.body.seatNum;
            const student_admit_number = req.body.student_admit_number
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    available_seats: seatNum,
                    student_admit_number: student_admit_number
                }
            }
            const result = await allClassCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })
        app.patch('/updateClassStatus', async (req, res) => {
            const data = req.body;
            const id = data.id
            const status = req.body.status;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: status,
                }
            }
            const result = await allClassCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })
        app.patch('/updateFeedback', async (req, res) => {
            const data = req.body;
            const id = data.id;
            const Feedback = data.Feedback;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    Feedback: Feedback,
                }
            }
            const options = { upsert: true };
            const result = await allClassCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        })

        //users api

        app.get('/instructors', async (req, res) => {
            const query = { role: 'instructor' }
            const result = await usersCollection.find(query).toArray();
            res.send(result)
        })
        app.get('/userEmail', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })

        app.get('/checkUser/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ user: false })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { user: user?.role }
            res.send(result);
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


        app.patch('/updateUser', async (req, res) => {
            const data = req.body;
            const id = data.id;
            const role = data.role;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: role,
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })


        // students api
        app.post('/studentSelectClasses', async (req, res) => {
            const user = req.body;
            const id = user._id;
            const existingUser = await studentsCollection.findOne({ _id: id })
            if (existingUser) {
                return res.status(200).json({ message: 'User already select this class' });
            }
            const result = await studentsCollection.insertOne(user)
            res.send(result)
        })

        // select classes api
        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([])
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbidden access' })
            }

            const query = { email: email }
            const result = await studentsCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/cart/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: id };
            const result = await studentsCollection.find(query).toArray();
            res.send(result);
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: id };
            const result = await studentsCollection.deleteOne(query);
            res.send(result)
        })



        // create payment intent 

        app.get('/enrolledClasses', async (req, res) => {
            const result = await paymentCollection.find().toArray();
            res.send(result)
        })
        app.get('/paymentHistory', async (req, res) => {
            const result = await paymentCollection.find().sort({ date: -1 }).toArray();
            res.send(result)
        })

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        // payment related api
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const result = await paymentCollection.insertOne(payment)
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
    res.send('art of defense running')
})
app.listen(port, () => {
    console.log(`art of defense is running on port ${port}`)
})