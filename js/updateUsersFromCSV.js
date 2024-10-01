const functions = require('firebase-functions');
const admin = require('firebase-admin');
// To avoid deployment errors, do not call admin.initializeApp() in your code

const fetch = require('node-fetch');
const csv = require('csv-parse/sync');

exports.updateUsersFromCSV = functions.region('asia-northeast1').https.onCall(async (data, context) => {
  const fileUrl = data.fileUrl;
  const filePath = data.filePath;
  
  try {
    // CSVファイルをダウンロード
    const response = await fetch(fileUrl);
    const csvContent = await response.text();

    // CSVをパース
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });

    // Firestoreのバッチを作成
    const batch = admin.firestore().batch();

    // 各レコードを処理
    for (const record of records) {
      const { uid, user_point, area_currency, amount } = record;
      
      // uidをもとにユーザードキュメントを取得
      const userRef = admin.firestore().collection('users').doc(uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data();
      const currentPoints = userData.user_point || 0;
      // area_currency配列を更新する
      const updatedAreaCurrency = userData.area_currency.map(currency => {
        if (currency.area_currency === area_currency) {
          return {
            ...currency,
            amount: currency.amount + amount
          };
        }
        return currency;
      });

      // 該当するarea_currencyがなかった場合、新しいものを追加
      if (!updatedAreaCurrency.some(c => c.area_currency === area_currency)) {
        updatedAreaCurrency.push({ area_currency: area_currency, amount: amount });
      }

      // ユーザードキュメントを更新
      batch.update(userRef, {
        user_point: currentPoints + parseInt(user_point, 10),
        area_currency: updatedAreaCurrency,
      });
    }

    // バッチ処理を実行
    await batch.commit();
       
    // CSVファイルを削除
    await admin.storage().bucket().file(filePath).delete();

    return { success: true, message: `${records.length} users updated successfully.` };
  } catch (error) {
    console.error('Error updating users:', error);
    return { success: false, error: error.message };
  }
});