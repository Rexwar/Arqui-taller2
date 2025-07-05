const grpc = require('@grpc/grpc-js');
const { Playlist, PlaylistVideo } = require('../models');

// Helper to get user info from gRPC metadata
const getRequesterInfo = (call) => {
  const metadata = call.metadata.getMap();
  const userId = metadata['user-id'];

  if (!userId) {
    return { error: { code: grpc.status.UNAUTHENTICATED, details: 'El usuario debe haber iniciado sesión.' } };
  }
  return { userId };
};

const playlistService = {
  async createPlaylist(call, callback) {
    const { error, userId } = getRequesterInfo(call);
    if (error) return callback(error);

    const { name } = call.request;
    if (!name) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'El nombre de la lista es requerido.' });
    }

    try {
      const playlist = await Playlist.create({ userId, name });
      callback(null, { id: playlist.id.toString(), name: playlist.name });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: 'Error al crear la lista de reproducción.' });
    }
  },

  async addVideoToPlaylist(call, callback) {
    const { error, userId } = getRequesterInfo(call);
    if (error) return callback(error);

    const { playlist_id, video_id } = call.request;
    if (!playlist_id || !video_id) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'El ID de la lista y el ID del video son requeridos.' });
    }

    try {
      const playlist = await Playlist.findByPk(playlist_id);
      if (!playlist) {
        return callback({ code: grpc.status.NOT_FOUND, details: 'Lista de reproducción no encontrada.' });
      }

      if (playlist.userId !== userId) {
        return callback({ code: grpc.status.PERMISSION_DENIED, details: 'No tiene permisos para añadir videos a esta lista.' });
      }

      await PlaylistVideo.create({ playlistId: playlist_id, videoId: video_id });
      callback(null, { message: 'Video añadido correctamente.' });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return callback({ code: grpc.status.ALREADY_EXISTS, details: 'El video ya existe en la lista de reproducción.' });
      }
      callback({ code: grpc.status.INTERNAL, details: 'Error al añadir el video a la lista de reproducción.' });
    }
  },

  async removeVideoFromPlaylist(call, callback) {
    const { error, userId } = getRequesterInfo(call);
    if (error) return callback(error);

    const { playlist_id, video_id } = call.request;
    if (!playlist_id || !video_id) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'El ID de la lista y el ID del video son requeridos.' });
    }

    try {
      const playlist = await Playlist.findByPk(playlist_id);
      if (!playlist) {
        return callback({ code: grpc.status.NOT_FOUND, details: 'Lista de reproducción no encontrada.' });
      }

      if (playlist.userId !== userId) {
        return callback({ code: grpc.status.PERMISSION_DENIED, details: 'No tiene permisos para eliminar videos de esta lista.' });
      }

      const result = await PlaylistVideo.destroy({
        where: { playlistId: playlist_id, videoId: video_id },
      });

      if (result === 0) {
        return callback({ code: grpc.status.NOT_FOUND, details: 'El video no se encontró en la lista de reproducción.' });
      }

      callback(null, { message: 'Video eliminado correctamente.' });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: 'Error al eliminar el video de la lista de reproducción.' });
    }
  },

  async getPlaylists(call, callback) {
    const { error, userId } = getRequesterInfo(call);
    if (error) return callback(error);

    try {
      const playlists = await Playlist.findAll({ where: { userId } });
      const response = {
        playlists: playlists.map(p => ({ id: p.id.toString(), name: p.name, user_id: p.userId })),
      };
      callback(null, response);
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: 'Error al obtener las listas de reproducción.' });
    }
  },

  async getPlaylistVideos(call, callback) {
    const { error } = getRequesterInfo(call);
    if (error) return callback(error);

    const { playlist_id } = call.request;
    if (!playlist_id) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'El ID de la lista es requerido.' });
    }

    try {
      const playlistVideos = await PlaylistVideo.findAll({ where: { playlistId: playlist_id } });

      // NOTE: To get video names, a call to the video service is required.
      // For now, returning video IDs and a placeholder name.
      const videos = playlistVideos.map(pv => ({
        id: pv.videoId,
        name: `Video ${pv.videoId}`, // Placeholder
      }));

      callback(null, { videos });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: 'Error al obtener los videos de la lista de reproducción.' });
    }
  },

  async deletePlaylist(call, callback) {
    const { error, userId } = getRequesterInfo(call);
    if (error) return callback(error);

    const { playlist_id } = call.request;
    if (!playlist_id) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'El ID de la lista es requerido.' });
    }

    try {
      const playlist = await Playlist.findByPk(playlist_id);
      if (!playlist) {
        return callback({ code: grpc.status.NOT_FOUND, details: 'Lista de reproducción no encontrada.' });
      }

      if (playlist.userId !== userId) {
        return callback({ code: grpc.status.PERMISSION_DENIED, details: 'No tiene permisos para eliminar esta lista.' });
      }

      await playlist.destroy();
      callback(null, { message: 'Lista de reproducción eliminada correctamente.' });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: 'Error al eliminar la lista de reproducción.' });
    }
  },
};

module.exports = playlistService;
