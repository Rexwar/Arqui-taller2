const { PrismaClient } = require('@prisma/client');

// Instantiate a single Prisma Client for the application
const prisma = new PrismaClient();

module.exports = prisma;

