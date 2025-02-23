const { Pool } = require('pg');
require('dotenv').config(); // Загружаем переменные из .env

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432, // По умолчанию PostgreSQL работает на 5432 порту
});

module.exports = pool;