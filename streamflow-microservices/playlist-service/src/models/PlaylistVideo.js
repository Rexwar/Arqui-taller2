const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlaylistVideo = sequelize.define('PlaylistVideo', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    playlistId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'playlists',
        key: 'id',
      },
      field: 'playlist_id',
    },
    videoId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'video_id',
    },
  }, {
    tableName: 'playlist_videos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // No 'updated_at' column in this table
  });

  return PlaylistVideo;
};
