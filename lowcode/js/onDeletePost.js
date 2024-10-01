const functions = require('firebase-functions');
const admin = require('firebase-admin');
// To avoid deployment errors, do not call admin.initializeApp() in your code

exports.onDeletePost = functions.firestore
    .document("posts/{postId}")
    .onDelete(async (snap, context) => {

        const post = snap.data();
        const postId = context.params.postId;
        const db = admin.firestore();
        const storage = admin.storage();
        const postRef = db.collection('posts').doc(postId);
        const batch = db.batch();
        const storagePaths = [];

        // 画像
        for (const imageObj of post.images || []) {
            if (imageObj.image) {
                storagePaths.push(imageObj.image);
            }
            if (imageObj.thumbnail) {
                storagePaths.push(imageObj.thumbnail);
            }
        }
        // 動画
        for (const videoObj of post.videos || []) {
            if (videoObj.video) {
                storagePaths.push(videoObj.video);
            }
            if (videoObj.thumbnail) {
                storagePaths.push(videoObj.thumbnail);
            }
        }

        // サブコレクションの削除
        const post_reactions = await postRef.collection('post_reactions').get();
        for (const doc of post_reactions.docs) {
            batch.delete(doc.ref);
        }

        // Storageから画像を削除
        for (const path of storagePaths) {
            const matches = path.match(/\/b\/(.+?)\/o\/(.+?)(\?alt=media)?$/);
            if (!matches || matches.length < 3) {
                throw new Error('無効なStorage URLです');
            }
            const filePath = decodeURIComponent(matches[2]).split('?')[0];
            await storage.bucket().file(filePath).delete();
        }

        await batch.commit();
    }
);