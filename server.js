import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRouter from './routes/chat.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', chatRouter);

// health-check
app.get('/', (_, res) => res.send('Johnny-Chat API running ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
