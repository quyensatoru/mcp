import 'dotenv/config';
import jwt from 'jsonwebtoken';

const [, , sub = 'dev', expiresIn = '30d'] = process.argv;
const secret = process.env.JWT_SECRET;

if (!secret) {
    console.error('JWT_SECRET chưa set trong .env');
    process.exit(1);
}

console.log(jwt.sign({ sub }, secret, { expiresIn }));
