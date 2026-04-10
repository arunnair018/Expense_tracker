const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

const app = express();

connectDB();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/months',    require('./routes/months'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/salary',    require('./routes/salary'));
app.use('/api/gpay',      require('./routes/gpay'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
