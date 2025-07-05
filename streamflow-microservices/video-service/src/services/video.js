const grpc = require('@grpc/grpc-js');
const Video = require('../models/Video');
const mongoose = require('mongoose');

// --- Helper Functions ---
const getRequesterInfo = (call) => {
  const metadata = call.metadata.getMap();
  return {
    id: metadata['x-user-id'],
    role: metadata['x-user-role']
  };
};

const formatVideoResponse = (video) => {
  const videoObject = video.toObject();
  return {
    ...videoObject,
    id: videoObject._id.toString(),
    created_at: videoObject.createdAt.toISOString(),
    updated_at: videoObject.updatedAt.toISOString(),
  };
};

// --- Service Implementation ---
const videoService = {
  createVideo: async (call, callback) => {
    try {
      const requester = getRequesterInfo(call);
      if (requester.role !== 'Administrador') {
        return callback({ code: grpc.status.PERMISSION_DENIED, details: 'No tiene permisos para subir videos.' });
      }

      const { title, description, genre } = call.request;
      if (!title || !description || !genre) {
        return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'Título, descripción y género son requeridos.' });
      }

      const newVideo = new Video({ title, description, genre });
      await newVideo.save();

      callback(null, formatVideoResponse(newVideo));
    } catch (error) {
      console.error('Error creating video:', error);
      callback({ code: grpc.status.INTERNAL, details: 'Error interno al crear el video.' });
    }
  },

  getVideoById: async (call, callback) => {
    try {

      if (!mongoose.Types.ObjectId.isValid(call.request.id)) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          details: 'El ID proporcionado no es un ObjectId válido.',
        });
      }

      const video = await Video.findOne({ _id: call.request.id, deletedAt: null });

      if (!video) {
        return callback({ code: grpc.status.NOT_FOUND, details: 'Video no encontrado.' });
      }

      callback(null, formatVideoResponse(video));
    } catch (error) {
      console.error('Error getting video by ID:', error);
      callback({ code: grpc.status.INTERNAL, details: 'Error interno al obtener el video.' });
    }
  },

  updateVideo: async (call, callback) => {
    try {
      const requester = getRequesterInfo(call);
      if (requester.role !== 'Administrador') {
        return callback({ code: grpc.status.PERMISSION_DENIED, details: 'No tiene permisos para actualizar videos.' });
      }

      if (!mongoose.Types.ObjectId.isValid(call.request.id)) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          details: 'El ID proporcionado no es un ObjectId válido.',
        });
      }

      const { id, title, description, genre } = call.request;
      const updateData = {};
      if (title) updateData.title = title;
      if (description) updateData.description = description;
      if (genre) updateData.genre = genre;

      const updatedVideo = await Video.findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: updateData },
        { new: true }
      );

      if (!updatedVideo) {
        return callback({ code: grpc.status.NOT_FOUND, details: 'Video no encontrado.' });
      }

      callback(null, formatVideoResponse(updatedVideo));
    } catch (error) {
      console.error('Error updating video:', error);
      callback({ code: grpc.status.INTERNAL, details: 'Error interno al actualizar el video.' });
    }
  },

  deleteVideo: async (call, callback) => {
    try {
      const requester = getRequesterInfo(call);
      if (requester.role !== 'Administrador') {
        return callback({ code: grpc.status.PERMISSION_DENIED, details: 'No tiene permisos para eliminar videos.' });
      }

      if (!mongoose.Types.ObjectId.isValid(call.request.id)) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          details: 'El ID proporcionado no es un ObjectId válido.',
        });
      }

      const result = await Video.findByIdAndUpdate(call.request.id, { $set: { deletedAt: new Date() } });

      if (!result) {
        return callback({ code: grpc.status.NOT_FOUND, details: 'Video no encontrado.' });
      }

      callback(null, { message: 'Video eliminado correctamente.' });
    } catch (error) {
      console.error('Error deleting video:', error);
      callback({ code: grpc.status.INTERNAL, details: 'Error interno al eliminar el video.' });
    }
  },

  listAllVideos: async (call, callback) => {
    try {
      const { page = 1, limit = 10, title, genre } = call.request;
      const skip = (page - 1) * limit;

      const query = { deletedAt: null };
      if (title) query.title = { $regex: title, $options: 'i' };
      if (genre) query.genre = { $regex: genre, $options: 'i' };

      const videos = await Video.find(query)
        .skip(skip)
        .limit(parseInt(limit, 10));

      const total = await Video.countDocuments(query);

      callback(null, {
        videos: videos.map(formatVideoResponse),
        total: total,
        page: page,
        limit: limit
      });
    } catch (error) {
      console.error('Error listing videos:', error);
      callback({ code: grpc.status.INTERNAL, details: 'Error interno al listar los videos.' });
    }
  }
};

module.exports = videoService;
