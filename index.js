const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express()
const port = process.env.PORT || 5000

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f1arj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

app.use(cors())
app.use(express.json())

function verifyJWT(req, res, next) {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: "UnAuthorized access" })
    }
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden access" })
        }
        req.decoded = decoded
        next()
    });
}

async function run(){
    try{

        await client.connect();
        const productCollection = client.db("cars-parts").collection("products")
        const userCollection = client.db("cars-parts").collection("users")
        const orderCollection = client.db("cars-parts").collection("orders")
        const paymentCollection = client.db("cars-parts").collection("payments")
        const reviewCollection = client.db("cars-parts").collection("reviews")



        const verifyAdmin = async (req, res, next) => {
            const initiator = req.decoded.email
            const initiatorAcc = await userCollection.findOne({ email: initiator })
            if (initiatorAcc.role === 'admin') {
                next()
            }
            else {
                return res.status(403).send({ message: "Forbidden access" })
            }
        }

        app.get('/product', async (req, res) => {
            const products = await productCollection.find().toArray()
            res.send(products)
        })
        app.post('/product', verifyJWT, verifyAdmin, async (req, res) => {
            const product = req.body
            const products = await productCollection.insertOne(product)
            res.send(products)
        })
        app.get('/product/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const product = await productCollection.findOne(query)
            res.send(product)
        })
        app.put('/product/:id', async (req, res) => {
            const id = req.params.id
            const quantity = req.body.newQuantity
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: { quantity: quantity },
            };
            const product = await productCollection.updateOne(filter, updateDoc)
            res.send(product)
        })
        app.delete('/product/:_id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params._id
            const filter = { _id: ObjectId(id) }
            const result = await productCollection.deleteOne(filter)
            res.send(result)
        })
        app.get('/user', verifyJWT, verifyAdmin, async (req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const users = await userCollection.findOne(query)
            res.send(users)
        })
        app.delete('/user/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email
            const filter = { email: email }
            const users = await userCollection.deleteOne(filter)
            res.send(users)
        })

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email
            const filter = { email: email }
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.get('/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin'
            res.send(isAdmin)
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
            res.send({ result, token })
        })
        app.get('/order', verifyJWT, async (req, res) => {
            const user = req.query.email;
            const decodedEmail = req.decoded.email
            if (user === decodedEmail) {
                const query = { email: user }
                const orders = await orderCollection.find(query).toArray()
                res.send(orders)
            }
            else if (!user) {
                const result = await orderCollection.find().toArray();
                res.send(result)
            }
            else {
                return res.status(403).send({ message: "Forbidden access" })
            }
        })
        app.post('/order', verifyJWT, async (req, res) => {
            const booking = req.body;
            const result = await orderCollection.insertOne(booking);
            res.send(result)
        })

        app.get('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const booking = await orderCollection.findOne(query)
            res.send(booking)
        })
        app.delete('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const booking = await orderCollection.deleteOne(filter)
            res.send(booking)
        })

        app.patch('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const payment = req.body
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: 'paid',
                    transactionId: payment.transactionId
                },
            };
            const result = await paymentCollection.insertOne(payment)
            const updatedBooking = await orderCollection.updateOne(filter, updateDoc)
            res.send(updateDoc)
        })
        app.put('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: 'ship'
                },
            };
            const updatedBooking = await orderCollection.updateOne(filter, updateDoc)
            res.send(updateDoc)
        })

        //PAYMENT
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const product = req.body;
            const price = product.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        // Reviews
        app.get("/reviews", async (req, res) => {
            const user = req.query.email;
            if (user) {
                const query = { email: user }
                const result = await reviewCollection.find(query).toArray()
                res.send(result)
            }
            else {
                const result = await reviewCollection.find().toArray();
                res.send(result)
            }
        });
        app.post("/reviews", async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        });
 


    }
    finally{
       
    }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Cars is online!')
})

app.listen(port, () => {
    console.log(`Cars on ${port}`)
})