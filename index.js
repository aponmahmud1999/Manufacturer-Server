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
        const userCollection = client.db("electronics-lab").collection("users")



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