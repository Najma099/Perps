import express from 'express';
import cors from 'cors';
import AuthRouter from './route/auth.route';

const app = express();
app.use(cors);
app.use(express.json);


app.use('/auth', AuthRouter);

app.listen(3000, () => {
    console.log('Application started in post 3000');
})