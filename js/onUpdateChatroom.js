const functions = require('firebase-functions');
const admin = require('firebase-admin');
// To avoid deployment errors, do not call admin.initializeApp() in your code

exports.onUpdateChatroom = functions.firestore
    .document("chats/{chatsId}")
    .onUpdate(async (change, context) => {

      const db = admin.firestore();
      const storage = admin.storage();
      const chatsId = context.params.chatsId;
      const chatroom = change.after.data();
      const memberUserList = chatroom.users || [];
      const chatroomRef = db.collection('chats').doc(chatsId);
      const storagePaths = [];

      // 参加者不在のチャットルームを削除
      if (memberUserList.length <= 0) {
        const batch = db.batch();
        // サブコレクションを削除
        const messages = await chatroomRef.collection('chat_messages').get();
        for (const message of messages.docs) {
            batch.delete(message.ref);
            const messageData = message.data();
            for (const imageObj of messageData.images || []) {
                if (imageObj.image) {
                    storagePaths.push(imageObj.image);
                }
                if (imageObj.thumbnail) {
                    storagePaths.push(imageObj.thumbnail);
                }
            }
            for (const videoObj of messageData.videos || []) {
                if (videoObj.image) {
                    storagePaths.push(videoObj.image);
                }
                if (videoObj.thumbnail) {
                    storagePaths.push(videoObj.thumbnail);
                }
            }
            if (messageData.pdf && messageData.pdf.url) {
                storagePaths.push(messageData.pdf.url);
            }
            if (messageData.file && messageData.file.url) {
                storagePaths.push(messageData.file.url);
            }
        }
        // const chatroomsViewUsers = await chatroomRef.collection('chatrooms_view_users').get();
        // for (const doc of chatroomsViewUsers.docs) {
        //     batch.delete(doc.ref);
        // }
        // if (chatroom.image) {
        //   storagePaths.push(chatroom.image);
        // }

        // // お気に入りから削除
        // const favorites = await db.collectionGroup('favorites')
        //   .where('type', '==', 'Chatroom')
        //   .where('documentId', '==', chatsId)
        //   .get();
        // for (const favorite of favorites.docs) {
        //     batch.delete(favorite.ref);
        // }

        // Storageから画像を削除
        for (const path of storagePaths) {
            const matches = path.match(/\/b\/(.+?)\/o\/(.+?)(\?alt=media)?$/);
            if (!matches || matches.length < 3) {
              throw new Error('無効なStorage URLです');
            }
            const filePath = decodeURIComponent(matches[2]).split('?')[0];
            await storage.bucket().file(filePath).delete();
        }

        // チャットルームを削除
        batch.delete(chatroomRef);
        await batch.commit();
      }
  }
);