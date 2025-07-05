const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'postgres',
  logging: false,
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.Playlist = require('./Playlist')(sequelize, Sequelize);
db.PlaylistVideo = require('./PlaylistVideo')(sequelize, Sequelize);

db.Playlist.hasMany(db.PlaylistVideo, { as: 'videos', foreignKey: 'playlistId' });
db.PlaylistVideo.belongsTo(db.Playlist, { as: 'playlist', foreignKey: 'playlistId' });

module.exports = db;
