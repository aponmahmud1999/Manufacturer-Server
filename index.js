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

async function run(){
    try{

        await client.connect();
        const productCollection = client.db("cars-parts").collection("products")

        app.get('/product', async (req, res) => {
            const products = await productCollection.find().toArray()
            res.send(products)
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