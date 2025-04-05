const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }).then(() => console.log("MongoDB connected"))
.catch(err => console.error("MongoDB connection error:", err));

const visitSchema = new mongoose.Schema({
    userId: String,
    locationName: String,
    timestamp: { type: Date, default: Date.now },
  });

const Visit = mongoose.model('Visit', visitSchema);

app.post('/api/checkin', async(req,res) =>{
    const { userId, locationName } = req.body;
    if (!userId || !locationName){
        return res.status(400).json({ error: 'Missing userId or locationName' });
    }
    console.log('post checkin')
    const visit = new Visit({ userId, locationName });
    await visit.save();
    
    res.json({ success: true, visit });
})

app.get('/api/visits/:userId', async (req, res) => {
    const visits = await Visit.find({ userId: req.params.userId });
    res.json(visits);
  });


app.listen(3000, () => console.log('Server running on port 3000'));