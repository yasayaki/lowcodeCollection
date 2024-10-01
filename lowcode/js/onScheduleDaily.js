const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.onScheduleDaily = functions.region('asia-northeast1').pubsub
  .schedule('0 0 * * *')
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {

    const db = admin.firestore();
    const collTransactions = db.collection('transactions');
  
    // 現在日時を作成
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    // test用。firestore上で日時を変更できるのは秒単位までで、ミリ秒単位は変動するため。
    const expireTime = new Date()
    expireTime.setHours(0, 0, 0, 999);
    
    // 有効期限切れの地域ポイントを取得
    const expiredAreaPoints = await db.collectionGroup('user_area_points')
      .where('expired_time', '<=', expireTime)
      .where('is_expired', '==', false)
      .get();

    // shopへの振込作成
    for (const areaPoint of expiredAreaPoints.docs) {

      // batchは最大500件の制限があるため1人ずつコミットする
      const batch = db.batch();
      const rest_point = areaPoint.data().rest_point;

      // ポイントが残っていた場合、失効する
      if (rest_point > 0) {
        batch.set(collTransactions.doc(), {
          user_ref: areaPoint.data().user_ref,
          area_point1_ref: areaPoint.data().area_point_ref,
          area_point1: - rest_point,
          action: 'expired_area_point',
          created_time: now,
        });
      }

      batch.update(areaPoint.ref, {
        is_expired: true,
      });
  
      await batch.commit();
    }
  });