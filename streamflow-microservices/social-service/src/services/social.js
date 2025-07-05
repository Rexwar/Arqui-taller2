const grpc = require('@grpc/grpc-js');
const Like = require('../models/Like');
const Comment = require('../models/Comment');

// Helper to get user info from gRPC metadata
const getRequesterInfo = (call) => {
  const metadata = call.metadata.getMap();
  const userId = metadata['user-id'];

  if (!userId) {
    return { error: { code: grpc.status.UNAUTHENTICATED, details: 'El usuario debe haber iniciado sesión.' } };
  }
  return { userId };
};

const socialService = {
  async likeVideo(call, callback) {
    const { error, userId } = getRequesterInfo(call);
    if (error) return callback(error);

    const { video_id } = call.request;
    if (!video_id) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'El ID del video es requerido.' });
    }

    try {
      const like = new Like({ userId, videoId: video_id });
      await like.save();
      callback(null, { message: 'Like añadido correctamente.' });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: 'Error al dar like al video.' });
    }
  },

  async commentOnVideo(call, callback) {
    const { error, userId } = getRequesterInfo(call);
    if (error) return callback(error);

    const { video_id, comment } = call.request;
    if (!video_id || !comment) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'El ID del video y el comentario son requeridos.' });
    }

    try {
      const newComment = new Comment({ userId, videoId: video_id, comment });
      await newComment.save();
      callback(null, {
        id: newComment._id.toString(),
        user_id: newComment.userId,
        video_id: newComment.videoId,
        comment: newComment.comment,
        timestamp: newComment.createdAt.toISOString(),
      });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: 'Error al dejar el comentario.' });
    }
  },

  async getInteractions(call, callback) {
    const { error } = getRequesterInfo(call);
    if (error) return callback(error);

    const { video_id } = call.request;
    if (!video_id) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, details: 'El ID del video es requerido.' });
    }

    try {
      const likes = await Like.find({ videoId: video_id });
      const comments = await Comment.find({ videoId: video_id });

      const response = {
        likes: likes.map(l => ({
          id: l._id.toString(),
          user_id: l.userId,
          video_id: l.videoId,
          timestamp: l.createdAt.toISOString(),
        })),
        comments: comments.map(c => ({
          id: c._id.toString(),
          user_id: c.userId,
          video_id: c.videoId,
          comment: c.comment,
          timestamp: c.createdAt.toISOString(),
        })),
      };

      callback(null, response);
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: 'Error al obtener las interacciones.' });
    }
  },
};

module.exports = socialService;
