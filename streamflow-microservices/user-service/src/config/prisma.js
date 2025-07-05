const { PrismaClient } = require('@prisma/client');

// Instantiate a single Prisma Client for the application
const prisma = new PrismaClient();

// Middleware for soft delete
prisma.$use(async (params, next) => {
  // Check if the model is 'User'
  if (params.model === 'User') {
    // Intercept 'delete' action
    if (params.action === 'delete') {
      params.action = 'update';
      params.args.data = { deletedAt: new Date() };
    }
    // Intercept 'deleteMany' action
    if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      if (params.args.data !== undefined) {
        params.args.data.deletedAt = new Date();
      } else {
        params.args.data = { deletedAt: new Date() };
      }
    }

    // Add filter for non-deleted records for find and count queries
    const findActions = ['findUnique', 'findFirst', 'findMany', 'count'];
    if (findActions.includes(params.action)) {
      if (params.args.where) {
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      } else {
        params.args.where = { deletedAt: null };
      }
    }
    
    // Add filter for non-deleted records for update queries
    const updateActions = ['update', 'updateMany'];
     if (updateActions.includes(params.action)) {
      if (params.args.where) {
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      } else {
        params.args.where = { deletedAt: null };
      }
    }
  }
  return next(params);
});

module.exports = prisma;

